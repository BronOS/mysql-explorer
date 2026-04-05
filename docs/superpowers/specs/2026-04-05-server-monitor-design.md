# Server Monitor Design

A monitoring dashboard tab showing processlist, status variables, slow queries, and InnoDB status for a connected MySQL server.

## Entry Point

Right-click a connection in the sidebar > "Server Monitor". Opens a new tab type `'monitor'`. One monitor tab per connection (deduped like other tab types).

## Layout

Toolbar at top, metric cards row below, then tabbed detail sections filling remaining space.

## Toolbar

- Connection name label
- Auto-refresh dropdown: Off, 1s, 5s, 10s, 30s (default: 5s)
- Manual Refresh button

## Metric Cards

Always-visible row of 5 cards above the tabs:

- **Uptime** — from `SHOW GLOBAL STATUS` (`Uptime` variable, formatted as days/hours/minutes)
- **Queries/sec** — computed from `Questions` / `Uptime`
- **Active Threads** — `Threads_running`
- **Connections** — `Threads_connected`
- **Slow Queries** — `Slow_queries`

Cards update on every refresh cycle.

## Tabs

### 1. Processlist

Data source: `SHOW FULL PROCESSLIST`

Columns: ID, User, Host, DB, Command, Time, State, Info.

**Kill button** on each row (red, small). Clicking shows confirm dialog, then executes `KILL QUERY {id}`.

**Right-click context menu** on rows:
- "Kill Query" — `KILL QUERY {id}` with confirm
- "Kill Connection" — `KILL {id}` with confirm

After killing, auto-refreshes the processlist.

### 2. Status

Data source: `SHOW GLOBAL STATUS`

Searchable table with two columns: Variable Name, Value. Search/filter input at top filters both column names and values.

### 3. Variables

Data source: `SHOW VARIABLES`

Grouped by category with collapsible sections:
- **General** — variables matching: `version`, `hostname`, `port`, `socket`, `datadir`, `tmpdir`, `character_set_*`, `collation_*`, `time_zone`, `wait_timeout`, `max_connections`, etc.
- **InnoDB** — variables starting with `innodb_`
- **Replication** — variables matching: `server_id`, `log_bin`, `binlog_*`, `relay_*`, `slave_*`, `gtid_*`
- **Logging** — variables matching: `log_*`, `slow_query_*`, `general_log*`, `long_query_time`
- **Networking** — variables matching: `net_*`, `max_allowed_packet`, `connect_timeout`, `interactive_timeout`
- **Security** — variables matching: `ssl_*`, `require_secure_transport`, `password_*`, `validate_password_*`
- **Other** — everything not matched above

Search bar at top filters across all categories.

### 4. Slow Queries

Data source: `SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 100`

Table columns: Start Time, User, Host, Query Time, Lock Time, Rows Examined, SQL Text.

Falls back to a message "Slow query log table is not available" if the query fails.

### 5. InnoDB Status

Data source: `SHOW ENGINE INNODB STATUS`

Displayed in a read-only CodeMirror editor (monospace, scrollable) with the raw InnoDB status output. Uses the active theme's CodeMirror extension for consistent styling.

## TabInfo Extension

Add `'monitor'` to the TabInfo type union:
```
type: 'table' | 'console' | 'schema' | 'object' | 'monitor'
```

## IPC

New handlers:
- `monitor:processlist` — runs `SHOW FULL PROCESSLIST`, returns rows
- `monitor:global-status` — runs `SHOW GLOBAL STATUS`, returns key-value pairs
- `monitor:variables` — runs `SHOW VARIABLES`, returns key-value pairs
- `monitor:slow-log` — runs the slow_log SELECT, returns rows (empty array on error)
- `monitor:innodb-status` — runs `SHOW ENGINE INNODB STATUS`, returns the status text
- `monitor:kill-query` — runs `KILL QUERY {id}`
- `monitor:kill-connection` — runs `KILL {id}`

## Components

- `ServerMonitorTab.tsx` — main tab container with toolbar, metric cards, and sub-tab routing
- `MonitorProcesslist.tsx` — processlist table with kill buttons and context menu
- `MonitorStatus.tsx` — searchable status variable table
- `MonitorVariables.tsx` — categorized, collapsible, searchable variables
- `MonitorSlowLog.tsx` — slow query log table
- `MonitorInnodb.tsx` — InnoDB status viewer with CodeMirror

## Auto-Refresh

A `setInterval` in `ServerMonitorTab` based on the selected refresh rate. Fetches data for the active sub-tab only (not all tabs on every tick). Clears interval on unmount or when tab becomes inactive. Pauses when refresh is set to "Off".

## Sidebar Integration

Add "Server Monitor" to the connection context menu (only when connected, alongside "Open SQL Console" and "New Database").
