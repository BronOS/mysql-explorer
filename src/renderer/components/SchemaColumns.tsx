import { useState, useEffect, useRef } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { useAppContext } from '../context/app-context';
import { FullColumnInfo } from '../../shared/types';

interface Props {
  connectionId: string;
  database: string;
  table: string;
  isActive?: boolean;
  onSchemaChanged: () => void;
}

const TYPE_OPTIONS = [
  'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT',
  'DECIMAL', 'FLOAT', 'DOUBLE',
  'VARCHAR', 'CHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT',
  'BLOB', 'MEDIUMBLOB', 'LONGBLOB',
  'ENUM', 'SET',
  'DATE', 'DATETIME', 'TIMESTAMP', 'TIME',
  'BOOLEAN', 'BIT', 'JSON',
];

const EXTRA_OPTIONS = ['', 'auto_increment', 'on update current_timestamp()'];

// key: `fieldName:colName` for originals, `draft:draftId:colName` for drafts
type ChangeKey = string;

interface DraftColumn extends FullColumnInfo {
  __draftId: string;
}

// Inline double-click text editor
function DoubleClickEdit({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  // Sync external value when not editing
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onChange(draft);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="cell-input"
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
      />
    );
  }

  return (
    <span
      className={`cell-editable ${className ?? ''}`}
      title="Double-click to edit"
      onDoubleClick={() => { setDraft(value); setEditing(true); }}
    >
      {value || <span className="cell-null">{placeholder ?? ''}</span>}
    </span>
  );
}

function buildColumnDef(col: FullColumnInfo): string {
  let typePart = col.baseType || col.type;

  // Append length for types that support it
  const lengthTypes = ['VARCHAR', 'CHAR', 'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'BIT'];
  if (col.length && lengthTypes.some(t => typePart.toUpperCase() === t)) {
    typePart = `${typePart}(${col.length})`;
  }

  const parts: string[] = [`\`${col.field}\` ${typePart}`];

  if (col.unsigned) parts.push('UNSIGNED');
  if (col.zerofill) parts.push('ZEROFILL');
  if (col.binary) parts.push('BINARY');
  if (!col.nullable) parts.push('NOT NULL');
  if (col.defaultValue !== null && col.defaultValue !== undefined) {
    const needsQuote = !['CURRENT_TIMESTAMP', 'NULL', 'current_timestamp()'].includes(col.defaultValue);
    parts.push(`DEFAULT ${needsQuote ? `'${col.defaultValue.replace(/'/g, "\\'")}'` : col.defaultValue}`);
  }
  if (col.extra) parts.push(col.extra.toUpperCase() === 'AUTO_INCREMENT' ? 'AUTO_INCREMENT' : col.extra);
  if (col.collation) parts.push(`COLLATE ${col.collation}`);
  if (col.comment) parts.push(`COMMENT '${col.comment.replace(/'/g, "\\'")}'`);

  return parts.join(' ');
}

