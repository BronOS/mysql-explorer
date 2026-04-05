# Schema Objects Browser & Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add sidebar browsing, DDL viewing/editing, creation, and dropping for Views, Procedures, Functions, Triggers, and Events.

**Architecture:** Extend the SchemaTree type and app-context reducer to store object lists per database. Add a new `SchemaObjectTab` component with CodeMirror in view/edit modes. Add two new IPC handlers (`schema:execute-ddl`, `schema:drop-object`). Extend Sidebar with five new expandable groups per database, context menus on groups (New) and items (Open, Drop).

**Tech Stack:** React, TypeScript, CodeMirror 6, Electron IPC, mysql2

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/shared/types.ts` | Modify | Extend TabInfo and SchemaTree types |
| `src/renderer/context/app-context.tsx` | Modify | Add SET_OBJECTS reducer action, update openTab dedup logic |
| `src/main/ipc-handlers.ts` | Modify | Add `schema:execute-ddl` and `schema:drop-object` handlers |
| `src/preload/preload.ts` | Modify | Expose new IPC methods |
| `src/renderer/components/SchemaObjectTab.tsx` | Create | DDL view/edit tab with CodeMirror |
| `src/renderer/components/Sidebar.tsx` | Modify | Add object groups, context menus, lazy loading |
| `src/renderer/App.tsx` | Modify | Route `object` tab type to SchemaObjectTab |
| `src/renderer/components/TabBar.tsx` | Modify | Add badge for object tabs |

---

### Task 1: Extend types and app-context

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/renderer/context/app-context.tsx`

- [ ] **Step 1: Extend TabInfo in types.ts**

In `src/shared/types.ts`, change the TabInfo interface:

```typescript
export interface TabInfo {
  id: string;
  connectionId: string;
  connectionName: string;
  connectionColor: string;
  type: 'table' | 'console' | 'schema' | 'object';
  database?: string;
  table?: string;
  objectType?: 'view' | 'procedure' | 'function' | 'trigger' | 'event';
  objectName?: string;
  lastAccessed: number;
}
```

- [ ] **Step 2: Extend SchemaTree database type in types.ts**

Change the databases array item type inside `SchemaTree`:

```typescript
export interface SchemaTree {
  [connectionId: string]: {
    databases: {
      name: string;
      tables: string[];
      columns: { [tableName: string]: string[] };
      views: string[];
      procedures: string[];
      functions: string[];
      triggers: string[];
      events: string[];
      loaded: boolean;
    }[];
    loaded: boolean;
  };
}
```

- [ ] **Step 3: Add SET_OBJECTS action to app-context.tsx**

Add to the Action union type:

```typescript
  | { type: 'SET_OBJECTS'; connectionId: string; database: string; objectType: 'views' | 'procedures' | 'functions' | 'triggers' | 'events'; items: string[] }
```

Add reducer case after SET_COLUMNS:

```typescript
    case 'SET_OBJECTS': {
      const connSchema = state.schema[action.connectionId];
      if (!connSchema) return state;
      const databases = connSchema.databases.map(db =>
        db.name === action.database ? { ...db, [action.objectType]: action.items } : db
      );
      return {
        ...state,
        schema: { ...state.schema, [action.connectionId]: { ...connSchema, databases } },
      };
    }
```

- [ ] **Step 4: Update openTab dedup logic to handle object tabs**

In `app-context.tsx`, the `openTab` callback checks for existing tabs. Update the `find` to also match `objectType` and `objectName`:

```typescript
  const openTab = useCallback((opts: Omit<TabInfo, 'id' | 'lastAccessed'>) => {
    const existing = state.tabs.find(t =>
      t.connectionId === opts.connectionId &&
      t.type === opts.type &&
      t.database === opts.database &&
      t.table === opts.table &&
      t.objectType === opts.objectType &&
      t.objectName === opts.objectName
    );
    if (existing) {
      dispatch({ type: 'SET_ACTIVE_TAB', tabId: existing.id });
      return;
    }
    const tab: TabInfo = { ...opts, id: randomId(), lastAccessed: Date.now() };
    dispatch({ type: 'OPEN_TAB', tab });
  }, [state.tabs]);
```

- [ ] **Step 5: Fix SET_SCHEMA initializers**

Anywhere in the codebase that dispatches `SET_SCHEMA` with database objects, the new fields need defaults. Search for `SET_SCHEMA` dispatches in Sidebar.tsx. Each place that creates `{ name, tables: [], columns: {}, loaded: false }` must add the new fields: `views: [], procedures: [], functions: [], triggers: [], events: []`.

