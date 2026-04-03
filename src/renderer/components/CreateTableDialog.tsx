import { useState } from 'react';
import { useIpc } from '../hooks/use-ipc';

interface Props {
  connectionId: string;
  database: string;
  onCreated: (tableName: string) => void;
  onClose: () => void;
}

const ENGINES = ['InnoDB', 'MyISAM', 'MEMORY', 'CSV', 'ARCHIVE'];
const CHARSETS = ['utf8mb4', 'utf8', 'latin1', 'ascii', 'binary'];
const COLLATIONS: Record<string, string[]> = {
  utf8mb4: ['utf8mb4_unicode_ci', 'utf8mb4_general_ci', 'utf8mb4_bin'],
  utf8: ['utf8_unicode_ci', 'utf8_general_ci', 'utf8_bin'],
  latin1: ['latin1_swedish_ci', 'latin1_general_ci', 'latin1_bin'],
  ascii: ['ascii_general_ci', 'ascii_bin'],
  binary: ['binary'],
};

export default function CreateTableDialog({ connectionId, database, onCreated, onClose }: Props) {
  const ipc = useIpc();
  const [name, setName] = useState('');
  const [engine, setEngine] = useState('InnoDB');
  const [charset, setCharset] = useState('utf8mb4');
  const [collation, setCollation] = useState('utf8mb4_unicode_ci');
  const [comment, setComment] = useState('');
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
      let sql = `CREATE TABLE \`${database}\`.\`${name.trim()}\` (\n  \`id\` INT NOT NULL AUTO_INCREMENT,\n  PRIMARY KEY (\`id\`)\n) ENGINE=${engine} DEFAULT CHARSET=${charset}`;
      if (collation) sql += ` COLLATE=${collation}`;
      if (comment) sql += ` COMMENT='${comment.replace(/'/g, "\\'")}'`;
      await ipc.schemaAlterTable(connectionId, sql);
      onCreated(name.trim());
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create table');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 450 }}>
        <div className="modal-title">New Table in {database}</div>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Table Name</div>
          <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. users" autoFocus />
        </label>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Engine</div>
            <select className="select" style={{ width: '100%' }} value={engine} onChange={e => setEngine(e.target.value)}>
              {ENGINES.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </label>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Charset</div>
            <select className="select" style={{ width: '100%' }} value={charset} onChange={e => handleCharsetChange(e.target.value)}>
              {CHARSETS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Collation</div>
          <select className="select" style={{ width: '100%' }} value={collation} onChange={e => setCollation(e.target.value)}>
            {(COLLATIONS[charset] || []).map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Comment (optional)</div>
          <input className="input" value={comment} onChange={e => setComment(e.target.value)} />
        </label>

        {error && (
          <div style={{ padding: 8, borderRadius: 4, marginBottom: 12, fontSize: 12, background: '#2a0000', color: '#c75450' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleCreate} disabled={!name.trim() || creating}>
            {creating ? 'Creating...' : 'Create Table'}
          </button>
        </div>
      </div>
    </div>
  );
}
