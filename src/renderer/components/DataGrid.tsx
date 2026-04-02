import { useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from '@tanstack/react-table';
import { ColumnMeta } from '../../shared/types';
import CellEditor from './CellEditor';
import TextEditModal from './TextEditModal';

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
  const editable = primaryKey !== null;

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
                  const isModified = pendingChanges.has(`${pkValue}:${cell.column.id}`);
                  return (
                    <td key={cell.id} className={isModified ? 'cell-modified' : ''}>
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
    </>
  );
}
