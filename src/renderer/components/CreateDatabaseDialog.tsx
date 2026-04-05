import { useState } from 'react';
import { useIpc } from '../hooks/use-ipc';

interface Props {
  connectionId: string;
  onCreated: (dbName: string) => void;
  onClose: () => void;
}

const CHARSETS = ['utf8mb4', 'utf8', 'latin1', 'ascii', 'binary'];
const COLLATIONS: Record<string, string[]> = {
  utf8mb4: ['utf8mb4_unicode_ci', 'utf8mb4_general_ci', 'utf8mb4_bin'],
  utf8: ['utf8_unicode_ci', 'utf8_general_ci', 'utf8_bin'],
  latin1: ['latin1_swedish_ci', 'latin1_general_ci', 'latin1_bin'],
  ascii: ['ascii_general_ci', 'ascii_bin'],
  binary: ['binary'],
};

export default function CreateDatabaseDialog({ connectionId, onCreated, onClose }: Props) {
  const ipc = useIpc();
  const [name, setName] = useState('');
  const [charset, setCharset] = useState('utf8mb4');
  const [collation, setCollation] = useState('utf8mb4_unicode_ci');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleCharsetChange = (cs: string) => {
    setCharset(cs);
    const colls = COLLATIONS[cs] || [];
    setCollation(colls[0] || '');
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      await ipc.schemaCreateDatabase(connectionId, name.trim(), charset, collation);
      onCreated(name.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create database');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 400 }}>
        <div className="modal-title">New Database</div>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Database Name</div>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. my_database" autoFocus />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Charset</div>
            <select className="select" style={{ width: '100%' }} value={charset} onChange={e => handleCharsetChange(e.target.value)}>
              {CHARSETS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Collation</div>
            <select className="select" style={{ width: '100%' }} value={collation} onChange={e => setCollation(e.target.value)}>
              {(COLLATIONS[charset] || []).map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        {error && (
          <div style={{ padding: 8, borderRadius: 4, marginBottom: 12, fontSize: 12, background: 'var(--danger-bg)', color: 'var(--danger-text)' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={!name.trim() || creating}>
            {creating ? 'Creating...' : 'Create Database'}
          </button>
        </div>
      </div>
    </div>
  );
}
