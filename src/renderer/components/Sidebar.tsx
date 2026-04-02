import { useState } from 'react';
import ConnectionDialog from './ConnectionDialog';
import { useAppContext } from '../context/app-context';
import { useIpc } from '../hooks/use-ipc';

export default function Sidebar() {
  const [showDialog, setShowDialog] = useState(false);
  const { connections, dispatch } = useAppContext();
  const ipc = useIpc();

  const refreshConnections = async () => {
    const conns = await ipc.connectionList();
    dispatch({ type: 'SET_CONNECTIONS', connections: conns });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Connections</span>
        <button className="sidebar-refresh" title="Refresh all" onClick={refreshConnections}>↻</button>
      </div>
      <div className="sidebar-tree">
        <button className="add-connection-btn" onClick={() => setShowDialog(true)}>+ Add Connection</button>
      </div>
      {showDialog && (
        <ConnectionDialog
          onClose={() => setShowDialog(false)}
          onSaved={refreshConnections}
        />
      )}
    </div>
  );
}
