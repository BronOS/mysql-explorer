import { useState, useEffect, useRef } from 'react';
import { useIpc } from '../hooks/use-ipc';

interface Props {
  connectionId: string;
  database?: string;
  onClose: () => void;
  onDone: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

export default function ImportSqlDialog({ connectionId, database, onClose, onDone }: Props) {
  const ipc = useIpc();
  const [file, setFile] = useState<{ filePath: string; fileName: string; size: number } | null>(null);
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState({ executed: 0, errors: 0, currentStatement: '' });
  const [result, setResult] = useState<{ executed: number; errors: number; errorMessages: string[] } | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => { cleanupRef.current?.(); };
  }, []);

  const handlePickFile = async () => {
    const picked = await ipc.importPickSqlFile();
    if (picked) setFile(picked);
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    setProgress({ executed: 0, errors: 0, currentStatement: '' });

    // Listen for progress events
    cleanupRef.current = window.electronAPI.onImportProgress((p) => {
      setProgress(p);
    });

    try {
      const res = await ipc.importExecuteSqlFile(connectionId, file.filePath, database);
      setResult(res);
      setDone(true);
      onDone();
    } catch (err: any) {
      setResult({ executed: progress.executed, errors: progress.errors + 1, errorMessages: [err.message] });
      setDone(true);
    } finally {
      setImporting(false);
      cleanupRef.current?.();
      cleanupRef.current = null;
    }
  };

  return (
    <div className="modal-overlay" onClick={done || !importing ? onClose : undefined}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 480 }}>
        <div className="modal-title">Import SQL File{database ? ` into ${database}` : ''}</div>

        {!file && !done && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <button className="btn btn-primary" onClick={handlePickFile} style={{ fontSize: 13, padding: '8px 20px' }}>
              Choose SQL File...
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-disabled)', marginTop: 8 }}>Select a .sql file to import</div>
          </div>
        )}

        {file && !importing && !done && (
          <>
            <div style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 4, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{file.fileName}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{formatSize(file.size)}</div>
            </div>
            {file.size > 100 * 1024 * 1024 && (
              <div style={{ padding: 8, borderRadius: 4, marginBottom: 12, fontSize: 12, background: 'var(--warning-bg)', color: 'var(--warning)' }}>
                Large file — import may take a while.
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setFile(null)}>Change File</button>
              <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
              <button className="btn btn-primary" onClick={handleImport}>Import</button>
            </div>
          </>
        )}

        {importing && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>Importing {file?.fileName}...</div>
              <div style={{ background: 'var(--bg-primary)', borderRadius: 4, height: 6, overflow: 'hidden' }}>
                <div style={{ background: 'var(--accent)', height: '100%', width: '100%', animation: 'import-pulse 1.5s ease-in-out infinite' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
              <span style={{ color: 'var(--success)' }}>{progress.executed.toLocaleString()} executed</span>
              {progress.errors > 0 && <span style={{ color: 'var(--danger)' }}>{progress.errors.toLocaleString()} errors</span>}
            </div>
            {progress.currentStatement && (
              <div style={{ fontSize: 11, color: 'var(--text-disabled)', fontFamily: 'monospace', marginTop: 8, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {progress.currentStatement}
              </div>
            )}
          </div>
        )}

        {done && result && (
          <>
            <div style={{ padding: 12, background: 'var(--bg-primary)', borderRadius: 4, marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: result.errors === 0 ? 'var(--success)' : 'var(--warning)' }}>
                Import complete
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: 12, marginTop: 6 }}>
                <span style={{ color: 'var(--success)' }}>{result.executed.toLocaleString()} statements executed</span>
                {result.errors > 0 && (
                  <span style={{ color: 'var(--danger)' }}>
                    {result.errors.toLocaleString()} errors
                    <span
                      style={{ color: 'var(--text-muted)', cursor: 'pointer', marginLeft: 4, textDecoration: 'underline' }}
                      onClick={() => setShowErrors(!showErrors)}
                    >
                      {showErrors ? 'hide' : 'show'}
                    </span>
                  </span>
                )}
              </div>
            </div>
            {showErrors && result.errorMessages.length > 0 && (
              <div style={{ maxHeight: 200, overflowY: 'auto', padding: 8, background: 'var(--danger-bg)', borderRadius: 4, marginBottom: 12, fontSize: 11, fontFamily: 'monospace', color: 'var(--danger-text)' }}>
                {result.errorMessages.map((msg, i) => (
                  <div key={i} style={{ marginBottom: 6 }}>{msg}</div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={onClose}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
