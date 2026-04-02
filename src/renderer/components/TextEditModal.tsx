import { useState } from 'react';

interface Props {
  initialValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

export default function TextEditModal({ initialValue, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Edit Text Field</div>
        <textarea
          className="input"
          style={{ height: 200, resize: 'vertical', fontFamily: 'monospace' }}
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onSave(value); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}