There are approximately 4 places in Sidebar.tsx. Update all of them to:
```typescript
{ name, tables: [], columns: {}, views: [], procedures: [], functions: [], triggers: [], events: [], loaded: false }
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors (or only pre-existing node_modules errors)

- [ ] **Step 7: Commit**

```bash
git add src/shared/types.ts src/renderer/context/app-context.tsx src/renderer/components/Sidebar.tsx
git commit -m "feat: extend types and state for schema objects (views, procedures, functions, triggers, events)"
```

---

### Task 2: Add IPC handlers for execute-ddl and drop-object

**Files:**
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/preload.ts`

- [ ] **Step 1: Add IPC handlers in ipc-handlers.ts**

Add after the existing schema object handlers (after `schema:create-event`), before `// Query`:

```typescript
  ipcMain.handle('schema:execute-ddl', async (_, connectionId, sql) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    await pool.query(sql);
  });

  ipcMain.handle('schema:drop-object', async (_, connectionId, database, objectType, name) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    await pool.query(`DROP ${objectType} \`${database}\`.\`${name}\``);
  });
```

- [ ] **Step 2: Add preload methods in preload.ts**

Add after the existing schema object methods (after `schemaCreateEvent`), before `// Query`:

```typescript
  schemaExecuteDdl: (connectionId: string, sql: string) => ipcRenderer.invoke('schema:execute-ddl', connectionId, sql),
  schemaDropObject: (connectionId: string, database: string, objectType: string, name: string) => ipcRenderer.invoke('schema:drop-object', connectionId, database, objectType, name),
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/main/ipc-handlers.ts src/preload/preload.ts
git commit -m "feat: add execute-ddl and drop-object IPC handlers"
```

---

### Task 3: Create SchemaObjectTab component

**Files:**
- Create: `src/renderer/components/SchemaObjectTab.tsx`

- [ ] **Step 1: Create SchemaObjectTab.tsx**

This component shows a CodeMirror editor with view/edit toggle for schema objects (views, procedures, functions, triggers, events).

