import { useState, useEffect, useCallback, useLayoutEffect, useRef } from 'react';
import { useIpc } from '../hooks/use-ipc';

interface ProcessRow {
  Id: number;
  User: string;
  Host: string;
  db: string | null;
  Command: string;
  Time: number;
  State: string | null;
  Info: string | null;
}

interface ContextMenu {
  x: number;
  y: number;
  processId: number;
}

interface Props {
  connectionId: string;
  refreshTrigger: number;
}

export default function MonitorProcesslist({ connectionId, refreshTrigger }: Props) {
  const ipc = useIpc();
  const [rows, setRows] = useState<ProcessRow[]>([]);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [menuPos, setMenuPos] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const fetchProcesslist = useCallback(async () => {
    try {
      const result = await ipc.monitorProcesslist(connectionId);
      setRows(result as ProcessRow[]);
    } catch {
      setRows([]);
    }
  }, [connectionId, ipc]);

  useEffect(() => {
    fetchProcesslist();
  }, [fetchProcesslist, refreshTrigger]);

  useEffect(() => {
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  useLayoutEffect(() => {
    if (contextMenu && menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const left = contextMenu.x + rect.width > window.innerWidth ? window.innerWidth - rect.width - 4 : contextMenu.x;
      const top = contextMenu.y + rect.height > window.innerHeight ? contextMenu.y - rect.height : contextMenu.y;
      setMenuPos({ left, top });
    }
  }, [contextMenu]);

  const killQuery = async (id: number) => {
    if (confirm(`Kill query ID ${id}?`)) {
      await ipc.monitorKillQuery(connectionId, id);
      await fetchProcesslist();
    }
  };

  const killConnection = async (id: number) => {
    if (confirm(`Kill connection ID ${id}? This will terminate the entire connection.`)) {
      await ipc.monitorKillConnection(connectionId, id);
      await fetchProcesslist();
    }
  };

  const getTimeStyle = (time: number): React.CSSProperties => {
    if (time > 30) return { color: 'var(--danger)' };
    if (time > 5) return { color: 'var(--warning)' };
    return {};
  };

  return (
    <div className="datagrid-container">
      <div className="datagrid-header">
        <table className="datagrid">
          <thead>
            <tr>
              <th>ID</th>
              <th>User</th>
              <th>Host</th>
              <th>DB</th>
              <th>Command</th>
              <th>Time</th>
              <th>State</th>
              <th>Info</th>
              <th>Actions</th>
            </tr>
          </thead>
        </table>
      </div>
      <div className="datagrid-wrapper">
        <table className="datagrid">
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.Id}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({ x: e.clientX, y: e.clientY, processId: row.Id });
                }}
              >
                <td>{row.Id}</td>
                <td>{row.User}</td>
                <td>{row.Host}</td>
                <td>{row.db ?? ''}</td>
                <td>{row.Command}</td>
                <td style={getTimeStyle(row.Time)}>{row.Time}</td>
                <td>{row.State ?? ''}</td>
                <td style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.Info ?? ''}>
                  {row.Info ?? ''}
                </td>
                <td>
                  <button
                    className="btn btn-secondary"
                    style={{ color: 'var(--danger)', fontSize: 11, padding: '2px 8px' }}
                    onClick={() => killQuery(row.Id)}
                  >
                    Kill
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {contextMenu && (
        <div
          ref={menuRef}
          className="context-menu"
          style={{ left: menuPos.left, top: menuPos.top }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="context-menu-item"
            onClick={() => {
              const id = contextMenu.processId;
              setContextMenu(null);
              killQuery(id);
            }}
          >
            Kill Query
          </div>
          <div
            className="context-menu-item"
            style={{ color: 'var(--danger)' }}
            onClick={() => {
              const id = contextMenu.processId;
              setContextMenu(null);
              killConnection(id);
            }}
          >
            Kill Connection
          </div>
        </div>
      )}
    </div>
  );
}
