# Schema View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a schema viewer/editor tab for MySQL tables with editable columns grid, index management dialog, and DDL display.

**Architecture:** New `schema` tab type opens via sidebar context menu. SchemaView container with three zones: SchemaColumns (editable grid with bulk commit), SchemaIndexes (grid with add/edit dialog), SchemaDDL (read-only). New IPC handlers for SHOW FULL COLUMNS, SHOW INDEX, SHOW CREATE TABLE, and ALTER TABLE.

**Tech Stack:** React, existing DataGrid patterns, IPC handlers, mysql2

---

## File Structure

```
src/
├── shared/
│   └── types.ts                          # Add 'schema' to TabInfo.type, add FullColumnInfo/IndexInfo types
├── main/
│   ├── schema-browser.ts                 # Add fullColumns, indexes, createTableDDL, alterTable methods
│   └── ipc-handlers.ts                   # Add schema:full-columns, schema:indexes, schema:create-table, schema:alter-table
├── preload/
│   └── preload.ts                        # Add new IPC methods
└── renderer/
    ├── App.tsx                           # Add SchemaView rendering for schema tabs
    └── components/
        ├── Sidebar.tsx                   # Add "View Schema" to table right-click context menu
        ├── TabBar.tsx                    # Handle schema tab icon/label
        ├── SchemaView.tsx               # Container: three zones with resizable dividers
        ├── SchemaColumns.tsx            # Zone 1: editable columns grid
        ├── SchemaIndexes.tsx            # Zone 2: indexes grid with add/edit/drop
        ├── SchemaDDL.tsx                # Zone 3: read-only DDL display
        └── IndexDialog.tsx              # Modal for add/edit index
```

---

### Task 1: Types + IPC Backend

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/schema-browser.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/preload.ts`

- [ ] **Step 1: Add types to `src/shared/types.ts`**

Add `'schema'` to `TabInfo.type` union:

```typescript
// Change:
type: 'table' | 'console';
// To:
type: 'table' | 'console' | 'schema';
```

Add new interfaces after the existing ones:

```typescript
export interface FullColumnInfo {
  field: string;
  type: string;         // Full type string e.g. "varchar(255)" or "int(11) unsigned"
  baseType: string;     // Parsed: "VARCHAR", "INT", etc.
  length: string;       // Parsed: "255", "11", ""
  unsigned: boolean;    // Parsed from type
  zerofill: boolean;    // Parsed from type
  binary: boolean;      // Parsed from type
  nullable: boolean;    // Null = "YES"
  key: string;          // PRI, MUL, UNI, ""
  defaultValue: string | null;
  extra: string;        // auto_increment, on update current_timestamp(), etc.
  encoding: string;     // Parsed charset from Collation
  collation: string;    // Full collation string
  comment: string;
}

export interface IndexInfo {
  name: string;         // Key_name
  type: string;         // Index_type: BTREE, HASH, FULLTEXT
  columns: string[];    // Grouped Column_name values in order
  unique: boolean;      // Non_unique = 0
}
```

- [ ] **Step 2: Add methods to `src/main/schema-browser.ts`**

```typescript
  async fullColumns(pool: Pool, database: string, table: string): Promise<FullColumnInfo[]> {
    const [rows] = await pool.query(`SHOW FULL COLUMNS FROM \`${database}\`.\`${table}\``);
    return (rows as any[]).map(row => {
      const fullType: string = row.Type;
      // Parse base type, length, flags
      const typeMatch = fullType.match(/^(\w+)(?:\(([^)]+)\))?(.*)$/i);
      const baseType = (typeMatch?.[1] || fullType).toUpperCase();
      const length = typeMatch?.[2] || '';
      const flags = (typeMatch?.[3] || '').toLowerCase();

      // Parse charset from collation (e.g. "utf8mb4_unicode_ci" -> "utf8mb4")
      const collation = row.Collation || '';
      const encoding = collation ? collation.split('_')[0] : '';

      return {
        field: row.Field,
        type: fullType,
        baseType,
        length,
        unsigned: flags.includes('unsigned'),
        zerofill: flags.includes('zerofill'),
        binary: flags.includes('binary'),
        nullable: row.Null === 'YES',
        key: row.Key || '',
        defaultValue: row.Default,
        extra: row.Extra || '',
        encoding,
        collation,
        comment: row.Comment || '',
      };
    });
  }

  async indexes(pool: Pool, database: string, table: string): Promise<IndexInfo[]> {
    const [rows] = await pool.query(`SHOW INDEX FROM \`${database}\`.\`${table}\``);
    const map = new Map<string, IndexInfo>();
    for (const row of rows as any[]) {
      const name = row.Key_name;
      if (!map.has(name)) {
        map.set(name, {
          name,
          type: row.Index_type || 'BTREE',
          columns: [],
          unique: row.Non_unique === 0,
        });
      }
      map.get(name)!.columns.push(row.Column_name);
    }
    return Array.from(map.values());
  }

  async createTableDDL(pool: Pool, database: string, table: string): Promise<string> {
    const [rows] = await pool.query(`SHOW CREATE TABLE \`${database}\`.\`${table}\``);
    return (rows as any[])[0]?.['Create Table'] || '';
  }

  async alterTable(pool: Pool, sql: string): Promise<void> {
    await pool.query(sql);
  }
