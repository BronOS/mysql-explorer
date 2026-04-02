import { useMemo, useState, useCallback } from 'react';
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from '@tanstack/react-table';

interface Props {
  columns: string[];
  rows: Record<string, unknown>[];
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return 'NULL';
  return String(val);
}

function rowsToTsv(columns: string[], rows: Record<string, unknown>[], indices?: Set<number>): string {
  const header = columns.join('\t');
  const body = rows
    .filter((_, i) => !indices || indices.has(i))
    .map(row => columns.map(col => cellToString(row[col])).join('\t'))
    .join('\n');
  return header + '\n' + body;
}

function rowsToMarkdown(columns: string[], rows: Record<string, unknown>[], indices?: Set<number>): string {
  const header = '| ' + columns.join(' | ') + ' |';
  const separator = '| ' + columns.map(() => '---').join(' | ') + ' |';
  const body = rows
    .filter((_, i) => !indices || indices.has(i))
    .map(row => '| ' + columns.map(col => cellToString(row[col])).join(' | ') + ' |')
    .join('\n');
  return header + '\n' + separator + '\n' + body;
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

  const copySelected = useCallback((format: 'tsv' | 'markdown') => {
    const indices = selectedRows.size > 0 ? selectedRows : undefined;
    const text = format === 'markdown'
      ? rowsToMarkdown(columns, rows, indices)
      : rowsToTsv(columns, rows, indices);
    navigator.clipboard.writeText(text);
    const count = indices ? indices.size : rows.length;
    showFeedback(`Copied ${count} row(s) as ${format === 'markdown' ? 'Markdown' : 'TSV'}`);
  }, [selectedRows, columns, rows]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  return (
    <div className="result-table-container">
      {copyFeedback && <div className="copy-feedback">{copyFeedback}</div>}
      <div className="datagrid-wrapper" onClick={() => setContextMenu(null)}>
        <table className="datagrid">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, rowIdx) => (
              <tr
                key={row.id}
                className={selectedRows.has(rowIdx) ? 'row-selected' : ''}
                onClick={(e) => handleRowClick(rowIdx, e)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  // If right-clicked row is already selected, keep selection
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
          <div className="context-menu-item" onClick={() => { copySelected('tsv'); setContextMenu(null); }}>
            Copy {selectedRows.size > 0 ? `${selectedRows.size} row(s)` : 'All'} as TSV
          </div>
          <div className="context-menu-item" onClick={() => { copySelected('markdown'); setContextMenu(null); }}>
            Copy {selectedRows.size > 0 ? `${selectedRows.size} row(s)` : 'All'} as Markdown
          </div>
        </div>
      )}
    </div>
  );
}
