import { useMemo, useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from '@tanstack/react-table';
import { ColumnMeta } from '../../shared/types';
import CellEditor from './CellEditor';
import TextEditModal from './TextEditModal';

interface CellContextMenu {
  x: number;
  y: number;
  pkValue: unknown;
  column: ColumnMeta;
  value: unknown;
  rowOriginal: Record<string, unknown>;
  isDraft: boolean;
}

interface Props {
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  draftRows?: Record<string, unknown>[];
  primaryKey: string | null;
  saveMode: 'auto' | 'bulk';
  onCellSave: (rowPkValue: unknown, column: string, value: unknown) => void;
  pendingChanges: Map<string, unknown>;
  orderBy?: { column: string; direction: 'ASC' | 'DESC' } | null;
  onSort?: (column: string) => void;
  onDuplicateRow?: (row: Record<string, unknown>) => void;
  onDeleteRow?: (pkValue: unknown) => void;
  onDeleteDraftRow?: (draftId: string) => void;
}

export default function DataGrid({ columns, rows, draftRows = [], primaryKey, saveMode, onCellSave, pendingChanges, orderBy, onSort, onDuplicateRow, onDeleteRow, onDeleteDraftRow }: Props) {
  const [textModal, setTextModal] = useState<{ value: string; onSave: (v: string) => void } | null>(null);
  const [cellMenu, setCellMenu] = useState<CellContextMenu | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [lastClickedRow, setLastClickedRow] = useState<number | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const editable = primaryKey !== null;

  const handleRowSelect = (index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedRow !== null) {
      const start = Math.min(lastClickedRow, index);
      const end = Math.max(lastClickedRow, index);
      setSelectedRows(prev => {
        const next = new Set(prev);
        for (let i = start; i <= end; i++) next.add(i);
        return next;
      });
    } else if (e.metaKey || e.ctrlKey) {
      setSelectedRows(prev => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index); else next.add(index);
        return next;
      });
    } else {
      setSelectedRows(new Set([index]));
    }
    setLastClickedRow(index);
  };

  const cellToString = (val: unknown): string => val === null || val === undefined ? 'NULL' : String(val);
  const colNames = columns.map(c => c.name);

  const copyRows = (format: string) => {
    const indices = selectedRows.size > 0 ? selectedRows : undefined;
    const filtered = indices ? allRows.filter((_, i) => indices.has(i)) : allRows;
    let text = '';
    switch (format) {
      case 'tsv':
        text = colNames.join('\t') + '\n' + filtered.map(r => colNames.map(c => cellToString(r[c])).join('\t')).join('\n');
        break;
      case 'csv': {
        const esc = (v: string) => v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
        text = colNames.map(esc).join(',') + '\n' + filtered.map(r => colNames.map(c => esc(cellToString(r[c]))).join(',')).join('\n');
        break;
      }
      case 'markdown':
        text = '| ' + colNames.join(' | ') + ' |\n| ' + colNames.map(() => '---').join(' | ') + ' |\n' +
          filtered.map(r => '| ' + colNames.map(c => cellToString(r[c])).join(' | ') + ' |').join('\n');
        break;
      case 'json':
        text = JSON.stringify(filtered.map(r => { const o: any = {}; colNames.forEach(c => o[c] = r[c]); return o; }), null, 2);
        break;
      case 'sql':
        text = filtered.map(r => {
          const vals = colNames.map(c => { const v = r[c]; return v === null || v === undefined ? 'NULL' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "\\'")}'`; }).join(', ');
          return `INSERT INTO table_name (${colNames.map(c => '`' + c + '`').join(', ')}) VALUES (${vals});`;
        }).join('\n');
        break;
      case 'html':
        text = `<table>\n<thead>\n<tr>${colNames.map(c => `<th>${c}</th>`).join('')}</tr>\n</thead>\n<tbody>\n` +
          filtered.map(r => '<tr>' + colNames.map(c => `<td>${cellToString(r[c])}</td>`).join('') + '</tr>').join('\n') +
          '\n</tbody>\n</table>';
        break;
    }
    navigator.clipboard.writeText(text);
    const count = indices ? indices.size : allRows.length;
    const labels: Record<string, string> = { tsv: 'TSV', csv: 'CSV', markdown: 'Markdown', json: 'JSON', sql: 'SQL INSERT', html: 'HTML Table' };
    setCopyFeedback(`Copied ${count} row(s) as ${labels[format]}`);
    setTimeout(() => setCopyFeedback(''), 2000);
  };

  useEffect(() => {
    const handler = () => setCellMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (draftRows.length > 0 && lastDraftRef.current) {
      lastDraftRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [draftRows.length]);

  useLayoutEffect(() => {
    if (cellMenu && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const left = cellMenu.x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 4 : cellMenu.x;
      const top = cellMenu.y + rect.height > window.innerHeight ? cellMenu.y - rect.height : cellMenu.y;
      setMenuPos({ left, top });
    }
  }, [cellMenu]);

  const allRows = useMemo(() => [...rows, ...draftRows], [rows, draftRows]);
  const lastDraftRef = useRef<HTMLTableRowElement>(null);

  const tableCols = useMemo<ColumnDef<Record<string, unknown>>[]>(() =>
    columns.map(col => ({
      accessorKey: col.name,
      header: col.name,
      cell: ({ row }) => {
        const isDraft = '__draftId' in row.original;
        const pkValue = isDraft ? row.original.__draftId : (primaryKey ? row.original[primaryKey] : null);
        const changeKey = `${pkValue}:${col.name}`;
        const currentValue = pendingChanges.has(changeKey)
          ? pendingChanges.get(changeKey)
          : row.original[col.name];

        const cellEditable = isDraft ? true : editable;

        return (
          <CellEditor
            value={currentValue}
            column={col}
            editable={cellEditable}
            onSave={(newValue) => onCellSave(pkValue, col.name, newValue)}
            onOpenTextModal={(val, saveFn) => setTextModal({ value: val, onSave: saveFn })}
          />
        );
      },
    })),
    [columns, primaryKey, editable, pendingChanges, onCellSave, draftRows],
  );

  const table = useReactTable({
    data: allRows,
    columns: tableCols,
    getCoreRowModel: getCoreRowModel(),
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [colWidths, setColWidths] = useState<number[]>([]);
  const resizing = useRef<{ index: number; startX: number; startWidth: number } | null>(null);

  // Sync horizontal scroll between header and body
  const handleBodyScroll = () => {
    if (headerRef.current && bodyRef.current) {
      headerRef.current.scrollLeft = bodyRef.current.scrollLeft;
    }
  };

  // Measure body column widths once when data first loads
  const measured = useRef(false);
  useLayoutEffect(() => {
    if (measured.current && colWidths.length > 0) return;
    if (!bodyRef.current) return;
    const firstRow = bodyRef.current.querySelector('tbody tr');
    if (!firstRow) return;
    const widths = Array.from(firstRow.children).slice(1).map(td => (td as HTMLElement).offsetWidth); // skip row number td
    if (widths.length > 0 && widths.some(w => w > 0)) {
      measured.current = true;
      setColWidths(widths);
    }
  });

  // Reset measurement when switching tables
  useEffect(() => {
    measured.current = false;
    setColWidths([]);
  }, [columns.length]);

  // Column resize handlers
  useEffect(() => {
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
      if (resizing.current) {
        resizing.current = null;
        document.body.style.cursor = '';
      }
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

    // Create off-screen measurement element
    const measure = document.createElement('span');
    measure.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;font-size:12px;font-family:inherit;padding:0;';
    document.body.appendChild(measure);

    let maxWidth = 0;

    // Measure header text (+2 to skip # column)
    const headerCell = headerRef.current.querySelector(`tr th:nth-child(${index + 2})`);
    if (headerCell) {
      measure.textContent = headerCell.textContent || '';
      maxWidth = Math.max(maxWidth, measure.offsetWidth);
    }

    // Measure body cell texts (+2 to skip row number column)
    const bodyCells = bodyRef.current.querySelectorAll(`tbody tr td:nth-child(${index + 2})`);
    bodyCells.forEach(td => {
      measure.textContent = (td as HTMLElement).textContent || '';
      maxWidth = Math.max(maxWidth, measure.offsetWidth);
    });

    document.body.removeChild(measure);

    // Add padding (12px each side) + some breathing room
    maxWidth = Math.max(50, maxWidth + 28);

    setColWidths(prev => {
      const next = [...prev];
      next[index] = maxWidth;
      return next;
    });
  };

  const hasWidths = colWidths.length > 0;
  const totalWidth = hasWidths ? 40 + colWidths.reduce((a, b) => a + b, 0) : undefined;
  const tableStyle = totalWidth ? { width: totalWidth, tableLayout: 'fixed' as const } : undefined;
  const colGroup = hasWidths ? (
    <colgroup>
      <col style={{ width: 40 }} />
      {colWidths.map((w, i) => <col key={i} style={{ width: w }} />)}
    </colgroup>
  ) : null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      setSelectedRows(new Set(allRows.map((_, i) => i)));
    }
  };

  return (
    <div className="datagrid-container" ref={containerRef} tabIndex={-1} onKeyDown={handleKeyDown} onClick={() => containerRef.current?.focus()}>
      <div className="datagrid-header" ref={headerRef}>
        <table className="datagrid" style={tableStyle}>
          {colGroup}
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                <th className="row-num-header" onClick={() => {
                  if (selectedRows.size === allRows.length) {
                    setSelectedRows(new Set());
                  } else {
                    setSelectedRows(new Set(allRows.map((_, i) => i)));
                  }
                }} title={selectedRows.size === allRows.length ? 'Deselect all' : 'Select all'}>#</th>
                {hg.headers.map((h, colIdx) => {
                  const colId = h.column.id;
                  const sorted = orderBy?.column === colId;
                  return (
                    <th
                      key={h.id}
                      className={onSort ? 'th-sortable' : ''}
                      onClick={() => onSort?.(colId)}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sorted && <span className="sort-indicator">{orderBy!.direction === 'ASC' ? ' ▲' : ' ▼'}</span>}
                      <span className="col-resize-handle" onMouseDown={(e) => startResize(colIdx, e)} onDoubleClick={(e) => autoFitColumn(colIdx, e)} onClick={(e) => e.stopPropagation()} />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
        </table>
      </div>
      <div className="datagrid-wrapper" ref={bodyRef} onScroll={handleBodyScroll}>
        <table className="datagrid" style={tableStyle}>
          {colGroup}
          <tbody>
            {table.getRowModel().rows.map((row, rowIdx) => {
              const isDraft = '__draftId' in row.original;
              const isLastDraft = isDraft && rowIdx === table.getRowModel().rows.length - 1;
              return (
              <tr key={row.id} className={`${isDraft ? 'row-draft' : ''} ${selectedRows.has(rowIdx) ? 'row-selected' : ''}`} ref={isLastDraft ? lastDraftRef : undefined}>
                <td className="row-num-cell" onClick={(e) => handleRowSelect(rowIdx, e)}>
                  {isDraft ? '•' : rowIdx + 1}
                </td>
                {row.getVisibleCells().map(cell => {
                  const pkValue = isDraft ? row.original.__draftId : (primaryKey ? row.original[primaryKey] : null);
                  const colMeta = columns.find(c => c.name === cell.column.id);
                  const isModified = pendingChanges.has(`${pkValue}:${cell.column.id}`) || isDraft;
                  return (
                    <td
                      key={cell.id}
                      className={isModified ? 'cell-modified' : ''}
                      onClick={(e) => handleRowSelect(rowIdx, e)}
                      onContextMenu={(e) => {
                        if (!colMeta) return;
                        e.preventDefault();
                        if (!selectedRows.has(rowIdx)) {
                          setSelectedRows(new Set([rowIdx]));
                          setLastClickedRow(rowIdx);
                        }
                        const changeKey = `${pkValue}:${cell.column.id}`;
                        const currentValue = pendingChanges.has(changeKey)
                          ? pendingChanges.get(changeKey)
                          : row.original[cell.column.id];
                        setCellMenu({ x: e.clientX, y: e.clientY, pkValue, column: colMeta, value: currentValue, rowOriginal: row.original, isDraft });
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!editable && (
        <div className="no-pk-notice">This table has no primary key. Editing is disabled.</div>
      )}

      {textModal && (
        <TextEditModal
          initialValue={textModal.value}
          onSave={textModal.onSave}
          onClose={() => setTextModal(null)}
        />
      )}

      {cellMenu && (
        <div ref={menuRef} className="context-menu" style={{ left: menuPos.left, top: menuPos.top }}>
          {cellMenu.column.nullable && (
            <div
              className="context-menu-item"
              onClick={() => { onCellSave(cellMenu.pkValue, cellMenu.column.name, null); setCellMenu(null); }}
            >
              Set NULL
            </div>
          )}
          <div
            className="context-menu-item"
            onClick={() => { onCellSave(cellMenu.pkValue, cellMenu.column.name, cellMenu.column.defaultValue); setCellMenu(null); }}
          >
            Set Default{cellMenu.column.defaultValue !== null ? ` (${cellMenu.column.defaultValue})` : ''}
          </div>
          <div
            className="context-menu-item"
            onClick={() => {
              const text = cellMenu.value === null ? '' : String(cellMenu.value);
              navigator.clipboard.writeText(text);
              setCellMenu(null);
            }}
          >
            Copy Value
          </div>
          <div
            className="context-menu-item"
            onClick={() => {
              navigator.clipboard.writeText(cellMenu.column.name);
              setCellMenu(null);
            }}
          >
            Copy Column Name
          </div>
          {onDuplicateRow && !cellMenu.isDraft && (
            <div
              className="context-menu-item"
              onClick={() => { onDuplicateRow(cellMenu.rowOriginal); setCellMenu(null); }}
            >
              Duplicate Row
            </div>
          )}
          {cellMenu.isDraft && onDeleteDraftRow && (
            <div
              className="context-menu-item"
              style={{ color: '#ef4444' }}
              onClick={() => { onDeleteDraftRow(cellMenu.pkValue as string); setCellMenu(null); }}
            >
              Remove Draft Row
            </div>
          )}
          {!cellMenu.isDraft && primaryKey && onDeleteRow && (
            <div
              className="context-menu-item"
              style={{ color: '#ef4444' }}
              onClick={() => {
                const pkVal = cellMenu.rowOriginal[primaryKey!];
                if (confirm(`Delete row where ${primaryKey} = ${pkVal}?`)) {
                  onDeleteRow(pkVal);
                }
                setCellMenu(null);
              }}
            >
              Delete Row
            </div>
          )}
          <div style={{ borderTop: '1px solid #515151', margin: '4px 0' }} />
          {['tsv', 'csv', 'markdown', 'json', 'sql', 'html'].map(fmt => (
            <div key={fmt} className="context-menu-item" onClick={() => { copyRows(fmt); setCellMenu(null); }}>
              Copy {selectedRows.size > 1 ? `${selectedRows.size} rows` : 'Row'} as {{ tsv: 'TSV', csv: 'CSV', markdown: 'Markdown', json: 'JSON', sql: 'SQL INSERT', html: 'HTML Table' }[fmt]}
            </div>
          ))}
        </div>
      )}
      {copyFeedback && <div className="copy-feedback">{copyFeedback}</div>}
    </div>
  );
}
