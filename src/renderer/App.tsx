import { useAppContext } from './context/app-context';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';
import TableView from './components/TableView';

export default function App() {
  const { tabs, activeTabId } = useAppContext();
  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="app">
      <Sidebar />
      <div className="main-area">
        <TabBar />
        <div className="main-content">
          {!activeTab && (
            <div className="empty-state">Select a table or open a SQL Console</div>
          )}
          {activeTab?.type === 'table' && <TableView tab={activeTab} />}
          {activeTab?.type === 'console' && (
            <div className="placeholder">SQL Console: {activeTab.connectionName}</div>
          )}
        </div>
      </div>
    </div>
  );
}
