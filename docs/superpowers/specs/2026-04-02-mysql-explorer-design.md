# MySQL Explorer — Design Spec

Personal power-user desktop app for browsing and editing MySQL databases, built with Electron and React.

## Architecture

**Electron main process** owns all data: MySQL connections (`mysql2`), SSH tunnels (`ssh2`), config I/O, and file persistence. **React renderer** is pure UI, communicating via Electron IPC (invoke/handle pattern).

```
Renderer (React)
  ├── Sidebar (tree view)
  ├── Table View (editable data grid + filters)
  └── SQL Console (CodeMirror 6 editor + results)
        │
        │  IPC (invoke / handle)
        │
Main Process
  ├── ConnectionManager  — mysql2 pools, ssh2 tunnels, config CRUD
  ├── QueryExecutor      — run SQL, paginate, detect SELECT vs DML
  ├── SchemaBrowser      — list databases, tables, describe columns
  └── FileManager        — persist SQL files, connection configs
```

### IPC Channels

| Channel | Purpose |
|---|---|
| `connection:create/update/delete/list/test` | Manage saved connections |
| `connection:connect/disconnect` | Open/close live connection (+ SSH tunnel) |
| `schema:databases/tables/describe` | Browse schema tree |
| `query:execute` | Run SQL, return rows or affected count |
| `query:paginate` | Fetch page N of a table with optional WHERE/ORDER |
| `query:update` | Write cell edits back via UPDATE |

## Connection Management

### Config Storage

Connections stored in `connections.json` in Electron's `userData` directory.

### Connection Object

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | Auto-generated |
| `name` | string | Display name |
| `color` | string | Hex color for tab badges |
| **MySQL** | | |
| `host` | string | |
| `port` | number | Default 3306 |
| `user` | string | |
| `password` | string | Stored as plaintext (personal tool) |
| `defaultDatabase` | string? | Optional, pre-select on connect |
| **SSH (optional)** | | |
| `sshEnabled` | boolean | |
| `sshHost` | string | |
| `sshPort` | number | Default 22 |
| `sshUser` | string | |
| `sshAuthType` | `"password"` \| `"key"` | |
| `sshPassword` | string? | When authType is password |
| `sshKeyPath` | string? | When authType is key |
| `sshPassphrase` | string? | Optional passphrase for key |

### SSH Tunnel Flow

1. `ssh2` opens SSH connection to `sshHost:sshPort`
2. Creates tunnel: local random port → forwards to MySQL `host:port`
3. `mysql2` connects to `localhost:randomPort`

### Connection Pooling

One `mysql2` pool per active connection, pool size 5.

### Test Connection

Button in the connection config dialog that validates both SSH and MySQL connectivity before saving.

## Left Sidebar

Tree view structure:

```
▼ 🔌 Connection Name
  ▼ 📁 database_name
    📋 table_1
    📋 table_2
  ▶ 📁 another_db
▶ 🔌 Another Connection
[+ Add Connection]
```

- Expand connection → fetches database list
- Expand database → fetches table list
- Click table → opens table view tab in main area
- **Add Connection** button at bottom opens connection config dialog
- Right-click connection for edit/delete/disconnect/open SQL Console
- **Refresh button** on sidebar header re-fetches database/table tree for all active connections

## Tab System

- Clicking a table opens a new tab in the main area
- **Maximum 10 tabs** — when the 11th opens, the oldest by last-accessed time auto-closes
- Re-clicking an already-open table focuses the existing tab (no duplicates)
- Each tab title format: `[ConnectionBadge] icon tableName ✕`
- Connection badge is a short name with the connection's unique color
- SQL Console tabs: `[ConnectionBadge] ⌨️ SQL Console ✕`
- Manual close via ✕ button on each tab

## Table View

### Loading

1. `DESCRIBE table` → get column metadata (types, keys, nullability)
2. `SELECT COUNT(*) FROM table [WHERE ...]` → total row count
3. `SELECT * FROM table [WHERE ...] [ORDER BY ...] LIMIT 1000 OFFSET 0` → first page

### Type-Aware Cell Editing

| MySQL Type | Editor |
|---|---|
| `ENUM` | Dropdown with enum values from column metadata |
| `TEXT/MEDIUMTEXT/LONGTEXT/BLOB` | Click opens modal with textarea |
| `INT/BIGINT/DECIMAL/FLOAT/DOUBLE` | Inline number input |
| `VARCHAR/CHAR` | Inline text input |
| `DATE/DATETIME/TIMESTAMP` | Inline text input |
| `NULL` values | Displayed as italic gray "NULL", editable |

### Primary Key Requirement

Edits generate `UPDATE table SET col=? WHERE pk_col=?`. If a table has no primary key, all cells are read-only with a notice displayed.

### Save Modes (topbar toggle)

- **Auto-Save**: each cell blur triggers an immediate `UPDATE` statement
- **Bulk Commit**: edits tracked in a local changeset (modified cells visually highlighted), "Commit" button sends all `UPDATE`s in a single transaction

### Filter Topbar

Two modes, switchable via toggle:

**Structured filters:**
- Add filter rows: column dropdown + operator dropdown (`=`, `!=`, `>`, `<`, `>=`, `<=`, `LIKE`, `IS NULL`, `IS NOT NULL`) + value input
- Combine with AND/OR logic
- Applied on add/change

**Raw WHERE clause:**
- Free-text input, appended as `WHERE <user input>`
- Applied on Enter

Switching modes clears the other.

### Pagination

- 1000 rows per page (fixed)
- Prev/Next buttons + page number links
- Filters and ORDER BY applied before pagination

### Refresh

Refresh button on the table view topbar re-runs the current query (same page, same filters) to pick up server-side changes.

## SQL Console

### Editor

- **CodeMirror 6** with `@codemirror/lang-sql` extension
- SQL syntax highlighting (keywords, strings, numbers, comments)
- **Autocomplete**: SQL keywords + table names + column names (from schema metadata already loaded in sidebar)
- Suggestions appear on typing (e.g., type "SEL" → shows "SELECT")

### Persistence

- Editor content auto-saved to `{connectionId}.sql` in Electron's `userData` directory
- Debounced at ~1 second
- One file per connection, restored on next open

### Execution

- **▶ Run** button or **⌘+Enter** (⌃+Enter on Linux/Windows)
- Result detection: if query starts with `SELECT`, `SHOW`, `DESCRIBE`, or `EXPLAIN` → table result; otherwise → affected rows count

### Result Display

**SELECT-type queries:**
- Read-only table (same table component as Table View, but without editing)
- Paginated at 1000 rows per page

**DML queries (INSERT/UPDATE/DELETE):**
- Large affected row count number
- Execution time

**Errors:**
- SQL error message and error code displayed in result area

### Layout

- Resizable vertical split between editor (top) and results (bottom)
- Draggable divider to adjust proportions

## Tech Stack

| Layer | Technology |
|---|---|
| Shell | Electron |
| UI Framework | React |
| Data Table | TanStack Table |
| SQL Editor | CodeMirror 6 + @codemirror/lang-sql |
| MySQL Client | mysql2 |
| SSH Tunneling | ssh2 |
| Build Tool | Electron Forge (officially recommended) |
| State Management | React context + useReducer (simple enough, no Redux needed) |
