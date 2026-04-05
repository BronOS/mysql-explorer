import { useState, useEffect, useRef } from 'react';
import { useAppContext } from './context/app-context';
import { getUiState, setUiState, loadUiStateAsync } from './hooks/use-ui-state';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import TableView from './components/TableView';
import SqlConsole from './components/SqlConsole';
import SchemaView from './components/SchemaView';
import SchemaObjectTab from './components/SchemaObjectTab';

function StatusBar() {
  const { status, tabs, activeTabId, connections } = useAppContext();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const conn = activeTab ? connections.find(c => c.id === activeTab.connectionId) : null;

  const statusColor = status?.type === 'error' ? '#ef4444' : status?.type === 'success' ? '#4ade80' : '#888';

  return (
    <div className="status-bar">
      <span className="status-left">
        {conn && <span style={{ color: conn.color }}>{conn.name}</span>}
        {activeTab?.type === 'table' && <span> — {activeTab.database}.{activeTab.table}</span>}
        {activeTab?.type === 'console' && <span> — SQL Console</span>}
        {activeTab?.type === 'object' && <span> — {activeTab.objectType}: {activeTab.objectName || '(new)'}</span>}
      </span>
      <span className="status-center" style={{ color: statusColor }}>
        {status?.text || ''}
      </span>
      <span className="status-right">
        {tabs.length > 0 && <span>{tabs.length} tab{tabs.length !== 1 ? 's' : ''}</span>}
      </span>
    </div>
  );
}

export default function App() {
  const { tabs, activeTabId, setActiveTab } = useAppContext();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const dragging = useRef(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setSidebarWidth(Math.max(160, Math.min(e.clientX, 500)));
    };
    const handleMouseUp = () => { dragging.current = false; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Load sidebar width from disk
  const sidebarLoaded = useRef(false);
  useEffect(() => {
    loadUiStateAsync().then(s => {
      if (s.sidebarWidth) setSidebarWidth(s.sidebarWidth);
      sidebarLoaded.current = true;
    });
  }, []);

  useEffect(() => {
    if (sidebarLoaded.current) setUiState('sidebarWidth', sidebarWidth);
  }, [sidebarWidth]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Tab / Ctrl+Shift+Tab to switch tabs
      if (e.ctrlKey && e.key === 'Tab' && tabs.length > 1) {
        e.preventDefault();
        const currentIdx = tabs.findIndex(t => t.id === activeTabId);
        const nextIdx = e.shiftKey
          ? (currentIdx - 1 + tabs.length) % tabs.length
          : (currentIdx + 1) % tabs.length;
        setActiveTab(tabs[nextIdx].id);
      }
      // Block browser Cmd+A except in inputs, textareas, and CodeMirror
      if ((e.metaKey || e.ctrlKey) && e.key === 'a') {
        const tag = (e.target as HTMLElement).tagName;
        const isCM = (e.target as HTMLElement).closest('.cm-editor');
        if (tag !== 'INPUT' && tag !== 'TEXTAREA' && !isCM) {
          e.preventDefault();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown, true); // capture phase
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [tabs, activeTabId, setActiveTab]);

  return (
    <div className="app">
      <div className="app-body">
      <Sidebar width={sidebarWidth} />
      <div
        className="sidebar-resizer"
        onMouseDown={() => { dragging.current = true; document.body.style.cursor = 'col-resize'; }}
      />
      <div className="main-area">
        <TabBar />
        <div className="main-content">
          {tabs.length === 0 && (
            <div className="empty-state">Select a table or open a SQL Console</div>
          )}
          {tabs.map(tab => (
            <div key={tab.id} className="tab-panel" style={{ display: tab.id === activeTabId ? 'flex' : 'none' }}>
              {tab.type === 'table' && <TableView tab={tab} isActive={tab.id === activeTabId} readOnly={tab.objectType === 'view'} />}
              {tab.type === 'console' && <SqlConsole tab={tab} isActive={tab.id === activeTabId} />}
              {tab.type === 'schema' && <SchemaView tab={tab} isActive={tab.id === activeTabId} />}
              {tab.type === 'object' && <SchemaObjectTab tab={tab} isActive={tab.id === activeTabId} />}
            </div>
          ))}
        </div>
      </div>
      </div>
      <StatusBar />
    </div>
  );
}