```

- [ ] **Step 3: Add IPC handlers to `src/main/ipc-handlers.ts`**

Add after the existing `schema:all-columns` handler:

```typescript
  ipcMain.handle('schema:full-columns', async (_, connectionId, database, table) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.fullColumns(pool, database, table);
  });

  ipcMain.handle('schema:indexes', async (_, connectionId, database, table) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.indexes(pool, database, table);
  });

  ipcMain.handle('schema:create-table', async (_, connectionId, database, table) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.createTableDDL(pool, database, table);
  });

  ipcMain.handle('schema:alter-table', async (_, connectionId, sql) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.alterTable(pool, sql);
  });
```

- [ ] **Step 4: Add IPC methods to `src/preload/preload.ts`**

Add after `schemaAllColumns`:

```typescript
  schemaFullColumns: (connectionId: string, database: string, table: string) => ipcRenderer.invoke('schema:full-columns', connectionId, database, table),
  schemaIndexes: (connectionId: string, database: string, table: string) => ipcRenderer.invoke('schema:indexes', connectionId, database, table),
  schemaCreateTable: (connectionId: string, database: string, table: string) => ipcRenderer.invoke('schema:create-table', connectionId, database, table),
  schemaAlterTable: (connectionId: string, sql: string) => ipcRenderer.invoke('schema:alter-table', connectionId, sql),
```

- [ ] **Step 5: Verify existing tests still pass**

```bash
npx vitest run
```

- [ ] **Step 6: Commit**

```bash
git add src/shared/types.ts src/main/schema-browser.ts src/main/ipc-handlers.ts src/preload/preload.ts
git commit -m "feat: add schema IPC handlers for full columns, indexes, DDL, and alter table

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Sidebar Context Menu + Tab Wiring

**Files:**
- Modify: `src/renderer/components/Sidebar.tsx`
- Modify: `src/renderer/components/TabBar.tsx`
- Modify: `src/renderer/App.tsx`
- Create: `src/renderer/components/SchemaView.tsx` (placeholder)

- [ ] **Step 1: Add "View Schema" to table context menu in Sidebar.tsx**

The tables in the sidebar currently don't have a context menu. Add one. Find where table nodes are rendered (the `handleTableClick` area) and add a right-click handler. Add a new handler:

```typescript
const handleTableContextMenu = (e: React.MouseEvent, conn: ConnectionConfig, database: string, table: string) => {
  e.preventDefault();
  setTableContextMenu({ x: e.clientX, y: e.clientY, conn, database, table });
};
```

Add state: `const [tableContextMenu, setTableContextMenu] = useState<{ x: number; y: number; conn: ConnectionConfig; database: string; table: string } | null>(null);`

On the table tree node div, add: `onContextMenu={(e) => handleTableContextMenu(e, conn, db.name, table)}`

Render the context menu:
```tsx
{tableContextMenu && (
  <div className="context-menu" style={{ left: tableContextMenu.x, top: tableContextMenu.y }}>
    <div className="context-menu-item" onClick={() => {
      openTab({ connectionId: tableContextMenu.conn.id, connectionName: tableContextMenu.conn.name, connectionColor: tableContextMenu.conn.color, type: 'table', database: tableContextMenu.database, table: tableContextMenu.table });
      setTableContextMenu(null);
    }}>Open Table</div>
    <div className="context-menu-item" onClick={() => {
      openTab({ connectionId: tableContextMenu.conn.id, connectionName: tableContextMenu.conn.name, connectionColor: tableContextMenu.conn.color, type: 'schema', database: tableContextMenu.database, table: tableContextMenu.table });
      setTableContextMenu(null);
    }}>View Schema</div>
  </div>
)}
```

Dismiss on click: add `setTableContextMenu(null)` to the existing window click handler.

- [ ] **Step 2: Update TabBar.tsx to handle schema tab icon/label**

In the tab label rendering, add the schema case:

```tsx
{tab.type === 'console' ? '⌨️ SQL Console' : tab.type === 'schema' ? `🔧 Schema: ${tab.table}` : `📋 ${tab.table}`}
```

- [ ] **Step 3: Create placeholder SchemaView.tsx**

