import { useState, useEffect, useRef } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { useAppContext } from '../context/app-context';
import { IndexInfo } from '../../shared/types';
import IndexDialog, { IndexData, IndexColumn, ColumnInfo } from './IndexDialog';
import ErrorDialog from './ErrorDialog';

interface Props {
  connectionId: string;
  database: string;
  table: string;
  columnInfos: ColumnInfo[];
  isActive?: boolean;
  refreshTrigger?: number;
  onSchemaChanged: () => void;
}

interface DialogState {
  mode: 'add' | 'edit';
  row?: IndexInfo;
}

export default function SchemaIndexes({ connectionId, database, table, columnInfos, isActive, refreshTrigger, onSchemaChanged }: Props) {
  const ipc = useIpc();
  const { setStatus } = useAppContext();

  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const data = await ipc.schemaIndexes(connectionId, database, table);
      setIndexes(data);
    } catch (e: any) {
      setErrorMsg(`Failed to load indexes:\n${e?.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  const loaded = useRef(false);
  useEffect(() => {
    if (isActive && !loaded.current) { loaded.current = true; load(); }
  }, [isActive, connectionId, database, table]);

  // Reload when triggered by parent (e.g. column drop, column commit)
  useEffect(() => {
    if (loaded.current && refreshTrigger) load();
  }, [refreshTrigger]);

  const buildIndexModifier = (data: IndexData): string => {
    const cols = data.columns.map(c => c.prefixLength ? `\`${c.name}\`(${c.prefixLength})` : `\`${c.name}\``).join(', ');
    const typePrefix = data.type === 'UNIQUE' ? 'UNIQUE INDEX'
      : data.type === 'FULLTEXT' ? 'FULLTEXT INDEX'
      : 'INDEX';
    return `${typePrefix} \`${data.name}\` (${cols})`;
  };

  const handleAdd = async (data: IndexData) => {
    const modifier = buildIndexModifier(data);
    const sql = `ALTER TABLE \`${database}\`.\`${table}\` ADD ${modifier}`;
    try {
      await ipc.schemaAlterTable(connectionId, sql);
      setStatus(`Added index ${data.name}`, 'success');
      setDialog(null);
      onSchemaChanged();
      await load();
    } catch (e: any) {
      setErrorMsg(`Failed to add index:\n${e?.message ?? e}`);
    }
  };

  const handleEdit = async (oldIndex: IndexInfo, data: IndexData) => {
    const dropClause = oldIndex.name === 'PRIMARY'
      ? 'DROP PRIMARY KEY'
      : `DROP INDEX \`${oldIndex.name}\``;
    const addClause = `ADD ${buildIndexModifier(data)}`;
    const sql = `ALTER TABLE \`${database}\`.\`${table}\` ${dropClause}, ${addClause}`;
    try {
      await ipc.schemaAlterTable(connectionId, sql);
      setStatus(`Updated index ${data.name}`, 'success');
      setDialog(null);
      onSchemaChanged();
      await load();
    } catch (e: any) {
      setErrorMsg(`Failed to edit index:\n${e?.message ?? e}`);
    }
  };

  const handleDrop = async (index: IndexInfo) => {
    if (!confirm(`Drop index \`${index.name}\` from \`${table}\`? This cannot be undone.`)) return;
    const dropClause = index.name === 'PRIMARY'
      ? 'DROP PRIMARY KEY'
      : `DROP INDEX \`${index.name}\``;
    const sql = `ALTER TABLE \`${database}\`.\`${table}\` ${dropClause}`;
    try {
      await ipc.schemaAlterTable(connectionId, sql);
      setStatus(`Dropped index ${index.name}`, 'success');
      onSchemaChanged();
      await load();
    } catch (e: any) {
      setErrorMsg(`Failed to drop index:\n${e?.message ?? e}`);
    }
  };

  const handleSave = (data: { name: string; type: string; columns: string[]; unique: boolean }) => {
    if (!dialog) return;
    if (dialog.mode === 'add') {
      handleAdd(data);
    } else if (dialog.row) {
      handleEdit(dialog.row, data);
    }
  };

  return (
    <div className="schema-indexes">
      <div className="schema-zone-toolbar">
        <span className="schema-zone-title">Indexes</span>
        <div className="schema-zone-actions">
          <button className="btn btn-secondary" onClick={() => setDialog({ mode: 'add' })} title="Add index">+ Add Index</button>
          <button className="btn btn-secondary" onClick={load} title="Refresh indexes">Refresh</button>
        </div>
      </div>

      <div className="datagrid-wrapper">
        {loading ? (
          <div style={{ padding: 16, color: '#888' }}>Loading indexes...</div>
        ) : (
          <table className="datagrid">
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Columns</th>
                <th>Unique</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {indexes.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: '12px 16px', color: '#666', textAlign: 'center' }}>No indexes</td>
                </tr>
              ) : (
                indexes.map(idx => (
                  <tr key={idx.name}>
                    <td><span className="cell-readonly">{idx.name}</span></td>
                    <td><span className="cell-readonly">{idx.type}</span></td>
                    <td><span className="cell-readonly">{idx.columns.join(', ')}</span></td>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={idx.unique} readOnly style={{ cursor: 'default' }} />
                    </td>
                    <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '2px 8px', fontSize: 11, marginRight: 4 }}
                        onClick={() => setDialog({ mode: 'edit', row: idx })}
                        title={`Edit index ${idx.name}`}
                      >
                        Edit
                      </button>
                      <button
                        className="btn btn-danger"
                        style={{ padding: '2px 8px', fontSize: 11 }}
                        onClick={() => handleDrop(idx)}
                        title={`Drop index ${idx.name}`}
                      >
                        Drop
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {dialog && (
        <IndexDialog
          columns={columnInfos}
          initial={dialog.row ? { name: dialog.row.name, type: dialog.row.type, columns: dialog.row.columns.map(c => ({ name: c })), unique: dialog.row.unique } : undefined}
          onSave={handleSave}
          onClose={() => setDialog(null)}
        />
      )}
      {errorMsg && <ErrorDialog message={errorMsg} onClose={() => setErrorMsg(null)} />}
    </div>
  );
}
