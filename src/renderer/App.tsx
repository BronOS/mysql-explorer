import { useState, useEffect, useRef } from 'react';
import { useAppContext } from './context/app-context';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import TableView from './components/TableView';
import SqlConsole from './components/SqlConsole';

export default function App() {
  const { tabs, activeTabId, setActiveTab } = useAppContext();
  const activeTab = tabs.find(t => t.id === activeTabId);
  const [sidebarWidth, setSidebarWidth] = useState(() => Number(localStorage.getItem('sidebarWidth')) || 240);
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

  useEffect(() => {
    localStorage.setItem('sidebarWidth', String(sidebarWidth));
  }, [sidebarWidth]);

  // Ctrl+Tab / Ctrl+Shift+Tab to switch tabs
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'Tab' && tabs.length > 1) {
        e.preventDefault();
        const currentIdx = tabs.findIndex(t => t.id === activeTabId);
        const nextIdx = e.shiftKey
          ? (currentIdx - 1 + tabs.length) % tabs.length
          : (currentIdx + 1) % tabs.length;
        setActiveTab(tabs[nextIdx].id);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tabs, activeTabId, setActiveTab]);

  return (
    <div className="app">
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
              {tab.type === 'table' && <TableView tab={tab} />}
              {tab.type === 'console' && <SqlConsole tab={tab} />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
