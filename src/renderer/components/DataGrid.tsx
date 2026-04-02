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
}

interface Props {
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  primaryKey: string | null;
  saveMode: 'auto' | 'bulk';
  onCellSave: (rowPkValue: unknown, column: string, value: unknown) => void;
  pendingChanges: Map<string, unknown>;
}

export default function DataGrid({ columns, rows, primaryKey, saveMode, onCellSave, pendingChanges }: Props) {
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

  useLayoutEffect(() => {
    if (cellMenu && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const left = cellMenu.x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 4 : cellMenu.x;
      const top = cellMenu.y + rect.height > window.innerHeight ? cellMenu.y - rect.height : cellMenu.y;
      setMenuPos({ left, top });
    }
  }, [cellMenu]);

  const tableCols = useMemo<ColumnDef<Record<string, unknown>>[]>(() =>
    columns.map(col => ({
      accessorKey: col.name,
      header: col.name,
      cell: ({ row }) => {
        const pkValue = primaryKey ? row.original[primaryKey] : null;
        const changeKey = `${pkValue}:${col.name}`;
        const currentValue = pendingChanges.has(changeKey)
          ? pendingChanges.get(changeKey)
          : row.original[col.name];

        return (
          <CellEditor
            value={currentValue}
            column={col}
            editable={editable && col.key !== 'PRI'}
            onSave={(newValue) => onCellSave(pkValue, col.name, newValue)}
            onOpenTextModal={(val, saveFn) => setTextModal({ value: val, onSave: saveFn })}
          />
        );
      },
    })),
    [columns, primaryKey, editable, pendingChanges, onCellSave],
  );

  const table = useReactTable({
    data: rows,
    columns: tableCols,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <div className="datagrid-wrapper">
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
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => {
                  const pkValue = primaryKey ? row.original[primaryKey] : null;
                  const colMeta = columns.find(c => c.name === cell.column.id);
                  const isModified = pendingChanges.has(`${pkValue}:${cell.column.id}`);
                  return (
                    <td
                      key={cell.id}
                      className={isModified ? 'cell-modified' : ''}
                      onContextMenu={(e) => {
                        if (!editable || !colMeta || colMeta.key === 'PRI') return;
                        e.preventDefault();
                        const changeKey = `${pkValue}:${cell.column.id}`;
                        const currentValue = pendingChanges.has(changeKey)
                          ? pendingChanges.get(changeKey)
                          : row.original[cell.column.id];
                        setCellMenu({ x: e.clientX, y: e.clientY, pkValue, column: colMeta, value: currentValue });
                      }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
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
        </div>
      )}
    </>
  );
}
