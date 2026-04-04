# MySQL Explorer

A desktop MySQL database explorer built with Electron. Browse schemas, edit data inline, write queries with autocomplete, and manage tables and databases — all from a fast, dark-themed native app.

<p align="center">
  <img src="assets/icon.svg" alt="MySQL Explorer" width="128" />
</p>

## Features

**Connection Management**
- Save multiple MySQL connections with color-coded labels
- SSH tunnel support (password and key-based authentication)
- Connection testing before saving
- Import connections from JetBrains DataGrip

**Schema Browser**
- Expandable sidebar tree: connections > databases > tables
- Cached schema metadata for fast navigation
- Context menus for creating/dropping databases and tables
- Live table filtering

**Data Grid**
- Paginated table view (1000 rows/page)
- Inline cell editing with auto-save or bulk-save modes
- Column sorting (click headers)
- Row operations: insert, duplicate, delete
- Structured filter builder or raw WHERE clause input
- Copy selection as TSV, CSV, JSON, SQL INSERT, HTML, or Markdown

**SQL Console**
- CodeMirror 6 editor with SQL syntax highlighting
- Schema-aware autocomplete (tables and columns)
- SQL formatting (Shift+Ctrl+F)
- Execute query at cursor position
- Execution time tracking
- Persistent SQL files per connection

**Schema Inspector**
- Three-panel view: Columns, Indexes, DDL
- Edit column definitions: type, nullable, key, default, extra, encoding, collation
- Create and modify indexes (BTREE, HASH, FULLTEXT, SPATIAL)
- Prefix length support for TEXT/BLOB index columns
- ENUM value editor, precision/scale dialogs for numeric types
- Commit/discard workflow for schema changes

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- npm

### Install

```bash
git clone https://github.com/BronOS/mysql-explorer.git
cd mysql-explorer
npm install
```

### Development

```bash
npm start
```

### Run Tests

```bash
npm test
```

### Build

```bash
npm run make
```

Produces platform-specific installers:
- macOS: `.zip`
- Windows: Squirrel installer
- Linux: `.rpm`, `.deb`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Electron 41 + Electron Forge |
| Frontend | React 19, TypeScript |
| Bundler | Vite 5 |
| Data Grid | TanStack Table |
| SQL Editor | CodeMirror 6 (@codemirror/lang-sql) |
| MySQL | mysql2/promise (connection pooling) |
| SSH | ssh2 |
| SQL Formatting | sql-formatter |
| Testing | Vitest |

## Architecture

```
src/
  main/           Electron main process
    connection-manager.ts   MySQL pools + SSH tunnels
    schema-browser.ts       Database introspection (SHOW, DESCRIBE)
    query-executor.ts       Query execution, pagination, CRUD
    file-manager.ts         Config & state persistence
    ipc-handlers.ts         IPC endpoint registration
    datagrip-import.ts      DataGrip XML connection importer

  preload/         Typed IPC bridge (contextBridge)

  renderer/        React UI
    components/    21 components (Sidebar, DataGrid, SqlConsole, SchemaView, ...)
    context/       Global state (React Context + useReducer)
    hooks/         useIpc, useUiState, useDebounce

  shared/
    types.ts       TypeScript types shared across processes
```

All MySQL operations run in the main process. The renderer communicates exclusively through typed IPC invoke/handle calls exposed via the preload bridge.

## Data Storage

Connection configs, SQL console files, schema cache, and UI state are persisted in Electron's userData directory:

| Platform | Path |
|----------|------|
| macOS | `~/Library/Application Support/mysql-explorer/` |
| Windows | `%APPDATA%/mysql-explorer/` |
| Linux | `~/.config/mysql-explorer/` |

## License

MIT
