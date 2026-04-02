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
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const menuRef = useRef<HTMLDivElement>(null);
  const editable = primaryKey !== null;

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

        const cellEditable = isDraft ? true : (editable && col.key !== 'PRI');

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

  // Measure body column widths on first render
  useLayoutEffect(() => {
    if (colWidths.length > 0) return; // don't override user-resized widths
    if (!bodyRef.current) return;
    const firstRow = bodyRef.current.querySelector('tr');
    if (!firstRow) return;
    const widths = Array.from(firstRow.children).map(td => (td as HTMLElement).offsetWidth);
    setColWidths(widths);
  }, [allRows, columns]);

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
    // Measure max content width across all body rows for this column
    const bodyCells = bodyRef.current.querySelectorAll(`tr td:nth-child(${index + 1})`);
    const headerCell = headerRef.current.querySelector(`tr th:nth-child(${index + 1})`);
    let maxWidth = 0;
    // Temporarily remove width constraints to measure natural width
    bodyCells.forEach(td => {
      const el = td as HTMLElement;
      const span = el.querySelector('span');
      if (span) maxWidth = Math.max(maxWidth, span.scrollWidth + 24); // 24 = padding
    });
    if (headerCell) {
      maxWidth = Math.max(maxWidth, headerCell.scrollWidth + 24);
    }
    maxWidth = Math.max(50, maxWidth);
    setColWidths(prev => {
      const next = [...prev];
      next[index] = maxWidth;
      return next;
    });
  };

  const totalWidth = colWidths.length ? colWidths.reduce((a, b) => a + b, 0) : undefined;
  const colGroup = colWidths.length > 0 ? (
    <colgroup>
      {colWidths.map((w, i) => <col key={i} style={{ width: w, minWidth: w }} />)}
    </colgroup>
  ) : null;

  return (
    <>
      <div className="datagrid-header" ref={headerRef}>
        <table className="datagrid" style={totalWidth ? { width: totalWidth } : undefined}>
          {colGroup}
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => {
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
                      <span className="col-resize-handle" onMouseDown={(e) => startResize(h.index, e)} onDoubleClick={(e) => autoFitColumn(h.index, e)} onClick={(e) => e.stopPropagation()} />
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
        </table>
      </div>
      <div className="datagrid-wrapper" ref={bodyRef} onScroll={handleBodyScroll}>
        <table className="datagrid" style={totalWidth ? { width: totalWidth } : undefined}>
          {colGroup}
          <tbody>
            {table.getRowModel().rows.map((row, rowIdx) => {
              const isDraft = '__draftId' in row.original;
              const isLastDraft = isDraft && rowIdx === table.getRowModel().rows.length - 1;
              return (
              <tr key={row.id} className={isDraft ? 'row-draft' : ''} ref={isLastDraft ? lastDraftRef : undefined}>
                {row.getVisibleCells().map(cell => {
                  const pkValue = isDraft ? row.original.__draftId : (primaryKey ? row.original[primaryKey] : null);
                  const colMeta = columns.find(c => c.name === cell.column.id);
                  const isModified = pendingChanges.has(`${pkValue}:${cell.column.id}`) || isDraft;
                  return (
                    <td
                      key={cell.id}
                      className={isModified ? 'cell-modified' : ''}
                      onContextMenu={(e) => {
                        if (!colMeta) return;
                        if (!isDraft && !editable) return;
                        e.preventDefault();
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
        </div>
      )}
    </>
  );
}
