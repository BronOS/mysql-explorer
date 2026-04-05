import { useState, useEffect } from 'react';
import { useIpc } from '../hooks/use-ipc';

interface Props {
  connectionId: string;
  refreshTrigger: number;
}

export default function MonitorSlowLog({ connectionId, refreshTrigger }: Props) {
  const ipc = useIpc();
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    ipc.monitorSlowLog(connectionId).then((data: any[]) => {
      setRows(data || []);
    }).catch(() => setRows([]));
  }, [connectionId, refreshTrigger]);

  if (rows.length === 0) {
    return (
      <div className="empty-state">Slow query log table is not available or empty</div>
    );
  }

  return (
    <div className="datagrid-wrapper" style={{ flex: 1, overflow: 'auto' }}>
      <table className="datagrid">
        <thead>
          <tr>
            <th>Start Time</th>
            <th>User</th>
            <th>Host</th>
            <th>Query Time</th>
            <th>Lock Time</th>
            <th>Rows Examined</th>
            <th>SQL Text</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{row.start_time ?? row['start_time'] ?? ''}</td>
              <td>{row.user_host ?? row.user ?? ''}</td>
              <td>{row.host ?? ''}</td>
              <td>{row.query_time ?? ''}</td>
              <td>{row.lock_time ?? ''}</td>
              <td>{row.rows_examined ?? ''}</td>
              <td
                style={{ maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={String(row.sql_text ?? row.argument ?? '')}
              >
                {row.sql_text ?? row.argument ?? ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
