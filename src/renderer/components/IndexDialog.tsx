import { useState, useEffect } from 'react';

interface IndexData {
  name: string;
  type: string;
  columns: string[];
  unique: boolean;
}

interface Props {
  columns: string[];
  initial?: IndexData;
  onSave: (data: IndexData) => void;
  onClose: () => void;
}

const TYPE_OPTIONS = ['INDEX', 'UNIQUE', 'FULLTEXT'];

export default function IndexDialog({ columns, initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? 'INDEX');
  const [selectedCols, setSelectedCols] = useState<string[]>(initial?.columns ?? []);
  const [unique, setUnique] = useState(initial?.unique ?? false);
  const [autoName, setAutoName] = useState(!initial);

  // Auto-suggest name when columns change
  useEffect(() => {
    if (autoName && selectedCols.length > 0) {
      setName(`idx_${selectedCols[0]}`);
    } else if (autoName && selectedCols.length === 0) {
      setName('');
    }
  }, [selectedCols, autoName]);

  // Sync unique flag with type
  useEffect(() => {
    if (type === 'UNIQUE') setUnique(true);
    else if (type !== 'INDEX') setUnique(false);
  }, [type]);

  const handleNameChange = (v: string) => {
    setAutoName(false);
    setName(v);
  };

  const toggleColumn = (col: string) => {
    setSelectedCols(prev => {
      if (prev.includes(col)) {
        return prev.filter(c => c !== col);
      }
      return [...prev, col];
    });
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    setSelectedCols(prev => {
      const next = [...prev];
      [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
      return next;
    });
  };

  const moveDown = (idx: number) => {
    setSelectedCols(prev => {
      if (idx >= prev.length - 1) return prev;
      const next = [...prev];
      [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
      return next;
    });
  };

  const canSave = name.trim().length > 0 && selectedCols.length > 0;

  const handleSave = () => {
    if (!canSave) return;
    onSave({ name: name.trim(), type, columns: selectedCols, unique });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 460 }}>
        <div className="modal-title">{initial ? 'Edit Index' : 'Add Index'}</div>

        {/* Name */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Index Name</div>
          <input
            className="input"
            placeholder="e.g. idx_email"
            value={name}
            onChange={e => handleNameChange(e.target.value)}
          />
        </div>

        {/* Type */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Type</div>
          <select
            className="select"
            style={{ width: '100%' }}
            value={type}
            onChange={e => setType(e.target.value)}
          >
            {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Column Picker */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Columns</div>
          <div style={{
            border: '1px solid #646464',
            borderRadius: 3,
            background: '#45494a',
            maxHeight: 180,
            overflowY: 'auto',
          }}>
            {columns.map(col => {
              const idx = selectedCols.indexOf(col);
              const isSelected = idx !== -1;
              return (
                <div
                  key={col}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    borderBottom: '1px solid #515151',
                    background: isSelected ? '#214283' : 'transparent',
                    cursor: 'pointer',
                    userSelect: 'none',
                  }}
                  onClick={() => toggleColumn(col)}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    readOnly
                    style={{ marginRight: 8, cursor: 'pointer' }}
                  />
                  <span style={{ flex: 1, fontSize: 12 }}>{col}</span>
                  {isSelected && (
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '1px 6px', fontSize: 10 }}
                        onClick={e => { e.stopPropagation(); moveUp(idx); }}
                        title="Move up"
                        disabled={idx === 0}
                      >▲</button>
                      <button
                        className="btn btn-secondary"
                        style={{ padding: '1px 6px', fontSize: 10 }}
                        onClick={e => { e.stopPropagation(); moveDown(idx); }}
                        title="Move down"
                        disabled={idx === selectedCols.length - 1}
                      >▼</button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected column order */}
        {selectedCols.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Column order</div>
            <div style={{ fontSize: 12, color: '#a9b7c6', padding: '4px 8px', background: '#2b2b2b', borderRadius: 3, fontFamily: 'monospace' }}>
              {selectedCols.map((c, i) => (
                <span key={c}>
                  {i > 0 && <span style={{ color: '#666' }}>, </span>}
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
