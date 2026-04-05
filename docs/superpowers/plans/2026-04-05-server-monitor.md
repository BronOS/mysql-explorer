# Server Monitor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a server monitoring dashboard tab with processlist, status variables, slow queries, and InnoDB status.

**Architecture:** New `'monitor'` tab type opened from connection context menu. Main `ServerMonitorTab` component manages toolbar (auto-refresh, manual refresh), metric cards, and routes to 5 sub-tab components. 7 new IPC handlers fetch data from MySQL. Auto-refresh via `setInterval` fetches data for the active sub-tab only.

**Tech Stack:** React, TypeScript, CodeMirror 6 (InnoDB viewer), Electron IPC, mysql2

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/shared/types.ts` | Modify | Add `'monitor'` to TabInfo type union |
| `src/main/ipc-handlers.ts` | Modify | Add 7 monitor IPC handlers |
| `src/preload/preload.ts` | Modify | Expose 7 monitor IPC methods |
| `src/renderer/components/ServerMonitorTab.tsx` | Create | Main monitor tab: toolbar, metric cards, sub-tab routing, auto-refresh |
| `src/renderer/components/MonitorProcesslist.tsx` | Create | Processlist table with kill buttons and context menu |
| `src/renderer/components/MonitorStatus.tsx` | Create | Searchable status variable table |
| `src/renderer/components/MonitorVariables.tsx` | Create | Categorized, collapsible, searchable variables |
| `src/renderer/components/MonitorSlowLog.tsx` | Create | Slow query log table |
| `src/renderer/components/MonitorInnodb.tsx` | Create | InnoDB status CodeMirror viewer |
| `src/renderer/App.tsx` | Modify | Route `monitor` tab type |
| `src/renderer/components/TabBar.tsx` | Modify | Add monitor tab badge |
| `src/renderer/components/Sidebar.tsx` | Modify | Add "Server Monitor" to connection context menu |

---

### Task 1: Extend types and add IPC handlers

**Files:**
- Modify: `src/shared/types.ts`
- Modify: `src/main/ipc-handlers.ts`
- Modify: `src/preload/preload.ts`

- [ ] **Step 1: Add 'monitor' to TabInfo type in types.ts**

Change the type union in TabInfo:
```typescript
  type: 'table' | 'console' | 'schema' | 'object' | 'monitor';
```

- [ ] **Step 2: Add 7 monitor IPC handlers in ipc-handlers.ts**

Add before the `// Export` comment block:

```typescript
  // Monitor
  ipcMain.handle('monitor:processlist', async (_, connectionId) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    const [rows] = await pool.query('SHOW FULL PROCESSLIST');
    return rows;
  });

  ipcMain.handle('monitor:global-status', async (_, connectionId) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    const [rows] = await pool.query('SHOW GLOBAL STATUS');
    const result: Record<string, string> = {};
    for (const row of rows as any[]) {
      result[row.Variable_name] = row.Value;
    }
    return result;
  });

  ipcMain.handle('monitor:variables', async (_, connectionId) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    const [rows] = await pool.query('SHOW VARIABLES');
    const result: Record<string, string> = {};
    for (const row of rows as any[]) {
      result[row.Variable_name] = row.Value;
    }
    return result;
  });

  ipcMain.handle('monitor:slow-log', async (_, connectionId) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    try {
      const [rows] = await pool.query('SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 100');
      return rows;
    } catch {
      return [];
    }
  });

  ipcMain.handle('monitor:innodb-status', async (_, connectionId) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    const [rows] = await pool.query('SHOW ENGINE INNODB STATUS');
    return (rows as any[])[0]?.Status || '';
  });

  ipcMain.handle('monitor:kill-query', async (_, connectionId, processId) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    await pool.query(`KILL QUERY ${Number(processId)}`);
  });

  ipcMain.handle('monitor:kill-connection', async (_, connectionId, processId) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    await pool.query(`KILL ${Number(processId)}`);
  });
```

- [ ] **Step 3: Add 7 preload methods in preload.ts**

Add before the `// Export` comment:

```typescript
  // Monitor
  monitorProcesslist: (connectionId: string) => ipcRenderer.invoke('monitor:processlist', connectionId),
  monitorGlobalStatus: (connectionId: string) => ipcRenderer.invoke('monitor:global-status', connectionId),
  monitorVariables: (connectionId: string) => ipcRenderer.invoke('monitor:variables', connectionId),
  monitorSlowLog: (connectionId: string) => ipcRenderer.invoke('monitor:slow-log', connectionId),
  monitorInnodbStatus: (connectionId: string) => ipcRenderer.invoke('monitor:innodb-status', connectionId),
  monitorKillQuery: (connectionId: string, processId: number) => ipcRenderer.invoke('monitor:kill-query', connectionId, processId),
  monitorKillConnection: (connectionId: string, processId: number) => ipcRenderer.invoke('monitor:kill-connection', connectionId, processId),
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add src/shared/types.ts src/main/ipc-handlers.ts src/preload/preload.ts
git commit -m "feat: add monitor tab type and 7 monitor IPC handlers"
```

