import { useState, useEffect, useRef } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { TabInfo } from '../../shared/types';
import MonitorProcesslist from './MonitorProcesslist';
import MonitorStatus from './MonitorStatus';
import MonitorVariables from './MonitorVariables';
import MonitorSlowLog from './MonitorSlowLog';
import MonitorInnodb from './MonitorInnodb';

interface Props {
  tab: TabInfo;
  isActive?: boolean;
}

type SubTab = 'processlist' | 'status' | 'variables' | 'slowlog' | 'innodb';

interface MetricCards {
  uptime: string;
  queriesPerSec: number;
  activeThreads: string;
  connections: string;
  slowQueries: string;
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

function parseMetrics(status: Record<string, string>): MetricCards {
  const uptime = Number(status.Uptime) || 0;
  return {
    uptime: formatUptime(uptime),
    queriesPerSec: uptime > 0 ? Math.round(Number(status.Questions) / uptime) : 0,
    activeThreads: status.Threads_running ?? '—',
    connections: status.Threads_connected ?? '—',
    slowQueries: status.Slow_queries ?? '—',
  };
}

const REFRESH_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '1s', value: 1000 },
  { label: '5s', value: 5000 },
  { label: '10s', value: 10000 },
  { label: '30s', value: 30000 },
];

const SUB_TABS: { key: SubTab; label: string }[] = [
  { key: 'processlist', label: 'Processlist' },
  { key: 'status', label: 'Status' },
  { key: 'variables', label: 'Variables' },
  { key: 'slowlog', label: 'Slow Queries' },
  { key: 'innodb', label: 'InnoDB' },
];

export default function ServerMonitorTab({ tab, isActive }: Props) {
  const ipc = useIpc();
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('processlist');
  const [metrics, setMetrics] = useState<MetricCards | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStatus = async () => {
    try {
      const status = await ipc.monitorGlobalStatus(tab.connectionId);
      if (status) {
        setMetrics(parseMetrics(status));
      }
    } catch {
      // ignore fetch errors silently
    }
  };

  // Initial fetch on mount
  useEffect(() => {
    fetchStatus();
  }, [tab.connectionId]);

  // Auto-refresh interval
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (refreshInterval > 0 && isActive !== false) {
      intervalRef.current = setInterval(() => {
        setRefreshTrigger(prev => prev + 1);
        fetchStatus();
      }, refreshInterval);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [refreshInterval, isActive, tab.connectionId]);

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    fetchStatus();
  };

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '10px 16px',
    textAlign: 'center',
    flex: 1,
  };

  const metricCards: { label: string; value: string | number }[] = metrics
    ? [
        { label: 'Uptime', value: metrics.uptime },
        { label: 'Queries/sec', value: metrics.queriesPerSec },
        { label: 'Active Threads', value: metrics.activeThreads },
        { label: 'Connections', value: metrics.connections },
        { label: 'Slow Queries', value: metrics.slowQueries },
      ]
    : [
        { label: 'Uptime', value: '—' },
        { label: 'Queries/sec', value: '—' },
        { label: 'Active Threads', value: '—' },
        { label: 'Connections', value: '—' },
        { label: 'Slow Queries', value: '—' },
      ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div className="sql-toolbar">
        <span style={{ fontWeight: 600, color: tab.connectionColor }}>
          {tab.connectionName}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Server Monitor</span>
        <div style={{ flex: 1 }} />
        <label style={{ color: 'var(--text-muted)', fontSize: 12 }}>Auto-refresh:</label>
        <select
          className="select"
          value={refreshInterval}
          onChange={e => setRefreshInterval(Number(e.target.value))}
        >
          {REFRESH_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <button className="btn btn-secondary" onClick={handleRefresh}>
          Refresh
        </button>
      </div>

      {/* Metric Cards */}
      <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderBottom: '1px solid var(--border)' }}>
        {metricCards.map(card => (
          <div key={card.label} style={cardStyle}>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 4 }}>{card.label}</div>
            <div style={{ fontSize: 20, fontWeight: 700 }}>{card.value}</div>
          </div>
        ))}
      </div>

      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
        {SUB_TABS.map(sub => (
          <button
            key={sub.key}
            className={`filter-mode-btn${activeSubTab === sub.key ? ' filter-mode-active' : ''}`}
            onClick={() => setActiveSubTab(sub.key)}
          >
            {sub.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeSubTab === 'processlist' && (
          <MonitorProcesslist connectionId={tab.connectionId} refreshTrigger={refreshTrigger} />
        )}
        {activeSubTab === 'status' && (
          <MonitorStatus connectionId={tab.connectionId} refreshTrigger={refreshTrigger} />
        )}
        {activeSubTab === 'variables' && (
          <MonitorVariables connectionId={tab.connectionId} refreshTrigger={refreshTrigger} />
        )}
        {activeSubTab === 'slowlog' && (
          <MonitorSlowLog connectionId={tab.connectionId} refreshTrigger={refreshTrigger} />
        )}
        {activeSubTab === 'innodb' && (
          <MonitorInnodb connectionId={tab.connectionId} refreshTrigger={refreshTrigger} />
        )}
      </div>
    </div>
  );
}
