import { useState, useEffect } from 'react';

export interface IndexColumn {
  name: string;
  prefixLength?: number;
}

export interface IndexData {
  name: string;
  type: string;
  columns: IndexColumn[];
  unique: boolean;
}

export interface ColumnInfo {
  name: string;
  type: string; // e.g. "varchar(255)", "mediumtext", "int(11)"
}

interface Props {
  columns: ColumnInfo[];
  initial?: IndexData;
  onSave: (data: IndexData) => void;
  onClose: () => void;
}

const NEEDS_PREFIX = new Set(['TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB']);

function needsPrefix(type: string): boolean {
  const base = type.replace(/\(.*/, '').toUpperCase();
  return NEEDS_PREFIX.has(base);
}

function suggestPrefix(type: string): number | undefined {
  const base = type.replace(/\(.*/, '').toUpperCase();
  if (NEEDS_PREFIX.has(base)) return 191;
  // Long varchar
  const match = type.match(/varchar\((\d+)\)/i);
  if (match && parseInt(match[1]) > 255) return 191;
  return undefined;
}

const TYPE_OPTIONS = ['INDEX', 'UNIQUE', 'FULLTEXT'];

export default function IndexDialog({ columns, initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [type, setType] = useState(initial?.type ?? 'INDEX');
  const [selectedCols, setSelectedCols] = useState<IndexColumn[]>(initial?.columns ?? []);
  const [unique, setUnique] = useState(initial?.unique ?? false);
  const [autoName, setAutoName] = useState(!initial);

  useEffect(() => {
    if (autoName && selectedCols.length > 0) {
      setName(`idx_${selectedCols[0].name}`);
    } else if (autoName && selectedCols.length === 0) {
      setName('');
    }
  }, [selectedCols, autoName]);

  useEffect(() => {
    if (type === 'UNIQUE') setUnique(true);
    else if (type !== 'INDEX') setUnique(false);
  }, [type]);

  const handleNameChange = (v: string) => {
    setAutoName(false);
    setName(v);
  };

  const toggleColumn = (colInfo: ColumnInfo) => {
    setSelectedCols(prev => {
      if (prev.find(c => c.name === colInfo.name)) {
        return prev.filter(c => c.name !== colInfo.name);
      }
      const prefix = suggestPrefix(colInfo.type);
      return [...prev, { name: colInfo.name, prefixLength: prefix }];
    });
  };

  const setPrefixLength = (col: string, length: number | undefined) => {
    setSelectedCols(prev => prev.map(c => c.name === col ? { ...c, prefixLength: length } : c));
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

  const colPreview = selectedCols.map(c => c.prefixLength ? `${c.name}(${c.prefixLength})` : c.name).join(', ');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 460 }}>
        <div className="modal-title">{initial ? 'Edit Index' : 'Add Index'}</div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Index Name</div>
          <input className="input" placeholder="e.g. idx_email" value={name} onChange={e => handleNameChange(e.target.value)} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Type</div>
          <select className="select" style={{ width: '100%' }} value={type} onChange={e => setType(e.target.value)}>
            {TYPE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Columns</div>
          <div style={{ border: '1px solid #646464', borderRadius: 3, background: '#45494a', maxHeight: 250, overflowY: 'auto' }}>
            {columns.map(colInfo => {
              const selCol = selectedCols.find(c => c.name === colInfo.name);
              const isSelected = !!selCol;
              const idx = selectedCols.findIndex(c => c.name === colInfo.name);
              const requiresPrefix = needsPrefix(colInfo.type);
              return (
                <div key={colInfo.name} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid #515151', background: isSelected ? '#214283' : 'transparent', cursor: 'pointer', userSelect: 'none' }}>
                  <input type="checkbox" checked={isSelected} readOnly style={{ marginRight: 8, cursor: 'pointer' }} onClick={() => toggleColumn(colInfo)} />
                  <span style={{ flex: 1, fontSize: 12 }} onClick={() => toggleColumn(colInfo)}>
                    {colInfo.name}
                    <span style={{ color: '#6897bb', fontSize: 10, marginLeft: 6 }}>{colInfo.type}</span>
                    {requiresPrefix && isSelected && !selCol?.prefixLength && <span style={{ color: '#cc7832', fontSize: 10, marginLeft: 4 }}>⚠ set max indexed length</span>}
                  </span>
                  {isSelected && (
                    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                      <input
                        className="input"
                        type="number"
                        min="1"
                        placeholder="length"
                        value={selCol?.prefixLength || ''}
                        onChange={e => { e.stopPropagation(); setPrefixLength(colInfo.name, e.target.value ? parseInt(e.target.value) : undefined); }}
                        onClick={e => e.stopPropagation()}
                        style={{ width: 60, padding: '2px 4px', fontSize: 11, textAlign: 'center' }}
                        title="Max indexed characters (required for TEXT/BLOB, optional for VARCHAR)"
                      />
                      <button className="btn btn-secondary" style={{ padding: '1px 6px', fontSize: 10 }} onClick={e => { e.stopPropagation(); moveUp(idx); }} disabled={idx === 0}>▲</button>
                      <button className="btn btn-secondary" style={{ padding: '1px 6px', fontSize: 10 }} onClick={e => { e.stopPropagation(); moveDown(idx); }} disabled={idx === selectedCols.length - 1}>▼</button>
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {selectedCols.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Preview</div>
            <div style={{ fontSize: 12, color: '#a9b7c6', padding: '4px 8px', background: '#2b2b2b', borderRadius: 3, fontFamily: 'monospace' }}>
              {colPreview}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 8 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={!canSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
