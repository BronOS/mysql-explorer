import { TabInfo } from '../../shared/types';

interface Props {
  tab: TabInfo;
  isActive?: boolean;
}

export default function SchemaView({ tab, isActive }: Props) {
  return (
    <div className="schema-view">
      <div style={{ padding: 20, color: '#888' }}>Schema View: {tab.database}.{tab.table} (coming soon)</div>
    </div>
  );
}
