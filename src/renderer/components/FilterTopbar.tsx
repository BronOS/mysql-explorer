import { useState } from 'react';
import { ColumnMeta, FilterCondition } from '../../shared/types';

const OPERATORS = ['=', '!=', '>', '<', '>=', '<=', 'LIKE', 'IS NULL', 'IS NOT NULL'] as const;
const NO_VALUE_OPS = new Set(['IS NULL', 'IS NOT NULL']);

interface Props {
  columns: ColumnMeta[];
  onFilterChange: (where: string) => void;
  saveMode: 'auto' | 'bulk';
  onSaveModeChange: (mode: 'auto' | 'bulk') => void;
  onRefresh: () => void;
}

export default function FilterTopbar({ columns, onFilterChange, saveMode, onSaveModeChange, onRefresh }: Props) {
  const [mode, setMode] = useState<'structured' | 'raw'>('structured');
  const [filters, setFilters] = useState<FilterCondition[]>([]);
  const [rawWhere, setRawWhere] = useState('');

  const switchMode = (newMode: 'structured' | 'raw') => {
    setMode(newMode);
    setFilters([]);
    setRawWhere('');
    onFilterChange('');
  };

  const buildStructuredWhere = (updated: FilterCondition[]): string => {
    return updated
      .map((f, i) => {
        const prefix = i === 0 ? '' : `${f.logic} `;
        if (NO_VALUE_OPS.has(f.operator)) {
          return `${prefix}\`${f.column}\` ${f.operator}`;
        }
        return `${prefix}\`${f.column}\` ${f.operator} '${f.value}'`;
      })
      .join(' ');
  };

  const addFilter = () => {
    const newFilter: FilterCondition = {
      column: columns[0]?.name || '',
      operator: '=',
      value: '',
      logic: 'AND',
    };
    setFilters([...filters, newFilter]);
  };

  const updateFilter = (index: number, updates: Partial<FilterCondition>) => {
    const updated = filters.map((f, i) => i === index ? { ...f, ...updates } : f);
    setFilters(updated);
    onFilterChange(buildStructuredWhere(updated));
  };

  const removeFilter = (index: number) => {
    const updated = filters.filter((_, i) => i !== index);
    setFilters(updated);
    onFilterChange(buildStructuredWhere(updated));
  };

  const applyRawWhere = () => {
    onFilterChange(rawWhere);
  };

  return (
    <div className="filter-topbar">
      <div className="filter-left">
        <span
          className={`filter-mode-btn ${mode === 'structured' ? 'filter-mode-active' : ''}`}
          onClick={() => switchMode('structured')}
        >
          Filters
        </span>
        <span
          className={`filter-mode-btn ${mode === 'raw' ? 'filter-mode-active' : ''}`}
          onClick={() => switchMode('raw')}
        >
          WHERE clause
        </span>

        {mode === 'structured' && (
          <>
            {filters.map((f, i) => (
              <div key={i} className="filter-chip">
                {i > 0 && (
                  <select className="select" style={{ width: 60, padding: '2px 4px', fontSize: 10 }}
                    value={f.logic} onChange={e => updateFilter(i, { logic: e.target.value as 'AND' | 'OR' })}>
                    <option value="AND">AND</option>
                    <option value="OR">OR</option>
                  </select>
                )}
                <select className="select" style={{ padding: '2px 4px', fontSize: 10 }}
                  value={f.column} onChange={e => updateFilter(i, { column: e.target.value })}>
                  {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                </select>
                <select className="select" style={{ width: 80, padding: '2px 4px', fontSize: 10 }}
                  value={f.operator} onChange={e => updateFilter(i, { operator: e.target.value as any })}>
                  {OPERATORS.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
                {!NO_VALUE_OPS.has(f.operator) && (
                  <input className="input" style={{ width: 100, padding: '2px 6px', fontSize: 10 }}
                    value={f.value} onChange={e => updateFilter(i, { value: e.target.value })} />
                )}
                <span className="filter-remove" onClick={() => removeFilter(i)}>✕</span>
              </div>
            ))}
            <span className="filter-add" onClick={addFilter}>+ Add Filter</span>
          </>
        )}

        {mode === 'raw' && (
          <input
            className="input"
            style={{ flex: 1, maxWidth: 400, padding: '4px 8px', fontSize: 11 }}
            placeholder="e.g. status = 'active' AND age > 18"
            value={rawWhere}
            onChange={e => setRawWhere(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && applyRawWhere()}
          />
        )}
      </div>

      <div className="filter-right">
        <button className="btn btn-secondary" onClick={onRefresh} title="Refresh">↻</button>
        <span style={{ opacity: 0.6, fontSize: 11 }}>Save Mode:</span>
        <span
          className={`filter-mode-btn ${saveMode === 'auto' ? 'save-mode-active' : ''}`}
          onClick={() => onSaveModeChange('auto')}
        >
          Auto-Save
        </span>
        <span
          className={`filter-mode-btn ${saveMode === 'bulk' ? 'save-mode-active' : ''}`}
          onClick={() => onSaveModeChange('bulk')}
        >
          Bulk Commit
        </span>
      </div>
    </div>
  );
}
