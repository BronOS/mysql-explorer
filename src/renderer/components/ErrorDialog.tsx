interface Props {
  title?: string;
  message: string;
  onClose: () => void;
}

export default function ErrorDialog({ title = 'Error', message, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 400, maxWidth: 600 }}>
        <div className="modal-title" style={{ color: '#c75450' }}>{title}</div>
        <div style={{ fontSize: 13, color: '#a9b7c6', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflow: 'auto', fontFamily: 'monospace', background: '#2b2b2b', padding: 12, borderRadius: 4, marginBottom: 16 }}>
          {message}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={() => { navigator.clipboard.writeText(message); }}>Copy</button>
          <button className="btn btn-primary" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  );
}
