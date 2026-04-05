import { useState, useEffect } from 'react';
import { useIpc } from '../hooks/use-ipc';

interface Props {
  connectionId: string;
  refreshTrigger: number;
}

export default function MonitorStatus({ connectionId, refreshTrigger }: Props) {
  const ipc = useIpc();
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    ipc.monitorGlobalStatus(connectionId)
      .then((result: Record<string, string>) => setData(result))
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, [connectionId, refreshTrigger]);

  const lowerFilter = filter.toLowerCase();
  const entries = Object.entries(data).filter(([name, value]) =>
    !lowerFilter || name.toLowerCase().includes(lowerFilter) || value.toLowerCase().includes(lowerFilter)
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          className="input"
          placeholder="Filter status variables..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="datagrid-wrapper" style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 16, color: 'var(--text-muted)' }}>Loading status variables...</div>
        ) : (
          <table className="datagrid">
            <thead>
              <tr>
                <th>Variable Name</th>
                <th>Value</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([name, value]) => (
                <tr key={name}>
                  <td><span style={{ padding: '6px 12px', display: 'inline-block' }}>{name}</span></td>
                  <td><span style={{ padding: '6px 12px', display: 'inline-block' }}>{value}</span></td>
                </tr>
              ))}
              {entries.length === 0 && (
                <tr>
                  <td colSpan={2}>
                    <span style={{ padding: '6px 12px', display: 'inline-block', color: 'var(--text-muted)' }}>
                      {filter ? 'No matching variables.' : 'No data.'}
                    </span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
