import { useState } from 'react';

interface Props {
  initial: string; // e.g. "10,2" or ""
  onSave: (value: string) => void;
  onClose: () => void;
}

export default function PrecisionDialog({ initial, onSave, onClose }: Props) {
  const parts = initial.split(',');
  const [precision, setPrecision] = useState(parts[0] || '10');
  const [scale, setScale] = useState(parts[1] || '0');

  const preview = `${precision}${scale ? `,${scale}` : ''}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 320 }}>
        <div className="modal-title">Precision & Scale</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <label>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Precision (total digits)</div>
            <input className="input" type="number" min="1" max="65" value={precision} onChange={e => setPrecision(e.target.value)} autoFocus />
          </label>
          <label>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Scale (decimal places)</div>
            <input className="input" type="number" min="0" max="30" value={scale} onChange={e => setScale(e.target.value)} />
          </label>
        </div>

        <div style={{ padding: 8, background: 'var(--bg-primary)', borderRadius: 4, fontFamily: 'monospace', fontSize: 12, color: '#6897bb', marginBottom: 16 }}>
          DECIMAL({preview}) → e.g. {(() => {
            const p = parseInt(precision) || 10;
            const s = parseInt(scale) || 0;
            const intPart = '9'.repeat(Math.max(1, p - s));
            const decPart = s > 0 ? '.' + '9'.repeat(s) : '';
            return intPart + decPart;
          })()}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onSave(preview); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}