`src/renderer/components/SchemaView.tsx`:
```tsx
import { TabInfo } from '../../shared/types';

interface Props {
  tab: TabInfo;
  isActive?: boolean;
}

export default function SchemaView({ tab, isActive }: Props) {
  return (
    <div className="schema-view">
      <div style={{ padding: 20, color: '#888' }}>Schema View: {tab.database}.{tab.table} (coming soon)</div>
    </div>
  );
}
```

- [ ] **Step 4: Wire SchemaView into App.tsx**

Add import and rendering:

```tsx
import SchemaView from './components/SchemaView';

// In the tabs.map, add:
{tab.type === 'schema' && <SchemaView tab={tab} isActive={tab.id === activeTabId} />}
```

- [ ] **Step 5: Update app-context.tsx duplicate detection**

In `openTab`, the duplicate check uses `t.type === opts.type && t.database === opts.database && t.table === opts.table`. This already works for schema tabs since type='schema' is different from type='table', so you can have both a data tab and a schema tab for the same table.

- [ ] **Step 6: Verify — right-click a table, "View Schema" opens a new tab with placeholder**

```bash
npm start
```

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Sidebar.tsx src/renderer/components/TabBar.tsx src/renderer/components/SchemaView.tsx src/renderer/App.tsx
git commit -m "feat: add View Schema in sidebar context menu with placeholder tab

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: SchemaDDL Component (Zone 3)

**Files:**
- Create: `src/renderer/components/SchemaDDL.tsx`

Starting with Zone 3 because it's the simplest and self-contained.

- [ ] **Step 1: Implement SchemaDDL.tsx**

