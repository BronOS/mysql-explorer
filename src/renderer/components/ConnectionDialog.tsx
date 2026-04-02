import { useState } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { ConnectionConfig } from '../../shared/types';

interface Props {
  connection?: ConnectionConfig;
  onClose: () => void;
  onSaved: () => void;
}

const COLORS = ['#00d2ff', '#4ade80', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#84cc16'];

export default function ConnectionDialog({ connection, onClose, onSaved }: Props) {
  const ipc = useIpc();
  const [form, setForm] = useState({
    name: connection?.name ?? '',
    color: connection?.color ?? COLORS[0],
    host: connection?.host ?? 'localhost',
    port: connection?.port ?? 3306,
    user: connection?.user ?? 'root',
    password: connection?.password ?? '',
    defaultDatabase: connection?.defaultDatabase ?? '',
    sshEnabled: connection?.sshEnabled ?? false,
    sshHost: connection?.sshHost ?? '',
    sshPort: connection?.sshPort ?? 22,
    sshUser: connection?.sshUser ?? '',
    sshAuthType: connection?.sshAuthType ?? 'password' as 'password' | 'key',
    sshPassword: connection?.sshPassword ?? '',
    sshKeyPath: connection?.sshKeyPath ?? '',
    sshPassphrase: connection?.sshPassphrase ?? '',
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await ipc.connectionTest(form);
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = async () => {
    if (connection) {
      await ipc.connectionUpdate(connection.id, form);
    } else {
      await ipc.connectionCreate(form);
    }
    onSaved();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 500 }}>
        <div className="modal-title">{connection ? 'Edit' : 'New'} Connection</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Name</div>
            <input className="input" placeholder="e.g. Production, Dev11" value={form.name} onChange={e => set('name', e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Color</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => set('color', c)}
                  style={{
                    width: 24, height: 24, borderRadius: 4, background: c, cursor: 'pointer',
                    outline: form.color === c ? '2px solid white' : 'none', outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Host</div>
            <input className="input" value={form.host} onChange={e => set('host', e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Port</div>
            <input className="input" type="number" value={form.port} onChange={e => set('port', Number(e.target.value))} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>User</div>
            <input className="input" value={form.user} onChange={e => set('user', e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Password</div>
            <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} />
          </label>
        </div>

        <label style={{ marginBottom: 16, display: 'block' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Default Database (optional)</div>
          <input className="input" value={form.defaultDatabase} onChange={e => set('defaultDatabase', e.target.value)} />
        </label>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.sshEnabled} onChange={e => set('sshEnabled', e.target.checked)} />
          <span style={{ fontSize: 12, color: '#c0c0c0' }}>Connect via SSH Tunnel</span>
        </label>

        {form.sshEnabled && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
              <label>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>SSH Host</div>
                <input className="input" value={form.sshHost} onChange={e => set('sshHost', e.target.value)} />
              </label>
              <label>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>SSH Port</div>
                <input className="input" type="number" value={form.sshPort} onChange={e => set('sshPort', Number(e.target.value))} />
              </label>
            </div>
            <label style={{ marginBottom: 12, display: 'block' }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>SSH User</div>
              <input className="input" value={form.sshUser} onChange={e => set('sshUser', e.target.value)} />
            </label>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="radio" checked={form.sshAuthType === 'password'} onChange={() => set('sshAuthType', 'password')} />
                <span style={{ fontSize: 12 }}>Password</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="radio" checked={form.sshAuthType === 'key'} onChange={() => set('sshAuthType', 'key')} />
                <span style={{ fontSize: 12 }}>Key File</span>
              </label>
            </div>
            {form.sshAuthType === 'password' ? (
              <label style={{ marginBottom: 12, display: 'block' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>SSH Password</div>
                <input className="input" type="password" value={form.sshPassword} onChange={e => set('sshPassword', e.target.value)} />
              </label>
            ) : (
              <>
                <label style={{ marginBottom: 12, display: 'block' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Key File Path</div>
                  <input className="input" value={form.sshKeyPath} onChange={e => set('sshKeyPath', e.target.value)} />
                </label>
                <label style={{ marginBottom: 12, display: 'block' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Passphrase (optional)</div>
                  <input className="input" type="password" value={form.sshPassphrase} onChange={e => set('sshPassphrase', e.target.value)} />
                </label>
              </>
            )}
          </>
        )}

        {testResult && (
          <div style={{ padding: 8, borderRadius: 4, marginBottom: 12, fontSize: 12, background: testResult.success ? '#002a00' : '#2a0000', color: testResult.success ? '#4ade80' : '#ef4444' }}>
            {testResult.success ? '✓ Connection successful' : `✗ ${testResult.error}`}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!form.name.trim()}>Save</button>
        </div>
      </div>
    </div>
  );
}
