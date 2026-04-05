import { useState, useEffect, useRef, useLayoutEffect } from 'react';
import ConnectionDialog from './ConnectionDialog';
import CreateTableDialog from './CreateTableDialog';
import CreateDatabaseDialog from './CreateDatabaseDialog';
import ImportSqlDialog from './ImportSqlDialog';
import ExportTableDialog from './ExportTableDialog';
import ExportDatabaseDialog from './ExportDatabaseDialog';
import { useAppContext } from '../context/app-context';
import { useIpc } from '../hooks/use-ipc';
import { ConnectionConfig } from '../../shared/types';
import { setUiState, loadUiStateAsync } from '../hooks/use-ui-state';

function menuPosition(x: number, y: number, menuHeight: number = 120): { left: number; top: number } {
  const left = x + 180 > window.innerWidth ? window.innerWidth - 184 : x;
  const top = y + menuHeight > window.innerHeight ? y - menuHeight : y;
  return { left, top };
}

export default function Sidebar({ width }: { width: number }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | undefined>();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connectionId: string } | null>(null);
  const [tableContextMenu, setTableContextMenu] = useState<{ x: number; y: number; conn: ConnectionConfig; database: string; table: string } | null>(null);
  const [dbContextMenu, setDbContextMenu] = useState<{ x: number; y: number; conn: ConnectionConfig; database: string } | null>(null);
  const [showCreateTable, setShowCreateTable] = useState<{ connectionId: string; database: string; conn: ConnectionConfig } | null>(null);
  const [showCreateDatabase, setShowCreateDatabase] = useState<{ connectionId: string } | null>(null);
  const [showImport, setShowImport] = useState<{ connectionId: string; database?: string } | null>(null);
  const [showExportTable, setShowExportTable] = useState<{ connectionId: string; database: string; table: string } | null>(null);
  const [showExportDb, setShowExportDb] = useState<{ connectionId: string; database: string } | null>(null);
  const [expandedConns, setExpandedConns] = useState<Set<string>>(new Set());
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<Set<string>>(new Set());
  const [loadingDbs, setLoadingDbs] = useState<Set<string>>(new Set());
  const [tableFilter, setTableFilter] = useState('');
  const [expandedObjectGroups, setExpandedObjectGroups] = useState<Set<string>>(new Set());
  const [objectContextMenu, setObjectContextMenu] = useState<{ x: number; y: number; conn: ConnectionConfig; database: string; objectType: 'view' | 'procedure' | 'function' | 'trigger' | 'event'; objectName: string } | null>(null);
  const [objectGroupContextMenu, setObjectGroupContextMenu] = useState<{ x: number; y: number; conn: ConnectionConfig; database: string; objectType: 'view' | 'procedure' | 'function' | 'trigger' | 'event' } | null>(null);
  const initialized = useRef(false);

  const { connections, schema, dispatch, openTab, closeTab, setStatus, tabs, activeTabId } = useAppContext();
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
              views: db.views || [],
              procedures: db.procedures || [],
              functions: db.functions || [],
              triggers: db.triggers || [],
              events: db.events || [],
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
                return { name, tables: cachedDb?.tables || [], columns: cachedDb?.columns || {}, views: [], procedures: [], functions: [], triggers: [], events: [], loaded: false };
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

              // Fetch schema object counts
              for (const [objType, fetcher] of Object.entries(objectTypeIpcMap)) {
                const plural = objectTypePluralMap[objType];
                (ipc as any)[fetcher](connId, dbName).then((items: string[]) => {
                  dispatch({ type: 'SET_OBJECTS', connectionId: connId, database: dbName, objectType: plural, items });
                }).catch(() => {});
              }

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

    const handler = () => { setContextMenu(null); setTableContextMenu(null); setDbContextMenu(null); setObjectContextMenu(null); setObjectGroupContextMenu(null); };
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
        databases: dbs.map((name: string) => ({ name, tables: [], columns: {}, views: [], procedures: [], functions: [], triggers: [], events: [], loaded: false })),
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
        databases: dbs.map((name: string) => ({ name, tables: [], columns: {}, views: [], procedures: [], functions: [], triggers: [], events: [], loaded: false })),
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

      // Background prefetch schema object counts
      for (const [objType, fetcher] of Object.entries(objectTypeIpcMap)) {
        const plural = objectTypePluralMap[objType];
        (ipc as any)[fetcher](connectionId, dbName).then((items: string[]) => {
          dispatch({ type: 'SET_OBJECTS', connectionId, database: dbName, objectType: plural, items });
        }).catch(() => {});
      }
    } finally {
      setLoadingDbs(prev => { const s = new Set(prev); s.delete(key); return s; });
    }
  };

  const objectTypeIpcMap: Record<string, string> = {
    view: 'schemaViews',
    procedure: 'schemaProcedures',
    function: 'schemaFunctions',
    trigger: 'schemaTriggers',
    event: 'schemaEvents',
  };

  const objectTypePluralMap: Record<string, 'views' | 'procedures' | 'functions' | 'triggers' | 'events'> = {
    view: 'views',
    procedure: 'procedures',
    function: 'functions',
    trigger: 'triggers',
    event: 'events',
  };

  const toggleObjectGroup = async (connectionId: string, database: string, objectType: string) => {
    const key = `${connectionId}:${database}:${objectType}`;
    if (expandedObjectGroups.has(key)) {
      setExpandedObjectGroups(prev => { const s = new Set(prev); s.delete(key); return s; });
      return;
    }
    const fetcher = objectTypeIpcMap[objectType];
    const plural = objectTypePluralMap[objectType];
    try {
      const items: string[] = await (ipc as any)[fetcher](connectionId, database);
      dispatch({ type: 'SET_OBJECTS', connectionId, database, objectType: plural, items });
    } catch {}
    setExpandedObjectGroups(prev => new Set(prev).add(key));
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
      case 'new-database':
        setShowCreateDatabase({ connectionId: conn.id });
        break;
      case 'import-sql':
        setShowImport({ connectionId: conn.id });
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
                <div className="tree-node" onClick={() => toggleDatabase(conn.id, db.name)} onContextMenu={(e) => { e.preventDefault(); setDbContextMenu({ x: e.clientX, y: e.clientY, conn, database: db.name }); }}>
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
                {expandedDbs.has(`${conn.id}:${db.name}`) && ['view', 'procedure', 'function', 'trigger', 'event'].map(objType => {
                  const plural = objType === 'procedure' ? 'procedures' : objType === 'function' ? 'functions' : objType === 'trigger' ? 'triggers' : objType === 'event' ? 'events' : 'views';
                  const label = plural.charAt(0).toUpperCase() + plural.slice(1);
                  const items: string[] = (db as any)[plural] || [];
                  const groupKey = `${conn.id}:${db.name}:${objType}`;
                  const isGroupExpanded = expandedObjectGroups.has(groupKey);
                  return (
                    <div key={objType} className="tree-node-indent">
                      <div
                        className="tree-node"
                        style={{ opacity: items.length === 0 && !isGroupExpanded ? 0.4 : 1 }}
                        onClick={() => toggleObjectGroup(conn.id, db.name, objType)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setObjectGroupContextMenu({ x: e.clientX, y: e.clientY, conn, database: db.name, objectType: objType as any });
                        }}
                      >
                        <span className="tree-arrow">{isGroupExpanded ? '▼' : '▶'}</span>
                        <span>{label} ({items.length})</span>
                      </div>
                      {isGroupExpanded && items.map(name => {
                        const isObjActive = activeTab?.type === 'object' && activeTab.connectionId === conn.id && activeTab.database === db.name && activeTab.objectName === name && activeTab.objectType === objType;
                        return (
                          <div key={name} className="tree-node-indent">
                            <div
                              className={`tree-node ${isObjActive ? 'tree-node-active' : ''}`}
                              onClick={() => openTab({ connectionId: conn.id, connectionName: conn.name, connectionColor: conn.color, type: 'object', database: db.name, objectType: objType as any, objectName: name })}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setObjectContextMenu({ x: e.clientX, y: e.clientY, conn, database: db.name, objectType: objType as any, objectName: name });
                              }}
                            >
                              <span style={{ width: 12 }}></span>
                              <span>{name}</span>
                            </div>
                          </div>
                        );
                      })}
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
        <div className="context-menu" style={menuPosition(contextMenu.x, contextMenu.y, expandedConns.has(contextMenu.connectionId) ? 200 : 130)}>
          <div className="context-menu-item" onClick={() => handleContextAction('console')}>Open SQL Console</div>
          {expandedConns.has(contextMenu.connectionId) && (
            <div className="context-menu-item" onClick={() => handleContextAction('new-database')}>New Database</div>
          )}
          {expandedConns.has(contextMenu.connectionId) && (
            <div className="context-menu-item" onClick={() => handleContextAction('import-sql')}>Import SQL</div>
          )}
          <div className="context-menu-item" onClick={() => handleContextAction('edit')}>Edit</div>
          <div className="context-menu-item" onClick={() => handleContextAction('disconnect')}>Disconnect</div>
          <div className="context-menu-item" onClick={() => handleContextAction('delete')} style={{ color: '#ef4444' }}>Delete</div>
        </div>
      )}

      {tableContextMenu && (
        <div className="context-menu" style={menuPosition(tableContextMenu.x, tableContextMenu.y, 140)}>
          <div className="context-menu-item" onClick={() => {
            openTab({ connectionId: tableContextMenu.conn.id, connectionName: tableContextMenu.conn.name, connectionColor: tableContextMenu.conn.color, type: 'table', database: tableContextMenu.database, table: tableContextMenu.table });
            setTableContextMenu(null);
          }}>Open Table</div>
          <div className="context-menu-item" onClick={() => {
            openTab({ connectionId: tableContextMenu.conn.id, connectionName: tableContextMenu.conn.name, connectionColor: tableContextMenu.conn.color, type: 'schema', database: tableContextMenu.database, table: tableContextMenu.table });
            setTableContextMenu(null);
          }}>View Schema</div>
          <div className="context-menu-item" onClick={() => {
            setShowExportTable({ connectionId: tableContextMenu.conn.id, database: tableContextMenu.database, table: tableContextMenu.table });
            setTableContextMenu(null);
          }}>Export Table</div>
          <div className="context-menu-item" style={{ color: '#ef4444' }} onClick={async () => {
            const { conn, database, table } = tableContextMenu;
            setTableContextMenu(null);
            if (!confirm(`Drop table \`${table}\`? This cannot be undone.`)) return;
            try {
              await ipc.schemaDropTable(conn.id, database, table);
              // Close any open tabs for this table
              tabs.filter(t => t.connectionId === conn.id && t.database === database && t.table === table)
                .forEach(t => closeTab(t.id));
              // Refresh tables in sidebar
              const tables = await ipc.schemaTables(conn.id, database);
              dispatch({ type: 'SET_TABLES', connectionId: conn.id, database, tables });
              setStatus(`Dropped table ${table}`, 'success');
            } catch (e: any) {
              setStatus(`Drop table failed: ${e?.message ?? e}`, 'error');
            }
          }}>Delete Table</div>
        </div>
      )}

      {dbContextMenu && (
        <div className="context-menu" style={menuPosition(dbContextMenu.x, dbContextMenu.y, 140)}>
          <div className="context-menu-item" onClick={() => {
            setShowCreateTable({ connectionId: dbContextMenu.conn.id, database: dbContextMenu.database, conn: dbContextMenu.conn });
            setDbContextMenu(null);
          }}>New Table</div>
          <div className="context-menu-item" onClick={() => {
            setShowImport({ connectionId: dbContextMenu.conn.id, database: dbContextMenu.database });
            setDbContextMenu(null);
          }}>Import SQL</div>
          <div className="context-menu-item" onClick={() => {
            setShowExportDb({ connectionId: dbContextMenu.conn.id, database: dbContextMenu.database });
            setDbContextMenu(null);
          }}>Export Database</div>
          <div className="context-menu-item" style={{ color: '#ef4444' }} onClick={async () => {
            const { conn, database } = dbContextMenu;
            setDbContextMenu(null);
            if (!confirm(`Drop database \`${database}\`? All tables will be permanently deleted. This cannot be undone.`)) return;
            try {
              await ipc.schemaDropDatabase(conn.id, database);
              // Close any open tabs for this database
              tabs.filter(t => t.connectionId === conn.id && t.database === database)
                .forEach(t => closeTab(t.id));
              // Collapse the database in sidebar
              setExpandedDbs(prev => { const s = new Set(prev); s.delete(`${conn.id}:${database}`); return s; });
              // Refresh databases
              const dbs = await ipc.schemaDatabases(conn.id);
              dispatch({
                type: 'SET_SCHEMA',
                connectionId: conn.id,
                databases: dbs.map((name: string) => ({ name, tables: [], columns: {}, views: [], procedures: [], functions: [], triggers: [], events: [], loaded: false })),
                loaded: true,
              });
              setStatus(`Dropped database ${database}`, 'success');
            } catch (e: any) {
              setStatus(`Drop database failed: ${e?.message ?? e}`, 'error');
            }
          }}>Delete Database</div>
        </div>
      )}

      {objectGroupContextMenu && (
        <div className="context-menu" style={menuPosition(objectGroupContextMenu.x, objectGroupContextMenu.y, 35)}>
          <div className="context-menu-item" onClick={() => {
            const { conn, database, objectType } = objectGroupContextMenu;
            openTab({ connectionId: conn.id, connectionName: conn.name, connectionColor: conn.color, type: 'object', database, objectType });
            setObjectGroupContextMenu(null);
          }}>New {objectGroupContextMenu.objectType.charAt(0).toUpperCase() + objectGroupContextMenu.objectType.slice(1)}</div>
        </div>
      )}

      {objectContextMenu && (
        <div className="context-menu" style={menuPosition(objectContextMenu.x, objectContextMenu.y, 70)}>
          <div className="context-menu-item" onClick={() => {
            const { conn, database, objectType, objectName } = objectContextMenu;
            openTab({ connectionId: conn.id, connectionName: conn.name, connectionColor: conn.color, type: 'object', database, objectType, objectName });
            setObjectContextMenu(null);
          }}>Open</div>
          <div className="context-menu-item" style={{ color: '#ef4444' }} onClick={async () => {
            const { conn, database, objectType, objectName } = objectContextMenu;
            const typeSql = objectType.toUpperCase();
            setObjectContextMenu(null);
            if (!confirm(`Drop ${objectType} \`${objectName}\`? This cannot be undone.`)) return;
            try {
              await ipc.schemaDropObject(conn.id, database, typeSql, objectName);
              tabs.filter(t => t.connectionId === conn.id && t.database === database && t.objectType === objectType && t.objectName === objectName)
                .forEach(t => closeTab(t.id));
              const plural = objectType === 'procedure' ? 'procedures' : objectType === 'function' ? 'functions' : objectType === 'trigger' ? 'triggers' : objectType === 'event' ? 'events' : 'views';
              const fetcher = objectType === 'view' ? 'schemaViews' : objectType === 'procedure' ? 'schemaProcedures' : objectType === 'function' ? 'schemaFunctions' : objectType === 'trigger' ? 'schemaTriggers' : 'schemaEvents';
              const items: string[] = await (ipc as any)[fetcher](conn.id, database);
              dispatch({ type: 'SET_OBJECTS', connectionId: conn.id, database, objectType: plural, items });
              setStatus(`Dropped ${objectType} ${objectName}`, 'success');
            } catch (e: any) {
              setStatus(`Drop failed: ${e?.message ?? e}`, 'error');
            }
          }}>Drop</div>
        </div>
      )}

      {showCreateTable && (
        <CreateTableDialog
          connectionId={showCreateTable.connectionId}
          database={showCreateTable.database}
          onCreated={async (tableName) => {
            // Refresh tables in sidebar
            const tables = await ipc.schemaTables(showCreateTable.connectionId, showCreateTable.database);
            dispatch({ type: 'SET_TABLES', connectionId: showCreateTable.connectionId, database: showCreateTable.database, tables });
            // Open schema tab for the new table
            openTab({
              connectionId: showCreateTable.connectionId,
              connectionName: showCreateTable.conn.name,
              connectionColor: showCreateTable.conn.color,
              type: 'schema',
              database: showCreateTable.database,
              table: tableName,
            });
          }}
          onClose={() => setShowCreateTable(null)}
        />
      )}

      {showCreateDatabase && (
        <CreateDatabaseDialog
          connectionId={showCreateDatabase.connectionId}
          onCreated={async () => {
            // Refresh databases in sidebar
            const dbs = await ipc.schemaDatabases(showCreateDatabase.connectionId);
            dispatch({
              type: 'SET_SCHEMA',
              connectionId: showCreateDatabase.connectionId,
              databases: dbs.map((name: string) => ({ name, tables: [], columns: {}, views: [], procedures: [], functions: [], triggers: [], events: [], loaded: false })),
              loaded: true,
            });
          }}
          onClose={() => setShowCreateDatabase(null)}
        />
      )}

      {showImport && (
        <ImportSqlDialog
          connectionId={showImport.connectionId}
          database={showImport.database}
          onClose={() => setShowImport(null)}
          onDone={async () => {
            // Refresh schema after import
            if (showImport.database) {
              const tables = await ipc.schemaTables(showImport.connectionId, showImport.database);
              dispatch({ type: 'SET_TABLES', connectionId: showImport.connectionId, database: showImport.database, tables });
            }
          }}
        />
      )}

      {showExportTable && (
        <ExportTableDialog
          connectionId={showExportTable.connectionId}
          database={showExportTable.database}
          table={showExportTable.table}
          onClose={() => setShowExportTable(null)}
        />
      )}

      {showExportDb && (
        <ExportDatabaseDialog
          connectionId={showExportDb.connectionId}
          database={showExportDb.database}
          onClose={() => setShowExportDb(null)}
        />
      )}
    </div>
  );
}
