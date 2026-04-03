import { useState, useRef } from 'react';
import { useAppContext } from '../context/app-context';

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab, dispatch } = useAppContext();
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const dragIdx = useRef<number | null>(null);

  if (tabs.length === 0) return null;

  const handleDragStart = (idx: number, e: React.DragEvent) => {
    dragIdx.current = idx;
    e.dataTransfer.effectAllowed = 'move';
    // Make the drag image semi-transparent
    if (e.currentTarget instanceof HTMLElement) {
      e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
    }
  };

  const handleDragOver = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragIdx.current !== null && dragIdx.current !== idx) {
      setDragOverIdx(idx);
    }
  };

  const handleDrop = (idx: number, e: React.DragEvent) => {
    e.preventDefault();
    if (dragIdx.current !== null && dragIdx.current !== idx) {
      dispatch({ type: 'REORDER_TABS', fromIndex: dragIdx.current, toIndex: idx });
    }
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  const handleDragEnd = () => {
    dragIdx.current = null;
    setDragOverIdx(null);
  };

  return (
    <div className="tab-bar">
      {tabs.map((tab, idx) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'tab-active' : ''} ${dragOverIdx === idx ? 'tab-drag-over' : ''}`}
          onClick={() => setActiveTab(tab.id)}
          draggable
          onDragStart={(e) => handleDragStart(idx, e)}
          onDragOver={(e) => handleDragOver(idx, e)}
          onDrop={(e) => handleDrop(idx, e)}
          onDragEnd={handleDragEnd}
          onDragLeave={() => setDragOverIdx(null)}
        >
          <span className="tab-close" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>✕</span>
          <span className="tab-badge" style={{ backgroundColor: tab.connectionColor + '22', color: tab.connectionColor }}>
            {tab.connectionName.slice(0, 4)}
          </span>
          <span className="tab-label">
            {tab.type === 'console' ? '⌨️ SQL Console' : `📋 ${tab.table}`}
          </span>
        </div>
      ))}
    </div>
  );
}
