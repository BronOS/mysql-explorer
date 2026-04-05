import { useState, useEffect } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { Snippet } from '../../shared/types';

interface Props {
  onClose: () => void;
  onInsert: (body: string) => void;
}

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function SnippetDialog({ onClose, onInsert }: Props) {
  const ipc = useIpc();
  const [snippets, setSnippets] = useState<Snippet[]>([]);
  const [editing, setEditing] = useState<Snippet | null>(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    ipc.snippetsLoad().then((s: Snippet[]) => setSnippets(s));
  }, []);

  const save = async (updated: Snippet[]) => {
    setSnippets(updated);
    await ipc.snippetsSave(updated);
  };

  const handleSaveSnippet = async () => {
    if (!editing || !editing.name.trim() || !editing.body.trim()) return;
    const existing = snippets.findIndex(s => s.id === editing.id);
    const updated = [...snippets];
    if (existing >= 0) {
      updated[existing] = editing;
    } else {
      updated.push(editing);
    }
    await save(updated);
    setEditing(null);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this snippet?')) return;
    await save(snippets.filter(s => s.id !== id));
    if (editing?.id === id) setEditing(null);
  };

  const filtered = snippets.filter(s =>
    !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.prefix.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 600, maxWidth: 700, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span>SQL Snippets</span>
          <button className="btn btn-primary" style={{ marginLeft: 'auto', fontSize: 11 }} onClick={() => setEditing({ id: generateId(), name: '', prefix: '', body: '' })}>
            + New Snippet
          </button>
        </div>

        {editing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <label>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Name</div>
                <input className="input" value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="e.g. Find slow queries" autoFocus />
              </label>
              <label>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Prefix (for autocomplete with @)</div>
                <input className="input" value={editing.prefix} onChange={e => setEditing({ ...editing, prefix: e.target.value })} placeholder="e.g. slow-queries" />
              </label>
            </div>
            <label>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>
                SQL Body <span style={{ color: 'var(--text-disabled)' }}>— use {'{{placeholder}}'} for variables</span>
              </div>
              <textarea
                className="input"
                value={editing.body}
                onChange={e => setEditing({ ...editing, body: e.target.value })}
                placeholder={'SELECT * FROM {{table}} WHERE {{column}} = {{value}}'}
                rows={6}
                style={{ fontFamily: 'monospace', resize: 'vertical' }}
              />
            </label>
            {editing.body && /\{\{.+?\}\}/.test(editing.body) && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Placeholders: {[...editing.body.matchAll(/\{\{(.+?)\}\}/g)].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i).join(', ')}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSaveSnippet} disabled={!editing.name.trim() || !editing.body.trim()}>
                Save Snippet
              </button>
            </div>
          </div>
        ) : (
          <>
            <input
              className="input"
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="Search snippets..."
              style={{ marginBottom: 12 }}
              autoFocus
            />
            <div style={{ overflowY: 'auto', maxHeight: '50vh' }}>
              {filtered.length === 0 && (
                <div style={{ color: 'var(--text-disabled)', fontSize: 12, padding: '16px 0', textAlign: 'center' }}>
                  {snippets.length === 0 ? 'No snippets yet. Create one to get started.' : 'No matching snippets.'}
                </div>
              )}
              {filtered.map(s => (
                <div
                  key={s.id}
                  style={{
                    padding: '8px 10px',
                    borderBottom: '1px solid var(--bg-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                  }}
                  onDoubleClick={() => onInsert(s.body)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{s.name}</div>
                    {s.prefix && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>@{s.prefix}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text-disabled)', fontFamily: 'monospace', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2 }}>
                      {s.body.replace(/\n/g, ' ').slice(0, 80)}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button className="btn btn-primary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={(e) => { e.stopPropagation(); onInsert(s.body); }}>Insert</button>
                    <button className="btn btn-secondary" style={{ fontSize: 11, padding: '2px 8px' }} onClick={(e) => { e.stopPropagation(); setEditing({ ...s }); }}>Edit</button>
                    <button className="btn btn-secondary" style={{ fontSize: 11, padding: '2px 8px', color: 'var(--danger)' }} onClick={(e) => { e.stopPropagation(); handleDelete(s.id); }}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
