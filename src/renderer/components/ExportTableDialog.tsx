import { useState, useEffect } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { ExportFormat, FORMAT_LABELS, FORMAT_EXT, formatRows, rowsToSqlInsert } from '../utils/format-rows';
import type { ColumnMeta } from '../../shared/types';

interface Props {
  connectionId: string;
  database: string;
  table: string;
  onClose: () => void;
}

const FORMAT_ORDER: ExportFormat[] = ['sql', 'csv', 'json', 'markdown', 'tsv', 'html'];

export default function ExportTableDialog({ connectionId, database, table, onClose }: Props) {
  const ipc = useIpc();
  const [format, setFormat] = useState<ExportFormat>('sql');
  const [fileName, setFileName] = useState(`${database}.${table}.sql`);
  const [includeCreateTable, setIncludeCreateTable] = useState(true);
  const [ifNotExists, setIfNotExists] = useState(true);
  const [exportData, setExportData] = useState(true);
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [selectedCols, setSelectedCols] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    ipc.schemaDescribe(connectionId, database, table).then((cols: ColumnMeta[]) => {
      if (cancelled) return;
      setColumns(cols);
      setSelectedCols(new Set(cols.map(c => c.name)));
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [connectionId, database, table]);

  const handleFormatChange = (f: ExportFormat) => {
    setFormat(f);
    const ext = FORMAT_EXT[f];
    // Replace extension in fileName
    setFileName(prev => {
      const dotIdx = prev.lastIndexOf('.');
      const base = dotIdx >= 0 ? prev.slice(0, dotIdx) : prev;
      return `${base}.${ext}`;
    });
  };

  const toggleCol = (name: string) => {
    setSelectedCols(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  };

  const allSelected = columns.length > 0 && selectedCols.size === columns.length;

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedCols(new Set());
    } else {
      setSelectedCols(new Set(columns.map(c => c.name)));
    }
  };

  const handleExport = async () => {
    setExporting(true);
    setError('');
    try {
      const filePath = await ipc.exportPickSaveFile(fileName, FORMAT_EXT[format]);
      if (!filePath) {
        setExporting(false);
        return;
      }

      const colNames = columns.filter(c => selectedCols.has(c.name)).map(c => c.name);

      let content = '';

      if (format === 'sql') {
        const parts: string[] = [];

        if (includeCreateTable) {
          let ddl: string = await ipc.schemaCreateTable(connectionId, database, table);
          if (ifNotExists) {
            ddl = ddl.replace(/^CREATE TABLE /i, 'CREATE TABLE IF NOT EXISTS ');
          }
          parts.push(ddl + ';');
        }

        if (exportData) {
          const rows: Record<string, unknown>[] = await ipc.exportFetchAllRows(connectionId, database, table, colNames);
          if (rows.length > 0) {
            parts.push(rowsToSqlInsert(rows, colNames, table));
          }
        }

        content = parts.join('\n\n');
      } else {
        const rows: Record<string, unknown>[] = await ipc.exportFetchAllRows(connectionId, database, table, colNames);
        content = formatRows(rows, colNames, format, table);
      }

      await ipc.exportWriteFile(filePath, content);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Export failed');
    } finally {
      setExporting(false);
    }
  };

  const colListDisabled = format === 'sql' ? !exportData : false;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 480 }}>
        <div className="modal-title">Export {database}.{table}</div>

        {/* Format toggle buttons */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 6 }}>Format</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {FORMAT_ORDER.map(f => (
              <button
                key={f}
                onClick={() => handleFormatChange(f)}
                style={{
                  padding: '4px 10px',
                  fontSize: 12,
                  borderRadius: 4,
                  border: '1px solid',
                  cursor: 'pointer',
                  borderColor: format === f ? '#4b6eaf' : '#515151',
                  background: format === f ? '#4b6eaf' : 'transparent',
                  color: format === f ? '#fff' : '#ccc',
                }}
              >
                {FORMAT_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        {/* File name */}
        <label style={{ display: 'block', marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>File Name</div>
          <input
            className="input"
            value={fileName}
            onChange={e => setFileName(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box' }}
          />
        </label>

        {/* SQL options */}
        {format === 'sql' && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={includeCreateTable}
                onChange={e => setIncludeCreateTable(e.target.checked)}
              />
              <span style={{ fontSize: 13 }}>CREATE TABLE statement</span>
            </label>
            {includeCreateTable && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, marginLeft: 24, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={ifNotExists}
                  onChange={e => setIfNotExists(e.target.checked)}
                />
                <span style={{ fontSize: 13, color: '#bbb' }}>IF NOT EXISTS</span>
              </label>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={exportData}
                onChange={e => setExportData(e.target.checked)}
              />
              <span style={{ fontSize: 13 }}>Export Data</span>
            </label>
          </div>
        )}

        {/* Column list */}
        {!loading && columns.length > 0 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontSize: 11, color: '#888' }}>Fields</div>
              <button
                onClick={handleSelectAll}
                disabled={colListDisabled}
                style={{
                  fontSize: 11,
                  color: colListDisabled ? '#555' : '#4b6eaf',
                  background: 'none',
                  border: 'none',
                  cursor: colListDisabled ? 'default' : 'pointer',
                  padding: 0,
                }}
              >
                {allSelected ? 'Deselect All' : 'Select All'}
              </button>
            </div>
            <div style={{
              maxHeight: 180,
              overflowY: 'auto',
              border: '1px solid #515151',
              borderRadius: 4,
              padding: '6px 8px',
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
            }}>
              {columns.map(col => (
                <label
                  key={col.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    cursor: colListDisabled ? 'default' : 'pointer',
                    opacity: colListDisabled ? 0.4 : 1,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedCols.has(col.name)}
                    disabled={colListDisabled}
                    onChange={() => toggleCol(col.name)}
                  />
                  <span style={{ fontSize: 12 }}>{col.name}</span>
                  <span style={{ fontSize: 11, color: '#666' }}>{col.type}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div style={{ padding: 8, borderRadius: 4, marginBottom: 12, fontSize: 12, background: '#2a0000', color: '#c75450' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleExport}
            disabled={exporting || loading || (format !== 'sql' && selectedCols.size === 0) || (format === 'sql' && !includeCreateTable && !exportData)}
          >
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>
    </div>
  );
}