```tsx
import { useState, useEffect } from 'react';
import { useIpc } from '../hooks/use-ipc';

interface Props {
  connectionId: string;
  database: string;
  table: string;
  refreshTrigger: number; // increment to force refresh
}

export default function SchemaDDL({ connectionId, database, table, refreshTrigger }: Props) {
  const ipc = useIpc();
  const [ddl, setDdl] = useState('');

  useEffect(() => {
    ipc.schemaCreateTable(connectionId, database, table)
      .then((text: string) => setDdl(text))
      .catch(() => setDdl('-- Failed to load DDL'));
  }, [connectionId, database, table, refreshTrigger]);

  const handleCopy = () => {
    navigator.clipboard.writeText(ddl);
  };

  // Simple syntax highlighting
  const highlighted = ddl
    .replace(/\b(CREATE TABLE|PRIMARY KEY|KEY|UNIQUE KEY|CONSTRAINT|FOREIGN KEY|REFERENCES|ENGINE|DEFAULT CHARSET|COLLATE|NOT NULL|NULL|AUTO_INCREMENT|DEFAULT|COMMENT|ON DELETE|ON UPDATE|CASCADE|SET NULL|RESTRICT|NO ACTION|UNSIGNED|CHARACTER SET)\b/gi,
      '<span style="color:#cc7832">$1</span>')
    .replace(/\b(int|bigint|smallint|tinyint|mediumint|varchar|char|text|mediumtext|longtext|blob|mediumblob|longblob|datetime|timestamp|date|time|decimal|float|double|enum|set|boolean|bit)\b/gi,
      '<span style="color:#6897bb">$1</span>')
    .replace(/'([^']*)'/g, '<span style="color:#a5c261">\'$1\'</span>');

  return (
    <div className="schema-ddl">
      <div className="schema-zone-toolbar">
        <span className="schema-zone-title">CREATE TABLE DDL</span>
        <div className="schema-zone-actions">
          <button className="btn btn-secondary" onClick={handleCopy}>📋 Copy</button>
        </div>
      </div>
      <div className="schema-ddl-content">
        <pre dangerouslySetInnerHTML={{ __html: highlighted }} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add CSS to `src/renderer/app.css`**

```css
/* Schema View */
.schema-view { display: flex; flex-direction: column; height: 100%; }
.schema-zone-toolbar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: #3c3f41; border-bottom: 1px solid #515151; font-size: 11px; }
.schema-zone-title { color: #a9b7c6; font-weight: 600; flex: 1; }
.schema-zone-actions { display: flex; gap: 6px; }
.schema-ddl { display: flex; flex-direction: column; flex: 1; min-height: 0; }
.schema-ddl-content { flex: 1; overflow: auto; padding: 12px; font-family: 'SF Mono', 'Fira Code', monospace; font-size: 12px; line-height: 1.6; background: #2b2b2b; }
.schema-ddl-content pre { margin: 0; white-space: pre-wrap; word-break: break-word; }
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SchemaDDL.tsx src/renderer/app.css
git commit -m "feat: implement SchemaDDL component with syntax-highlighted CREATE TABLE

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: SchemaColumns Component (Zone 1)

**Files:**
- Create: `src/renderer/components/SchemaColumns.tsx`

- [ ] **Step 1: Implement SchemaColumns.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { useAppContext } from '../context/app-context';
import { FullColumnInfo } from '../../shared/types';

interface Props {
  connectionId: string;
  database: string;
  table: string;
  onSchemaChanged: () => void; // triggers DDL refresh
}

const TYPE_OPTIONS = ['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'VARCHAR', 'CHAR', 'TEXT', 'MEDIUMTEXT', 'LONGTEXT', 'BLOB', 'MEDIUMBLOB', 'LONGBLOB', 'ENUM', 'SET', 'DATE', 'DATETIME', 'TIMESTAMP', 'TIME', 'BOOLEAN', 'BIT', 'JSON'];
const EXTRA_OPTIONS = ['', 'auto_increment', 'on update current_timestamp()'];

interface DraftColumn extends FullColumnInfo {
  __draft: true;
  __draftId: string;
}

type ColumnRow = FullColumnInfo | DraftColumn;

function isDraft(row: ColumnRow): row is DraftColumn {
  return '__draft' in row;
}

function buildColumnDef(col: ColumnRow): string {
  let def = `\`${col.field}\` ${col.baseType}`;
  if (col.length) def += `(${col.length})`;
  if (col.unsigned) def += ' UNSIGNED';
  if (col.zerofill) def += ' ZEROFILL';
  if (col.binary) def += ' BINARY';
  def += col.nullable ? ' NULL' : ' NOT NULL';
  if (col.defaultValue !== null && col.defaultValue !== undefined && col.defaultValue !== '') {
    const needsQuotes = !['CURRENT_TIMESTAMP', 'current_timestamp()', 'NULL'].includes(col.defaultValue) && !/^\d+$/.test(col.defaultValue);
    def += ` DEFAULT ${needsQuotes ? `'${col.defaultValue}'` : col.defaultValue}`;
  }
  if (col.extra) def += ` ${col.extra.toUpperCase()}`;
  if (col.comment) def += ` COMMENT '${col.comment.replace(/'/g, "\\'")}'`;
  if (col.encoding) def += ` CHARACTER SET ${col.encoding}`;
  if (col.collation) def += ` COLLATE ${col.collation}`;
  return def;
}

export default function SchemaColumns({ connectionId, database, table, onSchemaChanged }: Props) {
  const ipc = useIpc();
  const { setStatus } = useAppContext();
  const [columns, setColumns] = useState<FullColumnInfo[]>([]);
  const [drafts, setDrafts] = useState<DraftColumn[]>([]);
  const [changes, setChanges] = useState<Map<string, Partial<FullColumnInfo>>>(new Map());
  const [loading, setLoading] = useState(true);

  const loadColumns = useCallback(async () => {
    setLoading(true);
    try {
      const cols = await ipc.schemaFullColumns(connectionId, database, table);
      setColumns(cols);
      setChanges(new Map());
      setDrafts([]);
    } finally {
      setLoading(false);
    }
  }, [connectionId, database, table]);

  useEffect(() => { loadColumns(); }, [loadColumns]);

  const hasPending = changes.size > 0 || drafts.length > 0;

  const getColumnValue = (col: FullColumnInfo, field: keyof FullColumnInfo) => {
    const changed = changes.get(col.field);
    if (changed && field in changed) return changed[field];
    return col[field];
  };

  const updateColumn = (originalField: string, field: keyof FullColumnInfo, value: any) => {
    setChanges(prev => {
      const next = new Map(prev);
      const existing = next.get(originalField) || {};
      next.set(originalField, { ...existing, [field]: value });
      return next;
    });
  };

  const updateDraft = (draftId: string, field: keyof FullColumnInfo, value: any) => {
    setDrafts(prev => prev.map(d => d.__draftId === draftId ? { ...d, [field]: value } : d));
  };

  const addColumn = () => {
    const draft: DraftColumn = {
      __draft: true,
      __draftId: `draft_${Date.now()}`,
      field: '',
      type: 'varchar(255)',
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
    setDrafts(prev => [...prev, draft]);
  };

  const handleCommit = async () => {
    try {
      // Apply modifications
      for (const [originalField, mods] of changes) {
        const col = columns.find(c => c.field === originalField);
        if (!col) continue;
        const merged = { ...col, ...mods };
        const sql = `ALTER TABLE \`${database}\`.\`${table}\` MODIFY COLUMN ${buildColumnDef(merged)}`;
        await ipc.schemaAlterTable(connectionId, sql);
      }
      // Apply additions
      for (const draft of drafts) {
        if (!draft.field) continue;
        const sql = `ALTER TABLE \`${database}\`.\`${table}\` ADD COLUMN ${buildColumnDef(draft)}`;
        await ipc.schemaAlterTable(connectionId, sql);
      }
      setStatus('Schema changes committed', 'success');
      await loadColumns();
      onSchemaChanged();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`, 'error');
    }
  };

  const handleDrop = async (field: string) => {
    if (!confirm(`Drop column \`${field}\` from \`${table}\`?`)) return;
    try {
      await ipc.schemaAlterTable(connectionId, `ALTER TABLE \`${database}\`.\`${table}\` DROP COLUMN \`${field}\``);
      setStatus(`Column \`${field}\` dropped`, 'success');
      await loadColumns();
      onSchemaChanged();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`, 'error');
    }
  };

  const allRows: ColumnRow[] = [...columns, ...drafts];

  const renderCell = (col: ColumnRow, field: keyof FullColumnInfo, type: 'text' | 'checkbox' | 'dropdown' | 'readonly', options?: string[]) => {
    const value = isDraft(col) ? col[field] : getColumnValue(col as FullColumnInfo, field);
    const isChanged = !isDraft(col) && changes.has((col as FullColumnInfo).field) && field in (changes.get((col as FullColumnInfo).field) || {});
    const onChange = (val: any) => isDraft(col) ? updateDraft(col.__draftId, field, val) : updateColumn((col as FullColumnInfo).field, field, val);

    if (type === 'readonly') {
      return <span className="cell-readonly">{String(value || '')}</span>;
    }

    if (type === 'checkbox') {
      return (
        <span className={`cell-readonly ${isChanged ? 'cell-modified' : ''}`} style={{ textAlign: 'center', cursor: 'pointer' }} onClick={() => onChange(!value)}>
          {value ? '☑' : '☐'}
        </span>
      );
    }

    if (type === 'dropdown') {
      return (
        <select className="select cell-select" value={String(value || '')} onChange={e => onChange(e.target.value)} style={{ background: isChanged ? '#2d3b2d' : undefined }}>
          {options?.map(o => <option key={o} value={o}>{o || '(none)'}</option>)}
        </select>
      );
    }

    // text — double-click to edit
    return <DoubleClickEdit value={String(value || '')} onChange={onChange} isChanged={isChanged} />;
  };

  return (
    <div className="schema-columns">
      <div className="schema-zone-toolbar">
        <span className="schema-zone-title">Columns</span>
        <div className="schema-zone-actions">
          <button className="btn btn-primary" onClick={addColumn}>+ Add Column</button>
          <button className="btn btn-secondary" onClick={loadColumns}>↻ Refresh</button>
          {hasPending && <button className="btn btn-primary" onClick={handleCommit}>Commit</button>}
          {hasPending && <button className="btn btn-secondary" onClick={() => { setChanges(new Map()); setDrafts([]); }}>Discard</button>}
        </div>
      </div>
      {loading ? (
        <div style={{ padding: 20, color: '#666' }}>Loading...</div>
      ) : (
        <div className="datagrid-wrapper">
          <table className="datagrid">
            <thead>
              <tr>
                {['Field', 'Type', 'Length', 'Unsigned', 'Zerofill', 'Binary', 'Allow Null', 'Key', 'Default', 'Encoding', 'Extra', 'Collation', 'Comment', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allRows.map((col, i) => {
                const draft = isDraft(col);
                const key = draft ? col.__draftId : col.field;
                return (
                  <tr key={key} className={draft ? 'row-draft' : ''}>
                    <td>{renderCell(col, 'field', 'text')}</td>
                    <td>{renderCell(col, 'baseType', 'dropdown', TYPE_OPTIONS)}</td>
                    <td>{renderCell(col, 'length', 'text')}</td>
                    <td>{renderCell(col, 'unsigned', 'checkbox')}</td>
                    <td>{renderCell(col, 'zerofill', 'checkbox')}</td>
                    <td>{renderCell(col, 'binary', 'checkbox')}</td>
                    <td>{renderCell(col, 'nullable', 'checkbox')}</td>
                    <td>{renderCell(col, 'key', 'readonly')}</td>
                    <td>{renderCell(col, 'defaultValue', 'text')}</td>
                    <td>{renderCell(col, 'encoding', 'text')}</td>
                    <td>{renderCell(col, 'extra', 'dropdown', EXTRA_OPTIONS)}</td>
                    <td>{renderCell(col, 'collation', 'text')}</td>
                    <td>{renderCell(col, 'comment', 'text')}</td>
                    <td>
                      {draft ? (
                        <span style={{ color: '#c75450', cursor: 'pointer' }} onClick={() => setDrafts(prev => prev.filter(d => d.__draftId !== col.__draftId))}>✕ Remove</span>
                      ) : (
                        <span style={{ color: '#c75450', cursor: 'pointer' }} onClick={() => handleDrop(col.field)}>✕ Drop</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Inline double-click-to-edit component
function DoubleClickEdit({ value, onChange, isChanged }: { value: string; onChange: (v: string) => void; isChanged: boolean }) {
  const [editing, setEditing] = useState(false);
  const [editVal, setEditVal] = useState(value);

  if (editing) {
    return (
      <input
        className="input cell-input"
        value={editVal}
        onChange={e => setEditVal(e.target.value)}
        onBlur={() => { setEditing(false); if (editVal !== value) onChange(editVal); }}
        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); if (e.key === 'Escape') setEditing(false); }}
        autoFocus
      />
    );
  }

  return (
    <span className={`cell-editable ${isChanged ? 'cell-modified' : ''}`} onDoubleClick={() => { setEditVal(value); setEditing(true); }}>
      {value || <span className="cell-null">NULL</span>}
    </span>
  );
}
```

- [ ] **Step 2: Add CSS for schema-columns**

```css
.schema-columns { display: flex; flex-direction: column; flex: 2; min-height: 0; border-bottom: 2px solid #515151; }
.schema-columns .datagrid-wrapper { flex: 1; overflow: auto; }
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SchemaColumns.tsx src/renderer/app.css
git commit -m "feat: implement SchemaColumns with editable grid and bulk commit

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: SchemaIndexes + IndexDialog Components (Zone 2)

**Files:**
- Create: `src/renderer/components/SchemaIndexes.tsx`
- Create: `src/renderer/components/IndexDialog.tsx`

- [ ] **Step 1: Implement IndexDialog.tsx**

```tsx
import { useState } from 'react';

interface Props {
  columns: string[];
  initial?: { name: string; type: string; columns: string[]; unique: boolean };
  onSave: (data: { name: string; type: string; columns: string[]; unique: boolean }) => void;
  onClose: () => void;
}

export default function IndexDialog({ columns, initial, onSave, onClose }: Props) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState(initial?.type || 'INDEX');
  const [selectedCols, setSelectedCols] = useState<string[]>(initial?.columns || []);

  const isUnique = type === 'UNIQUE';

  const toggleColumn = (col: string) => {
    setSelectedCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
    if (!name || name.startsWith('idx_')) {
      const newCols = selectedCols.includes(col) ? selectedCols.filter(c => c !== col) : [...selectedCols, col];
      setName(`idx_${newCols.join('_')}`);
    }
  };

  const moveColumn = (col: string, direction: -1 | 1) => {
    const idx = selectedCols.indexOf(col);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= selectedCols.length) return;
    const next = [...selectedCols];
    [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
    setSelectedCols(next);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 450 }}>
        <div className="modal-title">{initial ? 'Edit' : 'Add'} Index</div>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Name</div>
          <input className="input" value={name} onChange={e => setName(e.target.value)} />
        </label>

        <label style={{ display: 'block', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Type</div>
          <select className="select" style={{ width: '100%' }} value={type} onChange={e => setType(e.target.value)}>
            <option value="INDEX">INDEX</option>
            <option value="UNIQUE">UNIQUE</option>
            <option value="FULLTEXT">FULLTEXT</option>
          </select>
        </label>

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Columns (click to select, arrows to reorder)</div>
          <div style={{ border: '1px solid #646464', borderRadius: 3, maxHeight: 200, overflow: 'auto' }}>
            {columns.map(col => {
              const isSelected = selectedCols.includes(col);
              const selIdx = selectedCols.indexOf(col);
              return (
                <div key={col} style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', gap: 8, background: isSelected ? '#214283' : 'transparent', cursor: 'pointer' }} onClick={() => toggleColumn(col)}>
                  <span>{isSelected ? '☑' : '☐'}</span>
                  <span style={{ flex: 1 }}>{col}</span>
                  {isSelected && (
                    <>
                      <span style={{ fontSize: 10, cursor: 'pointer', opacity: selIdx > 0 ? 1 : 0.3 }} onClick={e => { e.stopPropagation(); moveColumn(col, -1); }}>▲</span>
                      <span style={{ fontSize: 10, cursor: 'pointer', opacity: selIdx < selectedCols.length - 1 ? 1 : 0.3 }} onClick={e => { e.stopPropagation(); moveColumn(col, 1); }}>▼</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {selectedCols.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 11, color: '#888' }}>Order: {selectedCols.join(', ')}</div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave({ name, type, columns: selectedCols, unique: isUnique })} disabled={!name || selectedCols.length === 0}>
            {initial ? 'Update' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement SchemaIndexes.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { useAppContext } from '../context/app-context';
import { IndexInfo } from '../../shared/types';
import IndexDialog from './IndexDialog';

interface Props {
  connectionId: string;
  database: string;
  table: string;
  columnNames: string[];
  onSchemaChanged: () => void;
}

export default function SchemaIndexes({ connectionId, database, table, columnNames, onSchemaChanged }: Props) {
  const ipc = useIpc();
  const { setStatus } = useAppContext();
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ editing?: IndexInfo } | null>(null);

  const loadIndexes = useCallback(async () => {
    setLoading(true);
    try {
      const idxs = await ipc.schemaIndexes(connectionId, database, table);
      setIndexes(idxs);
    } finally {
      setLoading(false);
    }
  }, [connectionId, database, table]);

  useEffect(() => { loadIndexes(); }, [loadIndexes]);

  const handleAdd = () => setDialog({});

  const handleEdit = (idx: IndexInfo) => setDialog({ editing: idx });

  const handleSave = async (data: { name: string; type: string; columns: string[]; unique: boolean }) => {
    try {
      const cols = data.columns.map(c => `\`${c}\``).join(', ');
      const typePrefix = data.type === 'UNIQUE' ? 'UNIQUE ' : data.type === 'FULLTEXT' ? 'FULLTEXT ' : '';

      if (dialog?.editing) {
        // Edit = drop old + add new
        const dropPart = dialog.editing.name === 'PRIMARY' ? 'DROP PRIMARY KEY' : `DROP INDEX \`${dialog.editing.name}\``;
        const addPart = `ADD ${typePrefix}INDEX \`${data.name}\` (${cols})`;
        await ipc.schemaAlterTable(connectionId, `ALTER TABLE \`${database}\`.\`${table}\` ${dropPart}, ${addPart}`);
      } else {
        // Add new
        await ipc.schemaAlterTable(connectionId, `ALTER TABLE \`${database}\`.\`${table}\` ADD ${typePrefix}INDEX \`${data.name}\` (${cols})`);
      }

      setStatus(`Index \`${data.name}\` ${dialog?.editing ? 'updated' : 'created'}`, 'success');
      setDialog(null);
      await loadIndexes();
      onSchemaChanged();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`, 'error');
    }
  };

  const handleDrop = async (idx: IndexInfo) => {
    const msg = idx.name === 'PRIMARY' ? `Drop PRIMARY KEY from \`${table}\`?` : `Drop index \`${idx.name}\` from \`${table}\`?`;
    if (!confirm(msg)) return;
    try {
      const sql = idx.name === 'PRIMARY'
        ? `ALTER TABLE \`${database}\`.\`${table}\` DROP PRIMARY KEY`
        : `ALTER TABLE \`${database}\`.\`${table}\` DROP INDEX \`${idx.name}\``;
      await ipc.schemaAlterTable(connectionId, sql);
      setStatus(`Index \`${idx.name}\` dropped`, 'success');
      await loadIndexes();
      onSchemaChanged();
    } catch (err: any) {
      setStatus(`Error: ${err.message}`, 'error');
    }
  };

  return (
    <div className="schema-indexes">
      <div className="schema-zone-toolbar">
        <span className="schema-zone-title">Indexes</span>
        <div className="schema-zone-actions">
          <button className="btn btn-primary" onClick={handleAdd}>+ Add Index</button>
          <button className="btn btn-secondary" onClick={loadIndexes}>↻ Refresh</button>
        </div>
      </div>
      {loading ? (
        <div style={{ padding: 20, color: '#666' }}>Loading...</div>
      ) : (
        <div className="datagrid-wrapper">
          <table className="datagrid">
            <thead>
              <tr>
                {['Name', 'Type', 'Columns', 'Unique', 'Actions'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {indexes.map(idx => (
                <tr key={idx.name}>
                  <td><span className="cell-readonly" style={{ color: idx.name === 'PRIMARY' ? '#cc7832' : undefined }}>{idx.name}</span></td>
                  <td><span className="cell-readonly">{idx.type}</span></td>
                  <td><span className="cell-readonly">{idx.columns.join(', ')}</span></td>
                  <td><span className="cell-readonly" style={{ color: idx.unique ? '#a5c261' : undefined }}>{idx.unique ? 'YES' : 'NO'}</span></td>
                  <td>
                    <span style={{ color: '#4b6eaf', cursor: 'pointer', marginRight: 12 }} onClick={() => handleEdit(idx)}>✎ Edit</span>
                    <span style={{ color: '#c75450', cursor: 'pointer' }} onClick={() => handleDrop(idx)}>✕ Drop</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {dialog && (
        <IndexDialog
          columns={columnNames}
          initial={dialog.editing ? { name: dialog.editing.name, type: dialog.editing.unique ? 'UNIQUE' : dialog.editing.type === 'FULLTEXT' ? 'FULLTEXT' : 'INDEX', columns: dialog.editing.columns, unique: dialog.editing.unique } : undefined}
          onSave={handleSave}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add CSS**

```css
.schema-indexes { display: flex; flex-direction: column; flex: 1; min-height: 0; border-bottom: 2px solid #515151; }
.schema-indexes .datagrid-wrapper { flex: 1; overflow: auto; }
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/SchemaIndexes.tsx src/renderer/components/IndexDialog.tsx src/renderer/app.css
git commit -m "feat: implement SchemaIndexes grid with IndexDialog for add/edit

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: SchemaView Container

**Files:**
- Modify: `src/renderer/components/SchemaView.tsx`

- [ ] **Step 1: Replace placeholder with full implementation**

```tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { TabInfo, FullColumnInfo } from '../../shared/types';
import SchemaColumns from './SchemaColumns';
import SchemaIndexes from './SchemaIndexes';
import SchemaDDL from './SchemaDDL';

interface Props {
  tab: TabInfo;
  isActive?: boolean;
}

export default function SchemaView({ tab, isActive }: Props) {
  const ipc = useIpc();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [columnNames, setColumnNames] = useState<string[]>([]);

  // Divider positions
  const [divider1, setDivider1] = useState(300);
  const [divider2, setDivider2] = useState(500);
  const dragging = useRef<1 | 2 | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSchemaChanged = () => {
    setRefreshTrigger(prev => prev + 1);
    // Refresh column names for index dialog
    ipc.schemaFullColumns(tab.connectionId, tab.database!, tab.table!)
      .then((cols: FullColumnInfo[]) => setColumnNames(cols.map(c => c.field)))
      .catch(() => {});
  };

  // Load column names on mount for the index dialog
  useEffect(() => {
    ipc.schemaFullColumns(tab.connectionId, tab.database!, tab.table!)
      .then((cols: FullColumnInfo[]) => setColumnNames(cols.map(c => c.field)))
      .catch(() => {});
  }, [tab.connectionId, tab.database, tab.table]);

  // Cmd+R refresh
  useEffect(() => {
    if (!isActive) return;
    return window.electronAPI.onRefresh(() => handleSchemaChanged());
  }, [isActive]);

  // Resizer handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      if (dragging.current === 1) {
        setDivider1(Math.max(100, Math.min(y, divider2 - 50)));
      } else {
        setDivider2(Math.max(divider1 + 50, Math.min(y, rect.height - 80)));
      }
    };
    const handleMouseUp = () => { dragging.current = null; document.body.style.cursor = ''; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [divider1, divider2]);

  return (
    <div className="schema-view" ref={containerRef}>
      <div style={{ height: divider1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SchemaColumns connectionId={tab.connectionId} database={tab.database!} table={tab.table!} onSchemaChanged={handleSchemaChanged} />
      </div>
      <div className="sql-resizer" onMouseDown={() => { dragging.current = 1; document.body.style.cursor = 'row-resize'; }}>
        <span>⋯⋯⋯</span>
      </div>
      <div style={{ height: divider2 - divider1 - 4, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SchemaIndexes connectionId={tab.connectionId} database={tab.database!} table={tab.table!} columnNames={columnNames} onSchemaChanged={handleSchemaChanged} />
      </div>
      <div className="sql-resizer" onMouseDown={() => { dragging.current = 2; document.body.style.cursor = 'row-resize'; }}>
        <span>⋯⋯⋯</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <SchemaDDL connectionId={tab.connectionId} database={tab.database!} table={tab.table!} refreshTrigger={refreshTrigger} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/renderer/components/SchemaView.tsx
git commit -m "feat: implement SchemaView container with three resizable zones

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Final Wiring + Test

**Files:**
- Verify all components are properly imported and working

- [ ] **Step 1: Verify all tests pass**

```bash
npx vitest run
```

- [ ] **Step 2: Manual test checklist**

1. Right-click a table in sidebar → "View Schema" opens schema tab
2. Tab shows `🔧 Schema: tablename` with connection badge
3. Columns grid shows all columns with correct types, lengths, flags
4. Double-click column name → editable, commit applies ALTER TABLE MODIFY
5. Click checkbox (Unsigned, Nullable, etc.) → toggles, commit applies
6. "+ Add Column" → draft row appears, fill in, commit applies ALTER TABLE ADD
7. "Drop" on column → confirm dialog → column dropped → grid refreshes
8. Indexes grid shows all indexes grouped correctly
9. "+ Add Index" → dialog with column picker → creates index
10. "Edit" on index → dialog pre-filled → updates index
11. "Drop" on index → confirm → drops
12. DDL zone shows CREATE TABLE with syntax highlighting
13. DDL "Copy" copies to clipboard
14. All zones auto-refresh after any schema change
15. Cmd+R refreshes schema view when active

- [ ] **Step 3: Commit any fixes, then final commit**

```bash
git add -A
git commit -m "feat: complete schema view with columns editor, index management, and DDL display

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```