---

### Task 2: Create ServerMonitorTab with toolbar and metric cards

**Files:**
- Create: `src/renderer/components/ServerMonitorTab.tsx`

- [ ] **Step 1: Create ServerMonitorTab.tsx**

This is the main container. It manages:
- Toolbar with connection name, auto-refresh dropdown (Off/1s/5s/10s/30s), refresh button
- 5 metric cards (Uptime, Queries/sec, Active Threads, Connections, Slow Queries)
- Sub-tab navigation (Processlist, Status, Variables, Slow Queries, InnoDB)
- Auto-refresh interval that calls the active sub-tab's refresh function
- Fetches global status on every refresh to update metric cards

Props:
```typescript
interface Props {
  tab: TabInfo;
  isActive?: boolean;
}
```

The component should:
- Use `useIpc()` and `useAppContext()` hooks
- Fetch `monitorGlobalStatus` on mount and on every refresh interval
- Parse metrics: `Uptime` (format as Xd Xh Xm), `Questions / Uptime` for QPS, `Threads_running`, `Threads_connected`, `Slow_queries`
- Manage `activeSubTab` state: `'processlist' | 'status' | 'variables' | 'slowlog' | 'innodb'`
- Manage `refreshInterval` state with default `5000` (5s)
- Use `setInterval` that triggers refresh, clear on unmount or when `isActive` becomes false
- Pass a `refreshTrigger` counter (incremented on each refresh) to sub-tab components so they know when to re-fetch

