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

function filterRows(rows: Record<string, unknown>[], indices?: Set<number>): Record<string, unknown>[] {
  return indices ? rows.filter((_, i) => indices.has(i)) : rows;
}

function rowsToTsv(columns: string[], rows: Record<string, unknown>[], indices?: Set<number>): string {
  const filtered = filterRows(rows, indices);
  const header = columns.join('\t');
  const body = filtered.map(row => columns.map(col => cellToString(row[col])).join('\t')).join('\n');
  return header + '\n' + body;
}

function rowsToCsv(columns: string[], rows: Record<string, unknown>[], indices?: Set<number>): string {
  const filtered = filterRows(rows, indices);
  const escape = (v: string) => v.includes(',') || v.includes('"') || v.includes('\n') ? `"${v.replace(/"/g, '""')}"` : v;
  const header = columns.map(escape).join(',');
  const body = filtered.map(row => columns.map(col => escape(cellToString(row[col]))).join(',')).join('\n');
  return header + '\n' + body;
}

function rowsToMarkdown(columns: string[], rows: Record<string, unknown>[], indices?: Set<number>): string {
  const filtered = filterRows(rows, indices);
  const header = '| ' + columns.join(' | ') + ' |';
  const separator = '| ' + columns.map(() => '---').join(' | ') + ' |';
  const body = filtered.map(row => '| ' + columns.map(col => cellToString(row[col])).join(' | ') + ' |').join('\n');
  return header + '\n' + separator + '\n' + body;
}

function rowsToJson(columns: string[], rows: Record<string, unknown>[], indices?: Set<number>): string {
  const filtered = filterRows(rows, indices);
  const objects = filtered.map(row => {
    const obj: Record<string, unknown> = {};
    for (const col of columns) obj[col] = row[col];
    return obj;
  });
  return JSON.stringify(objects, null, 2);
}

function rowsToSqlInsert(columns: string[], rows: Record<string, unknown>[], indices?: Set<number>, tableName = 'table_name'): string {
  const filtered = filterRows(rows, indices);
  const cols = columns.map(c => `\`${c}\``).join(', ');
  return filtered.map(row => {
    const vals = columns.map(col => {
      const v = row[col];
      if (v === null || v === undefined) return 'NULL';
      if (typeof v === 'number') return String(v);
      return `'${String(v).replace(/'/g, "\\'")}'`;
    }).join(', ');
    return `INSERT INTO ${tableName} (${cols}) VALUES (${vals});`;
  }).join('\n');
}

function rowsToHtmlTable(columns: string[], rows: Record<string, unknown>[], indices?: Set<number>): string {
  const filtered = filterRows(rows, indices);
  const header = '<tr>' + columns.map(c => `<th>${c}</th>`).join('') + '</tr>';
  const body = filtered.map(row =>
    '<tr>' + columns.map(col => `<td>${cellToString(row[col])}</td>`).join('') + '</tr>'
  ).join('\n');
  return `<table>\n<thead>\n${header}\n</thead>\n<tbody>\n${body}\n</tbody>\n</table>`;
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
    const formatters: Record<string, () => string> = {
      tsv: () => rowsToTsv(columns, rows, indices),
      csv: () => rowsToCsv(columns, rows, indices),
      markdown: () => rowsToMarkdown(columns, rows, indices),
      json: () => rowsToJson(columns, rows, indices),
      sql: () => rowsToSqlInsert(columns, rows, indices),
      html: () => rowsToHtmlTable(columns, rows, indices),
    };
    const text = formatters[format]();
    navigator.clipboard.writeText(text);
    const count = indices ? indices.size : rows.length;
    showFeedback(`Copied ${count} row(s) as ${formatLabels[format]}`);
  }, [selectedRows, columns, rows]);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
      e.preventDefault();
      setSelectedRows(new Set(rows.map((_, i) => i)));
    }
  };

  return (
    <div className="result-table-container" tabIndex={0} onKeyDown={handleKeyDown}>
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
