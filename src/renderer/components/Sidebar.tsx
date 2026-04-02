import { useState, useEffect } from 'react';
import ConnectionDialog from './ConnectionDialog';
import { useAppContext } from '../context/app-context';
import { useIpc } from '../hooks/use-ipc';
import { ConnectionConfig } from '../../shared/types';

export default function Sidebar({ width }: { width: number }) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | undefined>();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connectionId: string } | null>(null);
  const [expandedConns, setExpandedConns] = useState<Set<string>>(new Set());
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<Set<string>>(new Set());
  const [tableFilter, setTableFilter] = useState('');

  const { connections, schema, dispatch, openTab } = useAppContext();
  const ipc = useIpc();

  // Persist expanded connections
  useEffect(() => {
    localStorage.setItem('expandedConns', JSON.stringify([...expandedConns]));
  }, [expandedConns]);

  useEffect(() => {
    localStorage.setItem('expandedDbs', JSON.stringify([...expandedDbs]));
  }, [expandedDbs]);

  // Load connections and auto-reconnect previously expanded ones
  useEffect(() => {
    const init = async () => {
      const conns = await ipc.connectionList();
      dispatch({ type: 'SET_CONNECTIONS', connections: conns });

      // Restore expanded connections
      try {
        const savedConns: string[] = JSON.parse(localStorage.getItem('expandedConns') || '[]');
        const savedDbs: string[] = JSON.parse(localStorage.getItem('expandedDbs') || '[]');

        for (const connId of savedConns) {
          const conn = conns.find((c: ConnectionConfig) => c.id === connId);
          if (!conn) continue;
          setConnecting(prev => new Set(prev).add(connId));
          try {
            await ipc.connectionConnect(connId);
            const dbs = await ipc.schemaDatabases(connId);
            dispatch({
              type: 'SET_SCHEMA',
              connectionId: connId,
              databases: dbs.map((name: string) => ({ name, tables: [], loaded: false })),
              loaded: true,
            });
            setExpandedConns(prev => new Set(prev).add(connId));

            // Restore expanded databases
            for (const dbKey of savedDbs) {
              if (!dbKey.startsWith(connId + ':')) continue;
              const dbName = dbKey.split(':')[1];
              const tables = await ipc.schemaTables(connId, dbName);
              dispatch({ type: 'SET_TABLES', connectionId: connId, database: dbName, tables });
              setExpandedDbs(prev => new Set(prev).add(dbKey));
            }
          } catch {
            // Connection failed, skip silently
          } finally {
            setConnecting(prev => { const s = new Set(prev); s.delete(connId); return s; });
          }
        }
      } catch {}
    };
    init();

    const handler = () => setContextMenu(null);
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
        databases: dbs.map((name: string) => ({ name, tables: [], loaded: false })),
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
        databases: dbs.map((name: string) => ({ name, tables: [], loaded: false })),
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

    const tables = await ipc.schemaTables(connectionId, dbName);
    dispatch({ type: 'SET_TABLES', connectionId, database: dbName, tables });
    setExpandedDbs(prev => new Set(prev).add(key));
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

  return (
    <div className="sidebar" style={{ width }}>
      <div className="sidebar-header">
        <span className="sidebar-title">Connections</span>
        <button className="sidebar-refresh" title="Refresh all" onClick={handleRefreshAll}>↻</button>
      </div>
      <div className="sidebar-filter">
        <input
          className="input"
          placeholder="Filter tables..."
          value={tableFilter}
          onChange={e => setTableFilter(e.target.value)}
          style={{ padding: '4px 8px', fontSize: 11 }}
        />
        {tableFilter && <span className="sidebar-filter-clear" onClick={() => setTableFilter('')}>✕</span>}
      </div>
      <div className="sidebar-tree">
        {connections.map(conn => (
          <div key={conn.id}>
            <div
              className="tree-node"
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
                  <span className="tree-arrow">{expandedDbs.has(`${conn.id}:${db.name}`) ? '▼' : '▶'}</span>
                  <span>📁</span>
                  <span>{db.name}</span>
                </div>

                {expandedDbs.has(`${conn.id}:${db.name}`) && db.tables.filter(t => !tableFilter || t.toLowerCase().includes(tableFilter.toLowerCase())).map(table => (
                  <div key={table} className="tree-node-indent">
                    <div className="tree-node" onClick={() => handleTableClick(conn, db.name, table)} title={table}>
                      <span style={{ width: 12 }}></span>
                      <span>📋</span>
                      <span>{table}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

        <button className="add-connection-btn" onClick={() => { setEditingConnection(undefined); setShowDialog(true); }}>
          + Add Connection
        </button>
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
    </div>
  );
}
