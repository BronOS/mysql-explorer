import { useState, useEffect, useRef } from 'react';
import { useAppContext } from './context/app-context';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import TableView from './components/TableView';
import SqlConsole from './components/SqlConsole';

export default function App() {
  const { tabs, activeTabId } = useAppContext();
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
          {!activeTab && (
            <div className="empty-state">Select a table or open a SQL Console</div>
          )}
          {activeTab?.type === 'table' && <TableView tab={activeTab} />}
          {activeTab?.type === 'console' && <SqlConsole tab={activeTab} />}
        </div>
      </div>
    </div>
  );
}
