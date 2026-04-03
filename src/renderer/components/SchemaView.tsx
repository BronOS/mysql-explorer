import { useState, useEffect, useRef, useCallback } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { setUiState, loadUiStateAsync } from '../hooks/use-ui-state';
import { TabInfo, FullColumnInfo } from '../../shared/types';
import { ColumnInfo } from './IndexDialog';
import SchemaColumns from './SchemaColumns';
import SchemaIndexes from './SchemaIndexes';
import SchemaDDL from './SchemaDDL';

interface Props {
  tab: TabInfo;
  isActive?: boolean;
}

export default function SchemaView({ tab, isActive }: Props) {
  const ipc = useIpc();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [columnInfos, setColumnInfos] = useState<ColumnInfo[]>([]);

  // Divider positions (pixels from top of container)
  const [divider1, setDivider1] = useState(300);
  const [divider2, setDivider2] = useState(500);
  const dragging = useRef<1 | 2 | null>(null);
  const dividersLoaded = useRef(false);

  // Load divider positions from disk
  useEffect(() => {
    loadUiStateAsync().then(s => {
      if (s.schemaDivider1) setDivider1(s.schemaDivider1);
      if (s.schemaDivider2) setDivider2(s.schemaDivider2);
      dividersLoaded.current = true;
    });
  }, []);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSchemaChanged = () => {
    setRefreshTrigger(prev => prev + 1);
    // Refresh column names for index dialog
    ipc.schemaFullColumns(tab.connectionId, tab.database!, tab.table!)
      .then((cols: FullColumnInfo[]) => setColumnInfos(cols.map(c => ({ name: c.field, type: c.type }))))
      .catch(() => {});
  };

  // Load column names when tab becomes active
  const colNamesLoaded = useRef(false);
  useEffect(() => {
    if (!isActive || colNamesLoaded.current) return;
    colNamesLoaded.current = true;
    ipc.schemaFullColumns(tab.connectionId, tab.database!, tab.table!)
      .then((cols: FullColumnInfo[]) => setColumnInfos(cols.map(c => ({ name: c.field, type: c.type }))))
      .catch(() => {});
  }, [isActive, tab.connectionId, tab.database, tab.table]);

  // Cmd+R refresh
  useEffect(() => {
    if (!isActive) return;
    return window.electronAPI.onRefresh(() => handleSchemaChanged());
  }, [isActive]);

  // Resizer drag handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (dragging.current === 1) {
        setDivider1(Math.max(100, Math.min(y, divider2 - 50)));
      } else {
        setDivider2(Math.max(divider1 + 50, Math.min(y, rect.height - 80)));
      }
    };
    const handleMouseUp = () => {
      if (dragging.current && dividersLoaded.current) {
        setUiState('schemaDivider1', divider1);
        setUiState('schemaDivider2', divider2);
      }
      dragging.current = null;
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [divider1, divider2]);

  return (
    <div className="schema-view" ref={containerRef}>
      <div style={{ height: divider1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SchemaColumns connectionId={tab.connectionId} database={tab.database!} table={tab.table!} isActive={isActive} onSchemaChanged={handleSchemaChanged} />
      </div>
      <div className="sql-resizer" onMouseDown={() => { dragging.current = 1; document.body.style.cursor = 'row-resize'; }}>
        <span>⋯⋯⋯</span>
      </div>
      <div style={{ height: divider2 - divider1 - 4, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SchemaIndexes connectionId={tab.connectionId} database={tab.database!} table={tab.table!} columnInfos={columnInfos} isActive={isActive} refreshTrigger={refreshTrigger} onSchemaChanged={handleSchemaChanged} />
      </div>
      <div className="sql-resizer" onMouseDown={() => { dragging.current = 2; document.body.style.cursor = 'row-resize'; }}>
        <span>⋯⋯⋯</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SchemaDDL connectionId={tab.connectionId} database={tab.database!} table={tab.table!} isActive={isActive} refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
