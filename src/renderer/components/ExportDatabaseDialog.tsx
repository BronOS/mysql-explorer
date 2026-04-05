import { useState, useEffect } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { rowsToSqlInsert } from '../utils/format-rows';

interface Props {
  connectionId: string;
  database: string;
  onClose: () => void;
}

export default function ExportDatabaseDialog({ connectionId, database, onClose }: Props) {
  const ipc = useIpc();

  const [folder, setFolder] = useState('');
  const [fileName, setFileName] = useState(`${database}.sql`);
  const [createDatabase, setCreateDatabase] = useState(true);
  const [createDatabaseIfNotExists, setCreateDatabaseIfNotExists] = useState(true);
  const [createTable, setCreateTable] = useState(true);
  const [createTableIfNotExists, setCreateTableIfNotExists] = useState(true);
  const [exportData, setExportData] = useState(true);
  const [exportViews, setExportViews] = useState(true);
  const [exportProcedures, setExportProcedures] = useState(true);
  const [exportFunctions, setExportFunctions] = useState(true);
  const [exportTriggers, setExportTriggers] = useState(true);
  const [exportEvents, setExportEvents] = useState(true);

  const [tables, setTables] = useState<string[]>([]);
  const [selectedTables, setSelectedTables] = useState<Set<string>>(new Set());
  const [loadingTables, setLoadingTables] = useState(true);

  const [exporting, setExporting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportedPath, setExportedPath] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingTables(true);
    ipc.schemaTables(connectionId, database).then((tbls: string[]) => {
      if (cancelled) return;
      setTables(tbls);
      setSelectedTables(new Set(tbls));
      setLoadingTables(false);
    }).catch(() => {
      if (cancelled) return;
      setLoadingTables(false);
    });
    return () => { cancelled = true; };
  }, [connectionId, database]);

  const allSelected = tables.length > 0 && selectedTables.size === tables.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedTables(new Set());
    } else {
      setSelectedTables(new Set(tables));
    }
  };

  const toggleTable = (table: string) => {
    setSelectedTables(prev => {
      const next = new Set(prev);
      if (next.has(table)) {
        next.delete(table);
      } else {
        next.add(table);
      }
      return next;
    });
  };

  const handleExport = async () => {
    setError(null);
    let filePath: string;
    if (folder) {
      filePath = `${folder}/${fileName}`;
    } else {
      const picked = await ipc.exportPickSaveFile(fileName, 'sql');
      if (!picked) return;
      filePath = picked;
    }

    setExporting(true);
    try {
      const lines: string[] = [];

      // CREATE DATABASE
      if (createDatabase) {
        const ifNotExists = createDatabaseIfNotExists ? 'IF NOT EXISTS ' : '';
        lines.push(`CREATE DATABASE ${ifNotExists}\`${database}\`;`);
      }
      lines.push(`USE \`${database}\`;`);
      lines.push('');

      const orderedTables = tables.filter(t => selectedTables.has(t));

      for (const table of orderedTables) {
        // CREATE TABLE DDL
        if (createTable) {
          let ddl: string = await ipc.schemaCreateTable(connectionId, database, table);
          if (createTableIfNotExists) {
            ddl = ddl.replace(/^CREATE TABLE `/i, 'CREATE TABLE IF NOT EXISTS `');
          }
          lines.push(ddl + ';');
          lines.push('');
        }

        // INSERT statements
        if (exportData) {
          const rows: Record<string, unknown>[] = await ipc.exportFetchAllRows(connectionId, database, table);
          if (rows.length > 0) {
            const colNames = Object.keys(rows[0]);
            lines.push(rowsToSqlInsert(rows, colNames, table));
            lines.push('');
          }
        }
      }

      // Views
      if (exportViews) {
        const views: string[] = await ipc.schemaViews(connectionId, database);
        for (const view of views) {
          const ddl: string = await ipc.schemaCreateView(connectionId, database, view);
          if (ddl) { lines.push(ddl + ';'); lines.push(''); }
        }
      }

      // Procedures
      if (exportProcedures) {
        const procs: string[] = await ipc.schemaProcedures(connectionId, database);
        for (const proc of procs) {
          lines.push('DELIMITER ;;');
          const ddl: string = await ipc.schemaCreateProcedure(connectionId, database, proc);
          if (ddl) { lines.push(ddl + ' ;;'); }
          lines.push('DELIMITER ;');
          lines.push('');
        }
      }

      // Functions
      if (exportFunctions) {
        const funcs: string[] = await ipc.schemaFunctions(connectionId, database);
        for (const func of funcs) {
          lines.push('DELIMITER ;;');
          const ddl: string = await ipc.schemaCreateFunction(connectionId, database, func);
          if (ddl) { lines.push(ddl + ' ;;'); }
          lines.push('DELIMITER ;');
          lines.push('');
        }
      }

      // Triggers
      if (exportTriggers) {
        const triggers: string[] = await ipc.schemaTriggers(connectionId, database);
        for (const trigger of triggers) {
          lines.push('DELIMITER ;;');
          const ddl: string = await ipc.schemaCreateTrigger(connectionId, database, trigger);
          if (ddl) { lines.push(ddl + ' ;;'); }
          lines.push('DELIMITER ;');
          lines.push('');
        }
      }

      // Events
      if (exportEvents) {
        const events: string[] = await ipc.schemaEvents(connectionId, database);
        for (const event of events) {
          lines.push('DELIMITER ;;');
          const ddl: string = await ipc.schemaCreateEvent(connectionId, database, event);
          if (ddl) { lines.push(ddl + ' ;;'); }
          lines.push('DELIMITER ;');
          lines.push('');
        }
      }

      const content = lines.join('\n');
      await ipc.exportWriteFile(filePath, content);
      setExportedPath(filePath);
      setDone(true);
    } catch (err: any) {
      setError(err.message ?? String(err));
    } finally {
      setExporting(false);
    }
  };

  const exportDisabled = exporting || selectedTables.size === 0;

  return (
    <div className="modal-overlay" onClick={done && !exporting ? onClose : undefined}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 480, maxWidth: 560 }}>
        <div className="modal-title">Export Database: {database}</div>

        {done ? (
          <>
            <div style={{ padding: 12, background: '#2b2b2b', borderRadius: 4, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#4ade80' }}>Export complete</div>
              {exportedPath && (
                <div style={{ fontSize: 11, color: '#888', marginTop: 4, wordBreak: 'break-all' }}>{exportedPath}</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={onClose}>Close</button>
            </div>
          </>
        ) : (
          <>
            {/* Folder + File Name */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 12, color: '#aaa', marginBottom: 4 }}>Destination</label>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 6 }}>
                <input
                  className="input"
                  value={folder}
                  onChange={e => setFolder(e.target.value)}
                  placeholder="Select folder..."
                  style={{ flex: 1 }}
                  readOnly
                  disabled={exporting}
                />
                <button className="btn btn-secondary" disabled={exporting} onClick={async () => {
                  const picked = await ipc.exportPickFolder();
                  if (picked) setFolder(picked);
                }}>Browse</button>
              </div>
              <input
                className="input"
                type="text"
                value={fileName}
                onChange={e => setFileName(e.target.value)}
                placeholder="File name"
                disabled={exporting}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
            </div>

            {/* Options */}
            <div style={{ marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* CREATE DATABASE */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={createDatabase} onChange={e => setCreateDatabase(e.target.checked)} disabled={exporting} />
                  CREATE DATABASE
                </label>
                {createDatabase && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#aaa', marginTop: 4, marginLeft: 24 }}>
                    <input type="checkbox" checked={createDatabaseIfNotExists} onChange={e => setCreateDatabaseIfNotExists(e.target.checked)} disabled={exporting} />
                    IF NOT EXISTS
                  </label>
                )}
              </div>

              {/* CREATE TABLE */}
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={createTable} onChange={e => setCreateTable(e.target.checked)} disabled={exporting} />
                  CREATE TABLE
                </label>
                {createTable && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12, color: '#aaa', marginTop: 4, marginLeft: 24 }}>
                    <input type="checkbox" checked={createTableIfNotExists} onChange={e => setCreateTableIfNotExists(e.target.checked)} disabled={exporting} />
                    IF NOT EXISTS
                  </label>
                )}
              </div>

              {/* Export Data */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={exportData} onChange={e => setExportData(e.target.checked)} disabled={exporting} />
                Export Data
              </label>

              {/* Schema objects */}
              <div style={{ borderTop: '1px solid #515151', paddingTop: 8, marginTop: 4 }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Schema Objects</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={exportViews} onChange={e => setExportViews(e.target.checked)} disabled={exporting} />
                    Views
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={exportProcedures} onChange={e => setExportProcedures(e.target.checked)} disabled={exporting} />
                    Procedures
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={exportFunctions} onChange={e => setExportFunctions(e.target.checked)} disabled={exporting} />
                    Functions
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={exportTriggers} onChange={e => setExportTriggers(e.target.checked)} disabled={exporting} />
                    Triggers
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={exportEvents} onChange={e => setExportEvents(e.target.checked)} disabled={exporting} />
                    Events
                  </label>
                </div>
              </div>
            </div>

            {/* Table List */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: '#aaa' }}>Tables</span>
                {!loadingTables && tables.length > 0 && (
                  <button
                    className="btn btn-secondary"
                    onClick={toggleSelectAll}
                    disabled={exporting}
                    style={{ fontSize: 11, padding: '2px 8px' }}
                  >
                    {allSelected ? 'Deselect All' : 'Select All'}
                  </button>
                )}
              </div>
              {loadingTables ? (
                <div style={{ fontSize: 12, color: '#666', padding: '8px 0' }}>Loading tables...</div>
              ) : tables.length === 0 ? (
                <div style={{ fontSize: 12, color: '#666', padding: '8px 0' }}>No tables found.</div>
              ) : (
                <div style={{ maxHeight: 200, overflowY: 'auto', background: '#1e1e1e', borderRadius: 4, padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {tables.map(table => (
                    <label key={table} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={selectedTables.has(table)}
                        onChange={() => toggleTable(table)}
                        disabled={exporting}
                      />
                      {table}
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{ padding: 8, borderRadius: 4, marginBottom: 12, fontSize: 12, background: '#2a0000', color: '#ef4444' }}>
                {error}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={onClose} disabled={exporting}>Cancel</button>
              <button className="btn btn-primary" onClick={handleExport} disabled={exportDisabled}>
                {exporting ? 'Exporting...' : 'Export'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
