import { useState, useEffect } from 'react';
import { useIpc } from '../hooks/use-ipc';

interface Props {
  connectionId: string;
  refreshTrigger: number;
}

type Category = 'InnoDB' | 'Replication' | 'Logging' | 'Networking' | 'Security' | 'General' | 'Other';

const CATEGORIES: Category[] = ['InnoDB', 'Replication', 'Logging', 'Networking', 'Security', 'General', 'Other'];

function categorize(name: string): Category {
  // InnoDB
  if (name.startsWith('innodb_')) return 'InnoDB';

  // Replication
  if (
    name === 'server_id' ||
    name.startsWith('binlog_') ||
    name.startsWith('relay_') ||
    name.startsWith('slave_') ||
    name.startsWith('gtid_') ||
    name === 'log_bin'
  ) return 'Replication';

  // Logging
  if (
    name.startsWith('log_') ||
    name.startsWith('slow_query_') ||
    name.startsWith('general_log') ||
    name === 'long_query_time'
  ) return 'Logging';

  // Networking
  if (
    name.startsWith('net_') ||
    name === 'max_allowed_packet' ||
    name === 'connect_timeout' ||
    name === 'interactive_timeout'
  ) return 'Networking';

  // Security
  if (
    name.startsWith('ssl_') ||
    name.startsWith('password_') ||
    name.startsWith('validate_password_') ||
    name === 'require_secure_transport'
  ) return 'Security';

  // General
  if (
    /^version/.test(name) ||
    name === 'hostname' ||
    name === 'port' ||
    name === 'socket' ||
    name === 'datadir' ||
    name === 'tmpdir' ||
    name.startsWith('character_set_') ||
    name.startsWith('collation_') ||
    name === 'time_zone' ||
    name === 'wait_timeout' ||
    name === 'max_connections'
  ) return 'General';

  return 'Other';
}

export default function MonitorVariables({ connectionId, refreshTrigger }: Props) {
  const ipc = useIpc();
  const [data, setData] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<Category>>(new Set());

  useEffect(() => {
    setLoading(true);
    ipc.monitorVariables(connectionId)
      .then((result: Record<string, string>) => setData(result))
      .catch(() => setData({}))
      .finally(() => setLoading(false));
  }, [connectionId, refreshTrigger]);

  const lowerFilter = filter.toLowerCase();

  const grouped: Record<Category, Array<[string, string]>> = {
    InnoDB: [],
    Replication: [],
    Logging: [],
    Networking: [],
    Security: [],
    General: [],
    Other: [],
  };

  for (const [name, value] of Object.entries(data)) {
    if (lowerFilter && !name.toLowerCase().includes(lowerFilter) && !value.toLowerCase().includes(lowerFilter)) {
      continue;
    }
    grouped[categorize(name)].push([name, value]);
  }

  const toggleCollapsed = (cat: Category) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <input
          className="input"
          placeholder="Filter variables..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>
      <div className="datagrid-wrapper" style={{ flex: 1 }}>
        {loading ? (
          <div style={{ padding: 16, color: 'var(--text-muted)' }}>Loading variables...</div>
        ) : (
          CATEGORIES.map(cat => {
            const entries = grouped[cat];
            if (entries.length === 0) return null;
            const isCollapsed = collapsed.has(cat);
            return (
              <div key={cat}>
                <div
                  style={{
                    padding: '8px 12px',
                    background: 'var(--bg-secondary)',
                    borderBottom: '1px solid var(--border)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: 12,
                  }}
                  onClick={() => toggleCollapsed(cat)}
                >
                  <span style={{ marginRight: 6 }}>{isCollapsed ? '▶' : '▼'}</span>
                  {cat} ({entries.length})
                </div>
                {!isCollapsed && (
                  <table className="datagrid">
                    <tbody>
                      {entries.map(([name, value]) => (
                        <tr key={name}>
                          <td><span style={{ padding: '6px 12px', display: 'inline-block' }}>{name}</span></td>
                          <td><span style={{ padding: '6px 12px', display: 'inline-block' }}>{value}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