```typescript
import { useState, useEffect, useRef, useMemo } from 'react';
import CodeMirror, { ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { sql, MySQL } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { EditorView } from '@codemirror/view';
import { useIpc } from '../hooks/use-ipc';
import { useAppContext } from '../context/app-context';
import { TabInfo } from '../../shared/types';

interface Props {
  tab: TabInfo;
  isActive?: boolean;
}

type ObjectType = 'view' | 'procedure' | 'function' | 'trigger' | 'event';

const TYPE_LABELS: Record<ObjectType, string> = {
  view: 'View',
  procedure: 'Procedure',
  function: 'Function',
  trigger: 'Trigger',
  event: 'Event',
};

const TYPE_SQL: Record<ObjectType, string> = {
  view: 'VIEW',
  procedure: 'PROCEDURE',
  function: 'FUNCTION',
  trigger: 'TRIGGER',
  event: 'EVENT',
};

const DDL_TEMPLATES: Record<ObjectType, string> = {
  view: 'CREATE VIEW `new_view` AS\nSELECT * FROM `table_name`;',
  procedure: 'CREATE PROCEDURE `new_procedure`()\nBEGIN\n  \nEND',
  function: 'CREATE FUNCTION `new_function`() RETURNS INT\nBEGIN\n  RETURN 0;\nEND',
  trigger: 'CREATE TRIGGER `new_trigger`\nBEFORE INSERT ON `table_name`\nFOR EACH ROW\nBEGIN\n  \nEND',
  event: 'CREATE EVENT `new_event`\nON SCHEDULE EVERY 1 DAY\nDO\nBEGIN\n  \nEND',
};

// IPC method to fetch DDL for each object type
const DDL_FETCHERS: Record<ObjectType, string> = {
  view: 'schemaCreateView',
  procedure: 'schemaCreateProcedure',
  function: 'schemaCreateFunction',
  trigger: 'schemaCreateTrigger',
  event: 'schemaCreateEvent',
};

export default function SchemaObjectTab({ tab, isActive }: Props) {
  const ipc = useIpc();
  const { setStatus } = useAppContext();
  const objectType = tab.objectType as ObjectType;
  const objectName = tab.objectName || '';
  const isNew = !objectName;

  const [originalDdl, setOriginalDdl] = useState('');
  const [code, setCode] = useState('');
  const [editing, setEditing] = useState(isNew);
  const [loading, setLoading] = useState(!isNew);
  const [showConfirm, setShowConfirm] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const editorRef = useRef<ReactCodeMirrorRef>(null);

  // Load DDL for existing objects
  useEffect(() => {
    if (isNew || !isActive) return;
    setLoading(true);
    const fetcher = DDL_FETCHERS[objectType];
    (ipc as any)[fetcher](tab.connectionId, tab.database, objectName).then((ddl: string) => {
      setOriginalDdl(ddl);
      setCode(ddl);
      setLoading(false);
    }).catch((err: any) => {
      setError(err.message || 'Failed to load DDL');
      setLoading(false);
    });
  }, [isActive, tab.connectionId, tab.database, objectName, objectType, isNew]);

  // Set template for new objects
  useEffect(() => {
    if (isNew) {
      setCode(DDL_TEMPLATES[objectType]);
      setEditing(true);
    }
  }, [isNew, objectType]);

  // Focus editor when active
  useEffect(() => {
    if (isActive) {
      setTimeout(() => editorRef.current?.view?.focus(), 50);
    }
  }, [isActive]);

  const handleEdit = () => {
    setEditing(true);
    setError('');
  };

  const handleDiscard = () => {
    setCode(originalDdl);
    setEditing(false);
    setError('');
  };

  const handleSave = () => {
    setShowConfirm(true);
  };

  const buildExecuteSql = (): string => {
    if (isNew) {
      return code;
    }
    // For triggers, must qualify with database
    const dropSql = objectType === 'trigger'
      ? `DROP ${TYPE_SQL[objectType]} \`${tab.database}\`.\`${objectName}\``
      : `DROP ${TYPE_SQL[objectType]} \`${tab.database}\`.\`${objectName}\``;
    return `${dropSql};\n\n${code}`;
  };

  const handleConfirmExecute = async () => {
    setExecuting(true);
    setError('');
    try {
      if (!isNew) {
        // Drop first
        await ipc.schemaDropObject(tab.connectionId, tab.database!, TYPE_SQL[objectType], objectName);
      }
      // Execute CREATE
      await ipc.schemaExecuteDdl(tab.connectionId, code);
      setOriginalDdl(code);
      setEditing(false);
      setShowConfirm(false);
      setStatus(`${TYPE_LABELS[objectType]} saved successfully`, 'success');
    } catch (err: any) {
      setError(err.message || 'Execution failed');
      setShowConfirm(false);
    } finally {
      setExecuting(false);
    }
  };

  const extensions = useMemo(() => [
    sql({ dialect: MySQL }),
    EditorView.lineWrapping,
  ], []);

  const label = TYPE_LABELS[objectType];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Toolbar */}
      <div className="sql-toolbar">
        <span style={{ fontWeight: 600, fontSize: 13 }}>
          {label}: {isNew ? '(new)' : objectName}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {!editing && !loading && (
            <button className="btn btn-primary" onClick={handleEdit}>Edit</button>
          )}
          {editing && !isNew && (
            <button className="btn btn-secondary" onClick={handleDiscard}>Discard</button>
          )}
          {editing && (
            <button className="btn btn-primary" onClick={handleSave} disabled={!code.trim()}>Save</button>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '6px 12px', fontSize: 12, background: '#2a0000', color: '#c75450' }}>
          {error}
        </div>
      )}

      {/* Editor */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {loading ? (
          <div className="empty-state">Loading...</div>
        ) : (
          <CodeMirror
            ref={editorRef}
            value={code}
            onChange={editing ? setCode : undefined}
            readOnly={!editing}
            extensions={extensions}
            theme={oneDark}
            height="100%"
            basicSetup={{ lineNumbers: true, foldGutter: true }}
          />
        )}
      </div>

      {/* Confirm dialog */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => !executing && setShowConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 500 }}>
            <div className="modal-title">Execute DDL</div>
            <pre style={{
              background: '#2b2b2b',
              padding: 12,
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'monospace',
              maxHeight: 300,
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
              marginBottom: 12,
              color: '#a9b7c6',
            }}>
              {buildExecuteSql()}
            </pre>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowConfirm(false)} disabled={executing}>Cancel</button>
              <button className="btn btn-primary" onClick={handleConfirmExecute} disabled={executing}>
                {executing ? 'Executing...' : 'Execute'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/SchemaObjectTab.tsx
git commit -m "feat: add SchemaObjectTab component with view/edit modes and DDL confirmation"
```

---

### Task 4: Update App.tsx and TabBar.tsx for object tab routing

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/TabBar.tsx`

- [ ] **Step 1: Add SchemaObjectTab import and routing in App.tsx**

Add import at top:
```typescript
import SchemaObjectTab from './components/SchemaObjectTab';
```

Add after the schema tab line (line 110) inside the tabs.map:
```typescript
              {tab.type === 'object' && <SchemaObjectTab tab={tab} isActive={tab.id === activeTabId} />}
```

Also update the StatusBar to show object info:
After `{activeTab?.type === 'console' && <span> — SQL Console</span>}` add:
```typescript
        {activeTab?.type === 'object' && <span> — {activeTab.objectType}: {activeTab.objectName || '(new)'}</span>}
```

- [ ] **Step 2: Update TabBar.tsx badge for object tabs**

Find the line that renders tab labels (the line with `tab.type === 'console' ? '⌨️ SQL Console' : ...`). Update it to handle the object type:

```typescript
            {tab.type === 'console' ? '⌨️ SQL Console' : tab.type === 'schema' ? `🔧 Schema: ${tab.table}` : tab.type === 'object' ? `📝 ${tab.objectName || 'New ' + tab.objectType}` : `📋 ${tab.table}`}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/TabBar.tsx
git commit -m "feat: route object tabs to SchemaObjectTab and add tab badge"
```

---

### Task 5: Add schema object groups and context menus to Sidebar

**Files:**
- Modify: `src/renderer/components/Sidebar.tsx`

This is the largest task. The Sidebar needs:
1. Five new expandable groups per database (Views, Procedures, Functions, Triggers, Events)
2. Lazy loading when groups are expanded
3. Context menu on group headers ("New {Type}")
4. Context menu on individual objects ("Open", "Drop")

- [ ] **Step 1: Add state for object group expansion and context menus**

Add new state variables after existing ones:

```typescript
const [expandedObjectGroups, setExpandedObjectGroups] = useState<Set<string>>(new Set());
const [objectContextMenu, setObjectContextMenu] = useState<{ x: number; y: number; conn: ConnectionConfig; database: string; objectType: 'view' | 'procedure' | 'function' | 'trigger' | 'event'; objectName: string } | null>(null);
const [objectGroupContextMenu, setObjectGroupContextMenu] = useState<{ x: number; y: number; conn: ConnectionConfig; database: string; objectType: 'view' | 'procedure' | 'function' | 'trigger' | 'event' } | null>(null);
```

- [ ] **Step 2: Add toggle and load function for object groups**

Add after existing toggle functions:

```typescript
  const objectTypeIpcMap: Record<string, string> = {
    view: 'schemaViews',
    procedure: 'schemaProcedures',
    function: 'schemaFunctions',
    trigger: 'schemaTriggers',
    event: 'schemaEvents',
  };

  const objectTypePluralMap: Record<string, 'views' | 'procedures' | 'functions' | 'triggers' | 'events'> = {
    view: 'views',
    procedure: 'procedures',
    function: 'functions',
    trigger: 'triggers',
    event: 'events',
  };

  const toggleObjectGroup = async (connectionId: string, database: string, objectType: string) => {
    const key = `${connectionId}:${database}:${objectType}`;
    if (expandedObjectGroups.has(key)) {
      setExpandedObjectGroups(prev => { const s = new Set(prev); s.delete(key); return s; });
      return;
    }
    // Fetch objects
    const fetcher = objectTypeIpcMap[objectType];
    const plural = objectTypePluralMap[objectType];
    try {
      const items: string[] = await (ipc as any)[fetcher](connectionId, database);
      dispatch({ type: 'SET_OBJECTS', connectionId, database, objectType: plural, items });
    } catch {}
    setExpandedObjectGroups(prev => new Set(prev).add(key));
  };
```

- [ ] **Step 3: Render object groups under each database**

Inside the database expansion block (after the table list), add the five object groups. Place this after the closing `})}` of the tables map but still inside `{expandedDbs.has(...)`:

```tsx
                {/* Schema object groups */}
                {['view', 'procedure', 'function', 'trigger', 'event'].map(objType => {
                  const plural = objType === 'procedure' ? 'procedures' : objType === 'function' ? 'functions' : objType === 'trigger' ? 'triggers' : objType === 'event' ? 'events' : 'views';
                  const label = plural.charAt(0).toUpperCase() + plural.slice(1);
                  const items: string[] = (db as any)[plural] || [];
                  const groupKey = `${conn.id}:${db.name}:${objType}`;
                  const isGroupExpanded = expandedObjectGroups.has(groupKey);
                  return (
                    <div key={objType} className="tree-node-indent">
                      <div
                        className="tree-node"
                        style={{ opacity: items.length === 0 && !isGroupExpanded ? 0.4 : 1 }}
                        onClick={() => toggleObjectGroup(conn.id, db.name, objType)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          setObjectGroupContextMenu({ x: e.clientX, y: e.clientY, conn, database: db.name, objectType: objType as any });
                        }}
                      >
                        <span className="tree-arrow">{isGroupExpanded ? '▼' : '▶'}</span>
                        <span>{label} ({items.length})</span>
                      </div>
                      {isGroupExpanded && items.map(name => {
                        const isObjActive = activeTab?.type === 'object' && activeTab.connectionId === conn.id && activeTab.database === db.name && activeTab.objectName === name && activeTab.objectType === objType;
                        return (
                          <div key={name} className="tree-node-indent">
                            <div
                              className={`tree-node ${isObjActive ? 'tree-node-active' : ''}`}
                              onClick={() => openTab({ connectionId: conn.id, connectionName: conn.name, connectionColor: conn.color, type: 'object', database: db.name, objectType: objType as any, objectName: name })}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                setObjectContextMenu({ x: e.clientX, y: e.clientY, conn, database: db.name, objectType: objType as any, objectName: name });
                              }}
                            >
                              <span style={{ width: 12 }}></span>
                              <span>{name}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
```

- [ ] **Step 4: Add context menus for object groups and individual objects**

Add after the existing `dbContextMenu` block:

```tsx
      {objectGroupContextMenu && (
        <div className="context-menu" style={menuPosition(objectGroupContextMenu.x, objectGroupContextMenu.y, 35)}>
          <div className="context-menu-item" onClick={() => {
            const { conn, database, objectType } = objectGroupContextMenu;
            openTab({ connectionId: conn.id, connectionName: conn.name, connectionColor: conn.color, type: 'object', database, objectType });
            setObjectGroupContextMenu(null);
          }}>New {objectGroupContextMenu.objectType.charAt(0).toUpperCase() + objectGroupContextMenu.objectType.slice(1)}</div>
        </div>
      )}

      {objectContextMenu && (
        <div className="context-menu" style={menuPosition(objectContextMenu.x, objectContextMenu.y, 70)}>
          <div className="context-menu-item" onClick={() => {
            const { conn, database, objectType, objectName } = objectContextMenu;
            openTab({ connectionId: conn.id, connectionName: conn.name, connectionColor: conn.color, type: 'object', database, objectType, objectName });
            setObjectContextMenu(null);
          }}>Open</div>
          <div className="context-menu-item" style={{ color: '#ef4444' }} onClick={async () => {
            const { conn, database, objectType, objectName } = objectContextMenu;
            const typeLabel = objectType.charAt(0).toUpperCase() + objectType.slice(1);
            const typeSql = objectType.toUpperCase();
            setObjectContextMenu(null);
            if (!confirm(`Drop ${typeLabel.toLowerCase()} \`${objectName}\`? This cannot be undone.`)) return;
            try {
              await ipc.schemaDropObject(conn.id, database, typeSql, objectName);
              // Close any open tabs for this object
              tabs.filter(t => t.connectionId === conn.id && t.database === database && t.objectType === objectType && t.objectName === objectName)
                .forEach(t => closeTab(t.id));
              // Refresh the group
              const plural = objectType === 'procedure' ? 'procedures' : objectType === 'function' ? 'functions' : objectType === 'trigger' ? 'triggers' : objectType === 'event' ? 'events' : 'views';
              const fetcher = objectType === 'view' ? 'schemaViews' : objectType === 'procedure' ? 'schemaProcedures' : objectType === 'function' ? 'schemaFunctions' : objectType === 'trigger' ? 'schemaTriggers' : 'schemaEvents';
              const items: string[] = await (ipc as any)[fetcher](conn.id, database);
              dispatch({ type: 'SET_OBJECTS', connectionId: conn.id, database, objectType: plural, items });
              setStatus(`Dropped ${typeLabel.toLowerCase()} ${objectName}`, 'success');
            } catch (e: any) {
              setStatus(`Drop failed: ${e?.message ?? e}`, 'error');
            }
          }}>Drop</div>
        </div>
      )}
```

- [ ] **Step 5: Add cleanup for new context menus in the global click handler**

Find the existing `useEffect` that closes context menus on click. Add the new context menus to the cleanup:

```typescript
    setObjectContextMenu(null);
    setObjectGroupContextMenu(null);
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/Sidebar.tsx
git commit -m "feat: add schema object groups and context menus to sidebar"
```
