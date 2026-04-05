import { useMemo, useState, useCallback, useRef, useLayoutEffect } from 'react';
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from '@tanstack/react-table';
import { formatRows } from '../utils/format-rows';

interface Props {
  columns: string[];
  rows: Record<string, unknown>[];
}


export default function ResultTable({ columns, rows }: Props) {
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [lastClickedRow, setLastClickedRow] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');

  const tableCols = useMemo<ColumnDef<Record<string, unknown>>[]>(() =>
    columns.map(col => ({
      accessorKey: col,
      header: col,
    })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: tableCols,
    getCoreRowModel: getCoreRowModel(),
  });

  const handleRowClick = (index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedRow !== null) {
      // Range select
      const start = Math.min(lastClickedRow, index);
      const end = Math.max(lastClickedRow, index);
      setSelectedRows(prev => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(i);
        return next;
      });
    } else if (e.metaKey || e.ctrlKey) {
      // Toggle single
      setSelectedRows(prev => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index); else next.add(index);
        return next;
      });
    } else {
      // Single select
      setSelectedRows(new Set([index]));
    }
    setLastClickedRow(index);
  };

  const showFeedback = (msg: string) => {
    setCopyFeedback(msg);
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  const formatLabels: Record<string, string> = {
    tsv: 'TSV', csv: 'CSV', markdown: 'Markdown', json: 'JSON', sql: 'SQL INSERT', html: 'HTML Table',
  };

  const copySelected = useCallback((format: string) => {
    const indices = selectedRows.size > 0 ? selectedRows : undefined;
    const filtered = indices ? rows.filter((_, i) => indices.has(i)) : rows;
    const text = formatRows(filtered, columns, format as any, 'table_name');
    navigator.clipboard.writeText(text);
    const count = indices ? indices.size : rows.length;
    showFeedback(`Copied ${count} row(s) as ${formatLabels[format]}`);
  }, [selectedRows, columns, rows]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const containerRefResult = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState<number[]>([]);

  const handleBodyScroll = () => {
    if (headerRef.current && bodyRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
  };

  useLayoutEffect(() => {
    if (!bodyRef.current || colWidths.length > 0) return;
    const firstRow = bodyRef.current.querySelector('tbody tr');
    if (!firstRow) return;
    const widths = Array.from(firstRow.children).map(td => (td as HTMLElement).offsetWidth);
    if (widths.length > 0) setColWidths(widths);
  }, [rows]);

  // Column resize
  const resizing = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  useLayoutEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing.current) return;
      const diff = e.clientX - resizing.current.startX;
      const newWidth = Math.max(50, resizing.current.startWidth + diff);
      setColWidths(prev => {
        const next = [...prev];
        next[resizing.current!.index] = newWidth;
        return next;
      });
    };
    const handleMouseUp = () => {
      if (resizing.current) { resizing.current = null; document.body.style.cursor = ''; }
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const startResize = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resizing.current = { index, startX: e.clientX, startWidth: colWidths[index] || 100 };
    document.body.style.cursor = 'col-resize';
  };

  const autoFitColumn = (index: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!bodyRef.current || !headerRef.current) return;
    const measure = document.createElement('span');
    measure.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:12px;font-family:inherit;padding:0;';
    document.body.appendChild(measure);
    let maxWidth = 0;
    const headerCell = headerRef.current.querySelector(`tr th:nth-child(${index + 1})`);
    if (headerCell) { measure.textContent = headerCell.textContent || ''; maxWidth = Math.max(maxWidth, measure.offsetWidth); }
    const bodyCells = bodyRef.current.querySelectorAll(`tbody tr td:nth-child(${index + 1})`);
    bodyCells.forEach(td => { measure.textContent = (td as HTMLElement).textContent || ''; maxWidth = Math.max(maxWidth, measure.offsetWidth); });
    document.body.removeChild(measure);
    maxWidth = Math.max(50, maxWidth + 28);
    setColWidths(prev => { const next = [...prev]; next[index] = maxWidth; return next; });
  };

  const hasWidths = colWidths.length > 0;
  const totalWidth = hasWidths ? colWidths.reduce((a, b) => a + b, 0) : undefined;
  const tableStyle = totalWidth ? { width: totalWidth, tableLayout: 'fixed' as const } : undefined;
  const colGroup = hasWidths ? (
    <colgroup>{colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}</colgroup>
  ) : null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      setSelectedRows(new Set(rows.map((_, i) => i)));
    }
  };

  return (
    <div className="result-table-container" ref={containerRefResult} tabIndex={-1} onKeyDown={handleKeyDown} onClick={() => containerRefResult.current?.focus()}>
      {copyFeedback && <div className="copy-feedback">{copyFeedback}</div>}
      <div className="datagrid-header" ref={headerRef}>
        <table className="datagrid" style={tableStyle}>
          {colGroup}
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map((h, colIdx) => (
                  <th key={h.id}>
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    <span className="col-resize-handle" onMouseDown={(e) => startResize(colIdx, e)} onDoubleClick={(e) => autoFitColumn(colIdx, e)} onClick={(e) => e.stopPropagation()} />
                  </th>
                ))}
              </tr>
            ))}
          </thead>
        </table>
      </div>
      <div className="datagrid-wrapper" ref={bodyRef} onScroll={handleBodyScroll} onClick={() => setContextMenu(null)}>
        <table className="datagrid" style={tableStyle}>
          {colGroup}
          <tbody>
            {table.getRowModel().rows.map((row, rowIdx) => (
              <tr
                key={row.id}
                className={selectedRows.has(rowIdx) ? 'row-selected' : ''}
                onClick={(e) => handleRowClick(rowIdx, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (!selectedRows.has(rowIdx)) {
                    setSelectedRows(new Set([rowIdx]));
                    setLastClickedRow(rowIdx);
                  }
                  setContextMenu({ x: e.clientX, y: e.clientY });
                }}
              >
                {row.getVisibleCells().map(cell => (
                  <td key={cell.id}>
                    <span className={`cell-readonly ${cell.getValue() === null ? 'cell-null' : ''}`}>
                      {cell.getValue() === null ? 'NULL' : String(cell.getValue())}
                    </span>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          {['tsv', 'csv', 'markdown', 'json', 'sql', 'html'].map(fmt => (
            <div key={fmt} className="context-menu-item" onClick={() => { copySelected(fmt); setContextMenu(null); }}>
              Copy {selectedRows.size > 0 ? `${selectedRows.size} row(s)` : 'All'} as {formatLabels[fmt]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
