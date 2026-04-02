import { useState } from 'react';
import { useAppContext } from '../context/app-context';
import { useIpc } from '../hooks/use-ipc';

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Connections</span>
        <button className="sidebar-refresh" title="Refresh all">↻</button>
      </div>
      <div className="sidebar-tree">
        <button className="add-connection-btn">+ Add Connection</button>
      </div>
    </div>
  );
}
