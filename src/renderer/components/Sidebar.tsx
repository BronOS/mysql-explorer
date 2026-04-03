import { useState, useEffect, useRef } from 'react';
import ConnectionDialog from './ConnectionDialog';
import { useAppContext } from '../context/app-context';
import { useIpc } from '../hooks/use-ipc';
import { ConnectionConfig } from '../../shared/types';
import { setUiState, loadUiStateAsync } from '../hooks/use-ui-state';

export default function Sidebar({ width }: { width: number }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | undefined>();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connectionId: string } | null>(null);
  const [tableContextMenu, setTableContextMenu] = useState<{ x: number; y: number; conn: ConnectionConfig; database: string; table: string } | null>(null);
  const [expandedConns, setExpandedConns] = useState<Set<string>>(new Set());
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<Set<string>>(new Set());
  const [loadingDbs, setLoadingDbs] = useState<Set<string>>(new Set());
  const [tableFilter, setTableFilter] = useState('');
  const initialized = useRef(false);

  const { connections, schema, dispatch, openTab, tabs, activeTabId } = useAppContext();
  const ipc = useIpc();
  const activeNodeRef = useRef<HTMLDivElement>(null);
  const activeTab = tabs.find(t => t.id === activeTabId);

  // Persist expanded connections (skip initial render)
  useEffect(() => {
    if (initialized.current) {
      setUiState('expandedConns', [...expandedConns]);
      setUiState('expandedDbs', [...expandedDbs]);
    }
  }, [expandedConns, expandedDbs]);

  // Scroll to active node when tab changes
  useEffect(() => {
    if (activeNodeRef.current) {
      activeNodeRef.current.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeTabId]);

  // Helper: persist current schema to disk
  const persistSchema = async (connId: string, databases: { name: string; tables: string[]; columns: { [t: string]: string[] } }[]) => {
    try {
      const cache = await ipc.schemaCacheLoad();
      cache[connId] = { databases, timestamp: Date.now() };
      await ipc.schemaCacheSave(cache);
    } catch {}
  };

  // Load connections, restore from cache immediately, then refresh in background
  useEffect(() => {
    const init = async () => {
      const conns = await ipc.connectionList();
      dispatch({ type: 'SET_CONNECTIONS', connections: conns });

      const uiState = await loadUiStateAsync();
      const savedConns: string[] = uiState.expandedConns || [];
      const savedDbs: string[] = uiState.expandedDbs || [];

      // Step 1: Load cached schema instantly (no network)
      let cache: Record<string, any> = {};
      try { cache = await ipc.schemaCacheLoad(); } catch {}

      for (const connId of savedConns) {
        const conn = conns.find((c: ConnectionConfig) => c.id === connId);
        if (!conn) continue;

        // Restore from cache immediately
        const cached = cache[connId];
        if (cached?.databases) {
          dispatch({
            type: 'SET_SCHEMA',
            connectionId: connId,
            databases: cached.databases.map((db: any) => ({
              name: db.name,
              tables: db.tables || [],
              columns: db.columns || {},
              loaded: db.tables?.length > 0,
            })),
            loaded: true,
          });
          setExpandedConns(prev => new Set(prev).add(connId));
          for (const dbKey of savedDbs) {
            if (dbKey.startsWith(connId + ':')) {
              setExpandedDbs(prev => new Set(prev).add(dbKey));
            }
          }
          // Also restore columns from cache
          for (const db of cached.databases) {
            if (db.columns && Object.keys(db.columns).length > 0) {
              dispatch({ type: 'SET_COLUMNS', connectionId: connId, database: db.name, columns: db.columns });
            }
          }
        }

        // Step 2: Background refresh — connect and fetch fresh data
        setConnecting(prev => new Set(prev).add(connId));
        (async () => {
          try {
            await ipc.connectionConnect(connId);
            const freshDbs = await ipc.schemaDatabases(connId);
            const freshDbData: { name: string; tables: string[]; columns: { [t: string]: string[] } }[] = [];

            dispatch({
              type: 'SET_SCHEMA',
              connectionId: connId,
              databases: freshDbs.map((name: string) => {
                // Keep existing cached columns while refreshing
                const cachedDb = cached?.databases?.find((d: any) => d.name === name);
                return { name, tables: cachedDb?.tables || [], columns: cachedDb?.columns || {}, loaded: false };
              }),
              loaded: true,
            });
            setExpandedConns(prev => new Set(prev).add(connId));

            for (const dbKey of savedDbs) {
              if (!dbKey.startsWith(connId + ':')) continue;
              const dbName = dbKey.split(':')[1];
              if (!freshDbs.includes(dbName)) continue;

              const tables = await ipc.schemaTables(connId, dbName);
              dispatch({ type: 'SET_TABLES', connectionId: connId, database: dbName, tables });
              setExpandedDbs(prev => new Set(prev).add(dbKey));

              // Fetch columns in background
              const columns = await ipc.schemaAllColumns(connId, dbName, tables).catch(() => ({}));
              dispatch({ type: 'SET_COLUMNS', connectionId: connId, database: dbName, columns });

              freshDbData.push({ name: dbName, tables, columns });
            }

            // Persist fresh data to cache
            await persistSchema(connId, freshDbData);
          } catch {
            // Connection failed — cached data still in use
          } finally {
            setConnecting(prev => { const s = new Set(prev); s.delete(connId); return s; });
          }
        })();
      }

      initialized.current = true;
    };
    init();

    const handler = () => { setContextMenu(null); setTableContextMenu(null); };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const loadConnections = async () => {
    const conns = await ipc.connectionList();
    dispatch({ type: 'SET_CONNECTIONS', connections: conns });
  };

  const handleRefreshAll = async () => {
    for (const connId of expandedConns) {
      const dbs = await ipc.schemaDatabases(connId);
      dispatch({
        type: 'SET_SCHEMA',
        connectionId: connId,
        databases: dbs.map((name: string) => ({ name, tables: [], columns: {}, loaded: false })),
        loaded: true,
      });
    }
  };

  const toggleConnection = async (conn: ConnectionConfig) => {
    if (expandedConns.has(conn.id)) {
      setExpandedConns(prev => { const s = new Set(prev); s.delete(conn.id); return s; });
      return;
    }

    setConnecting(prev => new Set(prev).add(conn.id));
    try {
      await ipc.connectionConnect(conn.id);
      const dbs = await ipc.schemaDatabases(conn.id);
      dispatch({
        type: 'SET_SCHEMA',
        connectionId: conn.id,
        databases: dbs.map((name: string) => ({ name, tables: [], columns: {}, loaded: false })),
        loaded: true,
      });
      setExpandedConns(prev => new Set(prev).add(conn.id));
    } catch (err: any) {
      alert(`Connection failed: ${err.message}`);
    } finally {
      setConnecting(prev => { const s = new Set(prev); s.delete(conn.id); return s; });
    }
  };

  const toggleDatabase = async (connectionId: string, dbName: string) => {
    const key = `${connectionId}:${dbName}`;
    if (expandedDbs.has(key)) {
      setExpandedDbs(prev => { const s = new Set(prev); s.delete(key); return s; });
      return;
    }

    setLoadingDbs(prev => new Set(prev).add(key));
    try {
      const tables = await ipc.schemaTables(connectionId, dbName);
      dispatch({ type: 'SET_TABLES', connectionId, database: dbName, tables });
      setExpandedDbs(prev => new Set(prev).add(key));

      // Background prefetch all column names for autocomplete + persist
      ipc.schemaAllColumns(connectionId, dbName, tables).then(async (columns: { [table: string]: string[] }) => {
        dispatch({ type: 'SET_COLUMNS', connectionId, database: dbName, columns });
        await persistSchema(connectionId, [{ name: dbName, tables, columns }]);
      }).catch(() => {});
    } finally {
      setLoadingDbs(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const handleTableClick = (conn: ConnectionConfig, database: string, table: string) => {
    openTab({
      connectionId: conn.id,
      connectionName: conn.name,
      connectionColor: conn.color,
      type: 'table',
      database,
      table,
    });
  };

  const handleContextMenu = (e: React.MouseEvent, connectionId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, connectionId });
  };

  const handleContextAction = async (action: string) => {
    if (!contextMenu) return;
    const conn = connections.find(c => c.id === contextMenu.connectionId);
    if (!conn) return;

    switch (action) {
      case 'edit':
        setEditingConnection(conn);
        setShowDialog(true);
        break;
      case 'delete':
        await ipc.connectionDelete(conn.id);
        loadConnections();
        break;
      case 'disconnect':
        await ipc.connectionDisconnect(conn.id);
        setExpandedConns(prev => { const s = new Set(prev); s.delete(conn.id); return s; });
        break;
      case 'console':
        openTab({
          connectionId: conn.id,
          connectionName: conn.name,
          connectionColor: conn.color,
          type: 'console',
        });
        break;
    }
    setContextMenu(null);
  };

  const handleImportDataGrip = async () => {
    const imported = await ipc.importDataGrip();
    if (imported.length === 0) {
      alert('No DataGrip MySQL/MariaDB connections found.');
      return;
    }
    const existing = await ipc.connectionList();
    const existingNames = new Set(existing.map((c: ConnectionConfig) => c.name));
    let added = 0;
    for (const conn of imported) {
      if (existingNames.has(conn.name)) continue;
      await ipc.connectionCreate(conn);
      added++;
    }
    alert(`Imported ${added} connection(s), skipped ${imported.length - added} duplicates. Passwords not imported — edit each connection to add them.`);
    loadConnections();
  };

  return (
    <div className="sidebar" style={{ width }}>
      <div className="sidebar-header">
        <input
          className="input sidebar-filter-input"
          placeholder="Filter tables..."
          value={tableFilter}
          onChange={e => setTableFilter(e.target.value)}
        />
        {tableFilter && <span className="sidebar-filter-clear" onClick={() => setTableFilter('')}>✕</span>}
        <button className="sidebar-btn" title="Add connection" onClick={() => { setEditingConnection(undefined); setShowDialog(true); }}>+</button>
        <button className="sidebar-btn" title="Refresh all" onClick={handleRefreshAll}>↻</button>
      </div>
      <div className="sidebar-tree">
        {[...connections].sort((a, b) => a.name.localeCompare(b.name)).map(conn => {
          const isConnActive = activeTab?.type === 'console' && activeTab.connectionId === conn.id;
          return (
          <div key={conn.id}>
            <div
              ref={isConnActive ? activeNodeRef : undefined}
              className={`tree-node ${isConnActive ? 'tree-node-active' : ''}`}
              onClick={() => toggleConnection(conn)}
              onContextMenu={(e) => handleContextMenu(e, conn.id)}
            >
              <span className="tree-arrow">{connecting.has(conn.id) ? '⏳' : expandedConns.has(conn.id) ? '▼' : '▶'}</span>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: conn.color, flexShrink: 0 }}></span>
              <span style={{ color: conn.color }}>{conn.name}</span>
            </div>

            {expandedConns.has(conn.id) && schema[conn.id]?.databases.map(db => (
              <div key={db.name} className="tree-node-indent">
                <div className="tree-node" onClick={() => toggleDatabase(conn.id, db.name)}>
                  <span className="tree-arrow">{loadingDbs.has(`${conn.id}:${db.name}`) ? '⏳' : expandedDbs.has(`${conn.id}:${db.name}`) ? '▼' : '▶'}</span>
                  <span>📁</span>
                  <span>{db.name}</span>
                </div>

                {expandedDbs.has(`${conn.id}:${db.name}`) && db.tables.filter(t => !tableFilter || t.toLowerCase().includes(tableFilter.toLowerCase())).map(table => {
                  const isActive = activeTab?.type === 'table' && activeTab.connectionId === conn.id && activeTab.database === db.name && activeTab.table === table;
                  return (
                    <div key={table} className="tree-node-indent" ref={isActive ? activeNodeRef : undefined}>
                      <div className={`tree-node ${isActive ? 'tree-node-active' : ''}`} onClick={() => handleTableClick(conn, db.name, table)} onContextMenu={(e) => { e.preventDefault(); setTableContextMenu({ x: e.clientX, y: e.clientY, conn, database: db.name, table }); }} title={table}>
                        <span style={{ width: 12 }}></span>
                        <span>📋</span>
                        <span>{table}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          );
        })}

      </div>

      {showDialog && (
        <ConnectionDialog
          connection={editingConnection}
          onClose={() => { setShowDialog(false); setEditingConnection(undefined); }}
          onSaved={loadConnections}
        />
      )}

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="context-menu-item" onClick={() => handleContextAction('console')}>Open SQL Console</div>
          <div className="context-menu-item" onClick={() => handleContextAction('edit')}>Edit</div>
          <div className="context-menu-item" onClick={() => handleContextAction('disconnect')}>Disconnect</div>
          <div className="context-menu-item" onClick={() => handleContextAction('delete')} style={{ color: '#ef4444' }}>Delete</div>
        </div>
      )}

      {tableContextMenu && (
        <div className="context-menu" style={{ left: tableContextMenu.x, top: tableContextMenu.y }}>
          <div className="context-menu-item" onClick={() => {
            openTab({ connectionId: tableContextMenu.conn.id, connectionName: tableContextMenu.conn.name, connectionColor: tableContextMenu.conn.color, type: 'table', database: tableContextMenu.database, table: tableContextMenu.table });
            setTableContextMenu(null);
          }}>Open Table</div>
          <div className="context-menu-item" onClick={() => {
            openTab({ connectionId: tableContextMenu.conn.id, connectionName: tableContextMenu.conn.name, connectionColor: tableContextMenu.conn.color, type: 'schema', database: tableContextMenu.database, table: tableContextMenu.table });
            setTableContextMenu(null);
          }}>View Schema</div>
        </div>
      )}
    </div>
  );
}
