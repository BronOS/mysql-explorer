interface Props {
  title?: string;
  message: string;
  onClose: () => void;
}

export default function ErrorDialog({ title = 'Error', message, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 400, maxWidth: 600 }}>
        <div className="modal-title" style={{ color: 'var(--danger-text)' }}>{title}</div>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 300, overflow: 'auto', fontFamily: 'monospace', background: 'var(--bg-primary)', padding: 12, borderRadius: 4, marginBottom: 16 }}>
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
