import { useState, useRef, useEffect } from 'react';
import { ColumnMeta } from '../../shared/types';

interface Props {
  value: unknown;
  column: ColumnMeta;
  editable: boolean;
  onSave: (newValue: unknown) => void;
  onOpenTextModal: (value: string, onSave: (v: string) => void) => void;
}

const NUMBER_TYPES = /^(int|bigint|smallint|tinyint|mediumint|decimal|float|double|numeric)/i;
const TEXT_TYPES = /^(text|mediumtext|longtext|blob|mediumblob|longblob)/i;
const ENUM_TYPE = /^enum/i;

export default function CellEditor({ value, column, editable, onSave, onOpenTextModal }: Props) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  const isNull = value === null;
  const displayValue = isNull ? 'NULL' : String(value);
  const isNumber = NUMBER_TYPES.test(column.type);
  const isText = TEXT_TYPES.test(column.type);
  const isEnum = ENUM_TYPE.test(column.type);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
      selectRef.current?.focus();
    }
  }, [editing]);

  if (!editable) {
    return <span className={`cell-readonly ${isNull ? 'cell-null' : ''}`}>{displayValue}</span>;
  }

  if (isEnum && column.enumValues) {
    if (editing) {
      return (
        <select
          ref={selectRef}
          className="select cell-select"
          value={isNull ? '' : String(value)}
          onChange={e => { onSave(e.target.value || null); setEditing(false); }}
          onBlur={() => setEditing(false)}
          onKeyDown={e => { if (e.key === 'Escape') setEditing(false); }}
        >
          {column.nullable && <option value="">NULL</option>}
          {column.enumValues.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
      );
    }
    return (
      <span
        className={`cell-editable ${isNull ? 'cell-null' : ''}`}
        onDoubleClick={() => setEditing(true)}
      >
        {displayValue}
      </span>
    );
  }

  if (isText) {
    return (
      <span
        className="cell-text-trigger"
        onDoubleClick={() => onOpenTextModal(isNull ? '' : String(value), (v) => onSave(v || null))}
      >
        {isNull ? <span className="cell-null">NULL</span> : `${displayValue.slice(0, 50)}${displayValue.length > 50 ? '...' : ''}`}
        <span className="cell-text-icon">📝</span>
      </span>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="input cell-input"
        type={isNumber ? 'number' : 'text'}
        value={editValue}
        onChange={e => setEditValue(e.target.value)}
        onBlur={() => {
          setEditing(false);
          const newVal = editValue === '' && column.nullable ? null : isNumber ? Number(editValue) : editValue;
          if (newVal !== value) onSave(newVal);
        }}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
          if (e.key === 'Escape') setEditing(false);
        }}
      />
    );
  }

  return (
    <span
      className={`cell-editable ${isNull ? 'cell-null' : ''}`}
      onDoubleClick={() => { setEditValue(isNull ? '' : String(value)); setEditing(true); }}
    >
      {displayValue}
    </span>
  );
}
