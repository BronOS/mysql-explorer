import { useState, useEffect } from 'react';
import ConnectionDialog from './ConnectionDialog';
import { useAppContext } from '../context/app-context';
import { useIpc } from '../hooks/use-ipc';
import { ConnectionConfig } from '../../shared/types';

export default function Sidebar() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | undefined>();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connectionId: string } | null>(null);
  const [expandedConns, setExpandedConns] = useState<Set<string>>(new Set());
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<Set<string>>(new Set());

  const { connections, schema, dispatch, openTab } = useAppContext();
  const ipc = useIpc();

  useEffect(() => {
    loadConnections();
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
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Connections</span>
        <button className="sidebar-refresh" title="Refresh all" onClick={handleRefreshAll}>↻</button>
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
              <span>🔌</span>
              <span>{conn.name}</span>
            </div>

            {expandedConns.has(conn.id) && schema[conn.id]?.databases.map(db => (
              <div key={db.name} className="tree-node-indent">
                <div className="tree-node" onClick={() => toggleDatabase(conn.id, db.name)}>
                  <span className="tree-arrow">{expandedDbs.has(`${conn.id}:${db.name}`) ? '▼' : '▶'}</span>
                  <span>📁</span>
                  <span>{db.name}</span>
                </div>

                {expandedDbs.has(`${conn.id}:${db.name}`) && db.tables.map(table => (
                  <div key={table} className="tree-node-indent">
                    <div className="tree-node" onClick={() => handleTableClick(conn, db.name, table)}>
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