Toolbar styling: use `sql-toolbar` class (same as SQL console).
Metric cards: flex row with 5 cards, each using `var(--bg-secondary)` background, `var(--border)` border.
Sub-tabs: styled like the filter mode buttons (using `filter-mode-btn` / `filter-mode-active` classes).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/ServerMonitorTab.tsx
git commit -m "feat: add ServerMonitorTab with toolbar, metric cards, and sub-tab routing"
```

---

### Task 3: Create MonitorProcesslist component

**Files:**
- Create: `src/renderer/components/MonitorProcesslist.tsx`

- [ ] **Step 1: Create MonitorProcesslist.tsx**

Props:
```typescript
interface Props {
  connectionId: string;
  refreshTrigger: number;
}
```

The component should:
- Fetch `monitorProcesslist` on mount and whenever `refreshTrigger` changes
- Display a table with columns: ID, User, Host, DB, Command, Time, State, Info
- Each row has a small red "Kill" button (using `btn btn-secondary` with `color: 'var(--danger)'`, small font/padding)
- Kill button click shows `confirm('Kill query ID {id}?')`, then calls `monitorKillQuery`, then re-fetches
- Right-click context menu on rows with:
  - "Kill Query" — `monitorKillQuery` with confirm
  - "Kill Connection" — `monitorKillConnection` with confirm
- After any kill, immediately re-fetch processlist
- Style the table using the existing `datagrid` CSS classes
- Time column: highlight in warning color if > 5s, danger color if > 30s

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "^src/"`

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/MonitorProcesslist.tsx
git commit -m "feat: add MonitorProcesslist with kill buttons and context menu"
```

---

### Task 4: Create MonitorStatus component

**Files:**
- Create: `src/renderer/components/MonitorStatus.tsx`

- [ ] **Step 1: Create MonitorStatus.tsx**

Props:
```typescript
interface Props {
  connectionId: string;
  refreshTrigger: number;
}
```

The component should:
- Fetch `monitorGlobalStatus` on mount and whenever `refreshTrigger` changes
- Search input at top (using `input` class) that filters variable names and values
- Display as a two-column table (Variable Name, Value) using `datagrid` CSS classes
- Filter is case-insensitive, matches against both name and value

- [ ] **Step 2: Verify TypeScript compiles and commit**

```bash
git add src/renderer/components/MonitorStatus.tsx
git commit -m "feat: add MonitorStatus with searchable status table"
```

---

### Task 5: Create MonitorVariables component

**Files:**
- Create: `src/renderer/components/MonitorVariables.tsx`

- [ ] **Step 1: Create MonitorVariables.tsx**

Props:
```typescript
interface Props {
  connectionId: string;
  refreshTrigger: number;
}
```

Category matching rules (applied in order, first match wins):
- **InnoDB**: name starts with `innodb_`
- **Replication**: name matches `server_id`, starts with `binlog_`, `relay_`, `slave_`, `gtid_`, or equals `log_bin`
- **Logging**: name starts with `log_`, `slow_query_`, `general_log`, or equals `long_query_time`
- **Networking**: name starts with `net_`, or equals `max_allowed_packet`, `connect_timeout`, `interactive_timeout`
- **Security**: name starts with `ssl_`, `password_`, `validate_password_`, or equals `require_secure_transport`
- **General**: name matches `version`, `hostname`, `port`, `socket`, `datadir`, `tmpdir`, starts with `character_set_`, `collation_`, or equals `time_zone`, `wait_timeout`, `max_connections`
- **Other**: everything else

The component should:
- Fetch `monitorVariables` on mount and whenever `refreshTrigger` changes
- Search input at top (filters across all categories)
- Each category is a collapsible section with a header showing category name and count
- Click header to expand/collapse (all expanded by default)
- Inside each section: two-column table (Variable Name, Value)

- [ ] **Step 2: Verify TypeScript compiles and commit**

```bash
git add src/renderer/components/MonitorVariables.tsx
git commit -m "feat: add MonitorVariables with categorized collapsible sections"
```

---

### Task 6: Create MonitorSlowLog and MonitorInnodb components

**Files:**
- Create: `src/renderer/components/MonitorSlowLog.tsx`
- Create: `src/renderer/components/MonitorInnodb.tsx`

- [ ] **Step 1: Create MonitorSlowLog.tsx**

Props:
```typescript
interface Props {
  connectionId: string;
  refreshTrigger: number;
}
```

The component should:
- Fetch `monitorSlowLog` on mount and whenever `refreshTrigger` changes
- If result is empty array, show "Slow query log table is not available or empty"
- Otherwise display a table with columns: Start Time, User, Host, Query Time, Lock Time, Rows Examined, SQL Text
- SQL Text column should be truncated with ellipsis (max-width 400px), full text on hover/title

- [ ] **Step 2: Create MonitorInnodb.tsx**

Props:
```typescript
interface Props {
  connectionId: string;
  refreshTrigger: number;
}
```

The component should:
- Fetch `monitorInnodbStatus` on mount and whenever `refreshTrigger` changes
- Display the raw status text in a read-only CodeMirror editor
- Use `useTheme()` to get `cmExtension` for consistent theming
- Fill available height

- [ ] **Step 3: Verify TypeScript compiles and commit**

```bash
git add src/renderer/components/MonitorSlowLog.tsx src/renderer/components/MonitorInnodb.tsx
git commit -m "feat: add MonitorSlowLog and MonitorInnodb components"
```

---

### Task 7: Wire up App.tsx, TabBar.tsx, and Sidebar.tsx

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/TabBar.tsx`
- Modify: `src/renderer/components/Sidebar.tsx`

- [ ] **Step 1: Update App.tsx**

Add import:
```typescript
import ServerMonitorTab from './components/ServerMonitorTab';
```

Add after the `object` tab line in the tabs.map:
```typescript
              {tab.type === 'monitor' && <ServerMonitorTab tab={tab} isActive={tab.id === activeTabId} />}
```

Update StatusBar to show monitor info:
```typescript
        {activeTab?.type === 'monitor' && <span> — Server Monitor</span>}
```

- [ ] **Step 2: Update TabBar.tsx**

Update the tab label ternary to handle monitor type. Add before the final fallback:
```typescript
tab.type === 'monitor' ? `Server Monitor` :
```

- [ ] **Step 3: Update Sidebar.tsx**

Add "Server Monitor" to the `handleContextAction` switch:
```typescript
      case 'monitor':
        openTab({
          connectionId: conn.id,
          connectionName: conn.name,
          connectionColor: conn.color,
          type: 'monitor',
        });
        break;
```

Add menu item in the connection context menu, after "Open SQL Console" and before "New Database":
```tsx
          {expandedConns.has(contextMenu.connectionId) && (
            <div className="context-menu-item" onClick={() => handleContextAction('monitor')}>Server Monitor</div>
          )}
```

Update the context menu height from `200` to `235` for the expanded state.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | grep "^src/"`

- [ ] **Step 5: Commit**

```bash
git add src/renderer/App.tsx src/renderer/components/TabBar.tsx src/renderer/components/Sidebar.tsx
git commit -m "feat: wire up Server Monitor tab in App, TabBar, and Sidebar"
```
