import { useAppContext } from '../context/app-context';

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useAppContext();

  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'tab-active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-badge" style={{ backgroundColor: tab.connectionColor + '22', color: tab.connectionColor }}>
            {tab.connectionName.slice(0, 4)}
          </span>
          <span className="tab-label">
            {tab.type === 'console' ? '⌨️ SQL Console' : `📋 ${tab.table}`}
          </span>
          <span className="tab-close" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>✕</span>
        </div>
      ))}
    </div>
  );
}
