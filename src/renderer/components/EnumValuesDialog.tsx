import { useState } from 'react';

interface Props {
  initial: string[];
  onSave: (values: string[]) => void;
  onClose: () => void;
}

export default function EnumValuesDialog({ initial, onSave, onClose }: Props) {
  const [values, setValues] = useState<string[]>(initial.length > 0 ? initial : ['']);

  const addValue = () => setValues([...values, '']);

  const removeValue = (idx: number) => {
    if (values.length <= 1) return;
    setValues(values.filter((_, i) => i !== idx));
  };

  const updateValue = (idx: number, val: string) => {
    setValues(values.map((v, i) => i === idx ? val : v));
  };

  const moveValue = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= values.length) return;
    const next = [...values];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setValues(next);
  };

  const filtered = values.filter(v => v.trim());
  const preview = filtered.length > 0 ? `(${filtered.map(v => `'${v}'`).join(',')})` : '';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 400 }}>
        <div className="modal-title">ENUM / SET Values</div>

        <div style={{ maxHeight: 300, overflow: 'auto', marginBottom: 12 }}>
          {values.map((val, idx) => (
            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ color: '#666', fontSize: 11, width: 20, textAlign: 'right' }}>{idx + 1}.</span>
              <input
                className="input"
                style={{ flex: 1, padding: '4px 8px', fontSize: 12 }}
                value={val}
                onChange={e => updateValue(idx, e.target.value)}
                placeholder="Value"
                autoFocus={idx === values.length - 1}
                onKeyDown={e => { if (e.key === 'Enter') addValue(); }}
              />
              <span
                style={{ cursor: 'pointer', opacity: idx > 0 ? 1 : 0.3, fontSize: 11 }}
                onClick={() => moveValue(idx, -1)}
              >▲</span>
              <span
                style={{ cursor: 'pointer', opacity: idx < values.length - 1 ? 1 : 0.3, fontSize: 11 }}
                onClick={() => moveValue(idx, 1)}
              >▼</span>
              <span
                style={{ cursor: 'pointer', color: '#c75450', opacity: values.length > 1 ? 1 : 0.3, fontSize: 14 }}
                onClick={() => removeValue(idx)}
              >✕</span>
            </div>
          ))}
        </div>

        <button className="btn btn-secondary" onClick={addValue} style={{ marginBottom: 12 }}>+ Add Value</button>

        {preview && (
          <div style={{ padding: 8, background: '#2b2b2b', borderRadius: 4, fontFamily: 'monospace', fontSize: 12, color: '#a5c261', marginBottom: 12, wordBreak: 'break-all' }}>
            {preview}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onSave(filtered); onClose(); }} disabled={filtered.length === 0}>Save</button>
        </div>
      </div>
    </div>
  );
}