export default function SchemaColumns({ connectionId, database, table, isActive, onSchemaChanged }: Props) {
  const ipc = useIpc();
  const { setStatus } = useAppContext();

  const [columns, setColumns] = useState<FullColumnInfo[]>([]);
  const [drafts, setDrafts] = useState<DraftColumn[]>([]);
  const [changes, setChanges] = useState<Map<ChangeKey, Partial<FullColumnInfo>>>(new Map());
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await ipc.schemaFullColumns(connectionId, database, table);
      setColumns(data);
      setDrafts([]);
      setChanges(new Map());
    } catch (e: any) {
      setStatus(`Failed to load columns: ${e?.message ?? e}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loaded = useRef(false);
  useEffect(() => {
    if (isActive && !loaded.current) { loaded.current = true; load(); }
  }, [isActive, connectionId, database, table]);

  const hasPending = changes.size > 0 || drafts.length > 0;

  // Apply a field change to the changes map
  const applyChange = (field: string, colName: keyof FullColumnInfo, value: unknown) => {
    const key: ChangeKey = `field:${field}:${colName}`;
    setChanges(prev => {
      const next = new Map(prev);
      const existing = next.get(`field:${field}`) ?? {};
      next.set(`field:${field}`, { ...existing, [colName]: value });
      return next;
    });
  };

  const applyDraftChange = (draftId: string, colName: keyof FullColumnInfo, value: unknown) => {
    setDrafts(prev => prev.map(d =>
      d.__draftId === draftId ? { ...d, [colName]: value } : d
    ));
  };

  const getMergedColumn = (col: FullColumnInfo): FullColumnInfo => {
    const override = changes.get(`field:${col.field}`) ?? {};
    return { ...col, ...override };
  };

  const handleCommit = async () => {
    const stmts: string[] = [];

    // MODIFY COLUMN for changed originals
    for (const col of columns) {
      const override = changes.get(`field:${col.field}`);
      if (!override) continue;
      const merged = getMergedColumn(col);
      const def = buildColumnDef(merged);
      stmts.push(`ALTER TABLE \`${database}\`.\`${table}\` MODIFY COLUMN ${def}`);
    }

    // ADD COLUMN for drafts
    for (const draft of drafts) {
      const def = buildColumnDef(draft);
      stmts.push(`ALTER TABLE \`${database}\`.\`${table}\` ADD COLUMN ${def}`);
    }

    if (stmts.length === 0) return;

    try {
      for (const sql of stmts) {
        await ipc.schemaAlterTable(connectionId, sql);
      }
      setStatus(`Committed ${stmts.length} change(s) to ${table}`, 'success');
      onSchemaChanged();
      await load();
    } catch (e: any) {
      setStatus(`Commit failed: ${e?.message ?? e}`, 'error');
    }
  };

  const handleDiscard = () => {
    setChanges(new Map());
    setDrafts([]);
  };

  const handleAddColumn = () => {
    const draftId = Math.random().toString(36).slice(2, 10);
    const newCol: DraftColumn = {
      __draftId: draftId,
      field: 'new_column',
      type: 'VARCHAR(255)',
      baseType: 'VARCHAR',
      length: '255',
      unsigned: false,
      zerofill: false,
      binary: false,
      nullable: true,
      key: '',
      defaultValue: null,
      extra: '',
      encoding: '',
      collation: '',
      comment: '',
    };
    setDrafts(prev => [...prev, newCol]);
  };

  const handleDrop = async (field: string) => {
    if (!confirm(`Drop column \`${field}\` from \`${table}\`? This cannot be undone.`)) return;
    try {
      await ipc.schemaAlterTable(connectionId, `ALTER TABLE \`${database}\`.\`${table}\` DROP COLUMN \`${field}\``);
      setStatus(`Dropped column ${field}`, 'success');
      onSchemaChanged();
      await load();
    } catch (e: any) {
      setStatus(`Drop failed: ${e?.message ?? e}`, 'error');
    }
  };

  const handleDropDraft = (draftId: string) => {
    setDrafts(prev => prev.filter(d => d.__draftId !== draftId));
  };

  const renderCheckbox = (
    checked: boolean,
    onChange: (v: boolean) => void,
    modified: boolean,
    readonly = false,
  ) => (
    <td className={modified ? 'cell-modified' : ''} style={{ textAlign: 'center' }}>
      <input
        type="checkbox"
        checked={checked}
        disabled={readonly}
        style={{ cursor: readonly ? 'default' : 'pointer' }}
        onChange={readonly ? undefined : (e) => onChange(e.target.checked)}
      />
    </td>
  );

  const renderText = (
    value: string,
    onChange: (v: string) => void,
    modified: boolean,
    placeholder?: string,
  ) => (
    <td className={modified ? 'cell-modified' : ''}>
      <DoubleClickEdit value={value} onChange={onChange} placeholder={placeholder} />
    </td>
  );

  const renderDropdown = (
    value: string,
    options: string[],
    onChange: (v: string) => void,
    modified: boolean,
  ) => (
    <td className={modified ? 'cell-modified' : ''}>
      <select
        className="cell-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.includes(value) ? null : <option value={value}>{value}</option>}
        {options.map(o => <option key={o} value={o}>{o || '(none)'}</option>)}
      </select>
    </td>
  );

  const renderReadonly = (value: string) => (
    <td>
      <span className="cell-readonly">{value}</span>
    </td>
  );

  const renderColumnRow = (col: FullColumnInfo, isDraft: boolean, draftId?: string) => {
    const isModifiedField = (f: keyof FullColumnInfo) => {
      if (isDraft) return true;
      const override = changes.get(`field:${col.field}`);
      return override ? f in override : false;
    };

    const handleChange = (f: keyof FullColumnInfo) => (v: unknown) => {
      if (isDraft && draftId) {
        applyDraftChange(draftId, f, v);
      } else {
        applyChange(col.field, f, v);
      }
    };

    return (
      <tr key={isDraft ? draftId : col.field} className={isDraft ? 'row-draft' : ''}>
        {/* Field */}
        {renderText(col.field, handleChange('field') as (v: string) => void, isModifiedField('field'))}
        {/* Type */}
        {renderDropdown(col.baseType || col.type.replace(/\(.*/, ''), TYPE_OPTIONS, handleChange('baseType') as (v: string) => void, isModifiedField('baseType'))}
        {/* Length */}
        {renderText(col.length, handleChange('length') as (v: string) => void, isModifiedField('length'), 'e.g. 255')}
        {/* Unsigned */}
        {renderCheckbox(col.unsigned, handleChange('unsigned') as (v: boolean) => void, isModifiedField('unsigned'))}
        {/* Zerofill */}
        {renderCheckbox(col.zerofill, handleChange('zerofill') as (v: boolean) => void, isModifiedField('zerofill'))}
        {/* Binary */}
        {renderCheckbox(col.binary, handleChange('binary') as (v: boolean) => void, isModifiedField('binary'))}
        {/* Allow Null */}
        {renderCheckbox(col.nullable, handleChange('nullable') as (v: boolean) => void, isModifiedField('nullable'))}
        {/* Key (read-only) */}
        {renderReadonly(col.key)}
        {/* Default */}
        {renderText(col.defaultValue ?? '', (v) => handleChange('defaultValue')(v || null), isModifiedField('defaultValue'), 'NULL')}
        {/* Encoding */}
        {renderText(col.encoding, handleChange('encoding') as (v: string) => void, isModifiedField('encoding'))}
        {/* Extra */}
        {renderDropdown(col.extra, EXTRA_OPTIONS, handleChange('extra') as (v: string) => void, isModifiedField('extra'))}
        {/* Collation */}
        {renderText(col.collation, handleChange('collation') as (v: string) => void, isModifiedField('collation'))}
        {/* Comment */}
        {renderText(col.comment, handleChange('comment') as (v: string) => void, isModifiedField('comment'))}
        {/* Actions */}
        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
          {isDraft ? (
            <button
              className="btn btn-danger"
              style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={() => draftId && handleDropDraft(draftId)}
              title="Remove draft row"
            >
              ✕
            </button>
          ) : (
            <button
              className="btn btn-danger"
              style={{ padding: '2px 8px', fontSize: 11 }}
              onClick={() => handleDrop(col.field)}
              title={`Drop column ${col.field}`}
            >
              Drop
            </button>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="schema-columns">
      <div className="schema-zone-toolbar">
        <span className="schema-zone-title">Columns</span>
        <div className="schema-zone-actions">
          <button className="btn btn-secondary" onClick={handleAddColumn} title="Add column">+ Add Column</button>
          <button className="btn btn-secondary" onClick={load} title="Refresh columns">Refresh</button>
          {hasPending && (
            <>
              <button className="btn btn-primary" onClick={handleCommit} title="Commit all pending changes">Commit</button>
              <button className="btn btn-secondary" onClick={handleDiscard} title="Discard all pending changes">Discard</button>
            </>
          )}
        </div>
      </div>

      <div className="datagrid-wrapper">
        {loading ? (
          <div style={{ padding: 16, color: '#888' }}>Loading columns...</div>
        ) : (
          <table className="datagrid">
            <thead>
              <tr>
                <th>Field</th>
                <th>Type</th>
                <th>Length</th>
                <th>Unsigned</th>
                <th>Zerofill</th>
                <th>Binary</th>
                <th>Allow Null</th>
                <th>Key</th>
                <th>Default</th>
                <th>Encoding</th>
                <th>Extra</th>
                <th>Collation</th>
                <th>Comment</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {columns.map(col => renderColumnRow(getMergedColumn(col), false))}
              {drafts.map(draft => renderColumnRow(draft, true, draft.__draftId))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
