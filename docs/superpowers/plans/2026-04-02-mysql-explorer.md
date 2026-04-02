# MySQL Explorer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal Electron desktop app for browsing and editing MySQL databases with SSH tunnel support, type-aware inline editing, and a SQL console with autocomplete.

**Architecture:** Electron main process handles all MySQL connections (mysql2), SSH tunnels (ssh2), config persistence, and SQL file storage. React renderer communicates via IPC invoke/handle. State managed with React context + useReducer.

**Tech Stack:** Electron Forge, React 18, TypeScript, mysql2, ssh2, TanStack Table, CodeMirror 6, Vitest

---

## File Structure

```
mysql-explorer/
├── package.json
├── forge.config.ts                    # Electron Forge configuration
├── tsconfig.json
├── vite.main.config.ts                # Vite config for main process
├── vite.preload.config.ts             # Vite config for preload
├── vite.renderer.config.ts            # Vite config for renderer
│
├── src/
│   ├── main/
│   │   ├── index.ts                   # Electron entry, creates BrowserWindow
│   │   ├── ipc-handlers.ts            # Registers all IPC handlers
│   │   ├── connection-manager.ts      # Config CRUD, mysql2 pools, ssh2 tunnels
│   │   ├── schema-browser.ts          # List DBs, tables, describe columns
│   │   ├── query-executor.ts          # Run SQL, paginate, cell updates
│   │   └── file-manager.ts            # Persist SQL files, read/write userData
│   │
│   ├── preload/
│   │   └── index.ts                   # contextBridge exposing IPC to renderer
│   │
│   ├── renderer/
│   │   ├── index.html                 # HTML entry point
│   │   ├── index.tsx                  # React root mount
│   │   ├── App.tsx                    # Top-level layout: sidebar + main area
│   │   ├── app.css                    # Global styles, dark theme
│   │   │
│   │   ├── context/
│   │   │   └── app-context.tsx        # Global state: connections, tabs, schema cache
│   │   │
│   │   ├── components/
│   │   │   ├── Sidebar.tsx            # Connection tree + add button + refresh
│   │   │   ├── ConnectionDialog.tsx   # Add/edit connection form with test button
│   │   │   ├── TabBar.tsx             # Tab strip with connection badges
│   │   │   ├── TableView.tsx          # Data grid container: topbar + table + pagination
│   │   │   ├── FilterTopbar.tsx       # Structured filters + raw WHERE + save mode toggle
│   │   │   ├── DataGrid.tsx           # TanStack Table with type-aware cells
│   │   │   ├── CellEditor.tsx         # Inline editors: text, number, dropdown
│   │   │   ├── TextEditModal.tsx      # Modal textarea for TEXT/BLOB fields
│   │   │   ├── Pagination.tsx         # Page nav: prev/next + page numbers
│   │   │   ├── SqlConsole.tsx         # CodeMirror editor + result pane + resizer
│   │   │   └── ResultTable.tsx        # Read-only result table (shared with SQL console)
│   │   │
│   │   └── hooks/
│   │       ├── use-ipc.ts             # Typed wrapper around window.electronAPI
│   │       └── use-debounce.ts        # Debounce helper for SQL file persistence
│   │
│   └── shared/
│       └── types.ts                   # Shared types: ConnectionConfig, ColumnMeta, TabInfo, etc.
│
└── tests/
    ├── main/
    │   ├── connection-manager.test.ts
    │   ├── schema-browser.test.ts
    │   ├── query-executor.test.ts
    │   └── file-manager.test.ts
    └── renderer/
        ├── TabBar.test.tsx
        ├── FilterTopbar.test.tsx
        ├── Pagination.test.tsx
        └── app-context.test.tsx
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `forge.config.ts`, `tsconfig.json`, `vite.main.config.ts`, `vite.preload.config.ts`, `vite.renderer.config.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/index.tsx`, `src/renderer/App.tsx`, `src/renderer/app.css`

- [ ] **Step 1: Scaffold Electron Forge project with Vite + React + TypeScript**

```bash
npx create-electron-app@latest mysql-explorer-scaffold --template=vite-typescript
```

Copy the generated scaffold files into `/Users/oleg.bronzov/Projects/mysql-explorer/`. This gives us `forge.config.ts`, `vite.*.config.ts`, `tsconfig.json`, and the basic `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`.

- [ ] **Step 2: Add React and project dependencies**

```bash
npm install react react-dom
npm install -D @types/react @types/react-dom @vitejs/plugin-react
```

- [ ] **Step 3: Configure Vite renderer for React**

In `vite.renderer.config.ts`, add the React plugin:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
```

- [ ] **Step 4: Create React entry point**

`src/renderer/index.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import App from './App';
import './app.css';

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

Update `src/renderer/index.html` to have `<div id="root"></div>` and load the tsx entry.

`src/renderer/App.tsx`:
```tsx
export default function App() {
  return <div className="app">MySQL Explorer</div>;
}
```

`src/renderer/app.css`:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; overflow: hidden; }
.app { display: flex; height: 100vh; width: 100vw; }
```

- [ ] **Step 5: Verify the app launches**

```bash
npm start
```

Expected: Electron window opens showing "MySQL Explorer" on a dark background.

- [ ] **Step 6: Add testing dependencies**

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom
```

Add to `package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest"
```

Create `vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
  },
});
```

- [ ] **Step 7: Commit**

```bash
git init
echo "node_modules/\nout/\n.superpowers/" > .gitignore
git add -A
git commit -m "feat: scaffold Electron Forge + React + TypeScript project"
```

---

### Task 2: Shared Types

**Files:**
- Create: `src/shared/types.ts`

- [ ] **Step 1: Define all shared types**

`src/shared/types.ts`:
```typescript
export interface ConnectionConfig {
  id: string;
  name: string;
  color: string;
  host: string;
  port: number;
  user: string;
  password: string;
  defaultDatabase?: string;
  sshEnabled: boolean;
  sshHost?: string;
  sshPort?: number;
  sshUser?: string;
  sshAuthType?: 'password' | 'key';
  sshPassword?: string;
  sshKeyPath?: string;
  sshPassphrase?: string;
}

export interface ColumnMeta {
  name: string;
  type: string;        // Raw MySQL type string, e.g. "varchar(255)", "enum('a','b')"
  nullable: boolean;
  key: string;         // "PRI", "UNI", "MUL", or ""
  defaultValue: string | null;
  extra: string;       // e.g. "auto_increment"
  enumValues?: string[]; // Parsed enum values if type is ENUM
}

export interface TableData {
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  totalCount: number;
  page: number;
  pageSize: number;
  primaryKey: string | null; // Column name of PK, null if none
}

export interface QueryResult {
  type: 'rows' | 'affected';
  columns?: ColumnMeta[];
  rows?: Record<string, unknown>[];
  totalCount?: number;
  affectedRows?: number;
  executionTimeMs: number;
  error?: string;
}

export interface TabInfo {
  id: string;           // Unique tab ID
  connectionId: string;
  connectionName: string;
  connectionColor: string;
  type: 'table' | 'console';
  database?: string;    // For table tabs
  table?: string;       // For table tabs
  lastAccessed: number; // Timestamp for LRU eviction
}

export interface FilterCondition {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IS NULL' | 'IS NOT NULL';
  value: string;
  logic: 'AND' | 'OR'; // How this condition joins to the previous one
}

export interface SchemaTree {
  [connectionId: string]: {
    databases: {
      name: string;
      tables: string[];
      loaded: boolean;
    }[];
    loaded: boolean;
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: define shared TypeScript types for connections, schema, queries, tabs"
```

---

### Task 3: File Manager (Main Process)

**Files:**
- Create: `src/main/file-manager.ts`, `tests/main/file-manager.test.ts`

- [ ] **Step 1: Write tests for FileManager**

`tests/main/file-manager.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { FileManager } from '../../src/main/file-manager';

describe('FileManager', () => {
  let tmpDir: string;
  let fm: FileManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-test-'));
    fm = new FileManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('connections config', () => {
    it('returns empty array when no config file exists', () => {
      expect(fm.loadConnections()).toEqual([]);
    });

    it('saves and loads connections', () => {
      const conns = [{ id: '1', name: 'Test', color: '#ff0000', host: 'localhost', port: 3306, user: 'root', password: '', sshEnabled: false }];
      fm.saveConnections(conns as any);
      expect(fm.loadConnections()).toEqual(conns);
    });
  });

  describe('SQL file persistence', () => {
    it('returns empty string when no SQL file exists', () => {
      expect(fm.loadSqlFile('conn-1')).toBe('');
    });

    it('saves and loads SQL content', () => {
      fm.saveSqlFile('conn-1', 'SELECT * FROM users;');
      expect(fm.loadSqlFile('conn-1')).toBe('SELECT * FROM users;');
    });

    it('handles multiple connections independently', () => {
      fm.saveSqlFile('conn-1', 'SELECT 1');
      fm.saveSqlFile('conn-2', 'SELECT 2');
      expect(fm.loadSqlFile('conn-1')).toBe('SELECT 1');
      expect(fm.loadSqlFile('conn-2')).toBe('SELECT 2');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/main/file-manager.test.ts
```

Expected: FAIL — `FileManager` not found.

- [ ] **Step 3: Implement FileManager**

`src/main/file-manager.ts`:
```typescript
import fs from 'fs';
import path from 'path';
import { ConnectionConfig } from '../shared/types';

export class FileManager {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
  }

  private get connectionsPath(): string {
    return path.join(this.basePath, 'connections.json');
  }

  private sqlFilePath(connectionId: string): string {
    return path.join(this.basePath, `${connectionId}.sql`);
  }

  loadConnections(): ConnectionConfig[] {
    if (!fs.existsSync(this.connectionsPath)) return [];
    const data = fs.readFileSync(this.connectionsPath, 'utf-8');
    return JSON.parse(data);
  }

  saveConnections(connections: ConnectionConfig[]): void {
    fs.writeFileSync(this.connectionsPath, JSON.stringify(connections, null, 2));
  }

  loadSqlFile(connectionId: string): string {
    const filePath = this.sqlFilePath(connectionId);
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf-8');
  }

  saveSqlFile(connectionId: string, content: string): void {
    fs.writeFileSync(this.sqlFilePath(connectionId), content);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/main/file-manager.test.ts
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/file-manager.ts tests/main/file-manager.test.ts
git commit -m "feat: implement FileManager for connection config and SQL file persistence"
```

---

### Task 4: Connection Manager (Main Process)

**Files:**
- Create: `src/main/connection-manager.ts`, `tests/main/connection-manager.test.ts`

- [ ] **Step 1: Write tests for ConnectionManager config CRUD**

`tests/main/connection-manager.test.ts`:
```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConnectionManager } from '../../src/main/connection-manager';
import { FileManager } from '../../src/main/file-manager';
import { ConnectionConfig } from '../../src/shared/types';

describe('ConnectionManager', () => {
  let tmpDir: string;
  let fm: FileManager;
  let cm: ConnectionManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-test-'));
    fm = new FileManager(tmpDir);
    cm = new ConnectionManager(fm);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('config CRUD', () => {
    it('lists empty connections initially', () => {
      expect(cm.listConnections()).toEqual([]);
    });

    it('creates a connection with generated id', () => {
      const config = { name: 'Test', color: '#ff0000', host: 'localhost', port: 3306, user: 'root', password: '', sshEnabled: false };
      const created = cm.createConnection(config as any);
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Test');
      expect(cm.listConnections()).toHaveLength(1);
    });

    it('updates an existing connection', () => {
      const created = cm.createConnection({ name: 'Old', color: '#ff0000', host: 'localhost', port: 3306, user: 'root', password: '', sshEnabled: false } as any);
      const updated = cm.updateConnection(created.id, { name: 'New' } as any);
      expect(updated.name).toBe('New');
      expect(updated.host).toBe('localhost');
    });

    it('deletes a connection', () => {
      const created = cm.createConnection({ name: 'Del', color: '#ff0000', host: 'localhost', port: 3306, user: 'root', password: '', sshEnabled: false } as any);
      cm.deleteConnection(created.id);
      expect(cm.listConnections()).toHaveLength(0);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/main/connection-manager.test.ts
```

Expected: FAIL — `ConnectionManager` not found.

- [ ] **Step 3: Implement ConnectionManager (config CRUD + connect/disconnect stubs)**

`src/main/connection-manager.ts`:
```typescript
import { randomUUID } from 'crypto';
import mysql, { Pool } from 'mysql2/promise';
import { Client as SSHClient } from 'ssh2';
import net from 'net';
import fs from 'fs';
import { ConnectionConfig } from '../shared/types';
import { FileManager } from './file-manager';

interface ActiveConnection {
  pool: Pool;
  sshClient?: SSHClient;
  sshServer?: net.Server;
}

export class ConnectionManager {
  private fileManager: FileManager;
  private active: Map<string, ActiveConnection> = new Map();

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager;
  }

  listConnections(): ConnectionConfig[] {
    return this.fileManager.loadConnections();
  }

  createConnection(config: Omit<ConnectionConfig, 'id'>): ConnectionConfig {
    const connections = this.fileManager.loadConnections();
    const newConn: ConnectionConfig = { ...config, id: randomUUID() };
    connections.push(newConn);
    this.fileManager.saveConnections(connections);
    return newConn;
  }

  updateConnection(id: string, updates: Partial<ConnectionConfig>): ConnectionConfig {
    const connections = this.fileManager.loadConnections();
    const idx = connections.findIndex(c => c.id === id);
    if (idx === -1) throw new Error(`Connection ${id} not found`);
    connections[idx] = { ...connections[idx], ...updates, id };
    this.fileManager.saveConnections(connections);
    return connections[idx];
  }

  deleteConnection(id: string): void {
    const connections = this.fileManager.loadConnections();
    this.fileManager.saveConnections(connections.filter(c => c.id !== id));
    this.disconnect(id);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    if (this.active.has(config.id)) return;

    let mysqlHost = config.host;
    let mysqlPort = config.port;
    let sshClient: SSHClient | undefined;
    let sshServer: net.Server | undefined;

    if (config.sshEnabled) {
      const tunnel = await this.createSshTunnel(config);
      sshClient = tunnel.client;
      sshServer = tunnel.server;
      mysqlHost = '127.0.0.1';
      mysqlPort = tunnel.localPort;
    }

    const pool = mysql.createPool({
      host: mysqlHost,
      port: mysqlPort,
      user: config.user,
      password: config.password,
      database: config.defaultDatabase || undefined,
      connectionLimit: 5,
      waitForConnections: true,
    });

    // Verify the connection works
    const conn = await pool.getConnection();
    conn.release();

    this.active.set(config.id, { pool, sshClient, sshServer });
  }

  async disconnect(id: string): Promise<void> {
    const active = this.active.get(id);
    if (!active) return;
    await active.pool.end();
    active.sshServer?.close();
    active.sshClient?.end();
    this.active.delete(id);
  }

  getPool(connectionId: string): Pool {
    const active = this.active.get(connectionId);
    if (!active) throw new Error(`Connection ${connectionId} is not active`);
    return active.pool;
  }

  isConnected(connectionId: string): boolean {
    return this.active.has(connectionId);
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const tempId = randomUUID();
      const tempConfig = { ...config, id: tempId };
      await this.connect(tempConfig);
      await this.disconnect(tempId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async disconnectAll(): Promise<void> {
    for (const id of this.active.keys()) {
      await this.disconnect(id);
    }
  }

  private createSshTunnel(config: ConnectionConfig): Promise<{ client: SSHClient; server: net.Server; localPort: number }> {
    return new Promise((resolve, reject) => {
      const client = new SSHClient();

      const sshConfig: any = {
        host: config.sshHost,
        port: config.sshPort || 22,
        username: config.sshUser,
      };

      if (config.sshAuthType === 'key') {
        sshConfig.privateKey = fs.readFileSync(config.sshKeyPath!);
        if (config.sshPassphrase) sshConfig.passphrase = config.sshPassphrase;
      } else {
        sshConfig.password = config.sshPassword;
      }

      client.on('ready', () => {
        const server = net.createServer((sock) => {
          client.forwardOut(
            sock.remoteAddress || '127.0.0.1',
            sock.remotePort || 0,
            config.host,
            config.port,
            (err, stream) => {
              if (err) { sock.end(); return; }
              sock.pipe(stream).pipe(sock);
            }
          );
        });

        server.listen(0, '127.0.0.1', () => {
          const localPort = (server.address() as net.AddressInfo).port;
          resolve({ client, server, localPort });
        });
      });

      client.on('error', reject);
      client.connect(sshConfig);
    });
  }
}
```

- [ ] **Step 4: Install mysql2 and ssh2 dependencies**

```bash
npm install mysql2 ssh2
npm install -D @types/ssh2
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npm test -- tests/main/connection-manager.test.ts
```

Expected: All 4 config CRUD tests PASS. (connect/disconnect/SSH tests require a live DB, tested manually.)

- [ ] **Step 6: Commit**

```bash
git add src/main/connection-manager.ts tests/main/connection-manager.test.ts package.json package-lock.json
git commit -m "feat: implement ConnectionManager with config CRUD, mysql2 pools, ssh2 tunnels"
```

---

### Task 5: Schema Browser (Main Process)

**Files:**
- Create: `src/main/schema-browser.ts`, `tests/main/schema-browser.test.ts`

- [ ] **Step 1: Write tests for SchemaBrowser**

`tests/main/schema-browser.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { SchemaBrowser } from '../../src/main/schema-browser';

const mockPool = {
  query: vi.fn(),
};

describe('SchemaBrowser', () => {
  const sb = new SchemaBrowser();

  it('parses database list from SHOW DATABASES', async () => {
    mockPool.query.mockResolvedValueOnce([[
      { Database: 'app_db' },
      { Database: 'analytics_db' },
      { Database: 'information_schema' },
    ]]);
    const dbs = await sb.listDatabases(mockPool as any);
    expect(dbs).toEqual(['app_db', 'analytics_db', 'information_schema']);
    expect(mockPool.query).toHaveBeenCalledWith('SHOW DATABASES');
  });

  it('parses table list from SHOW TABLES', async () => {
    mockPool.query.mockResolvedValueOnce([[
      { Tables_in_app_db: 'users' },
      { Tables_in_app_db: 'orders' },
    ]]);
    const tables = await sb.listTables(mockPool as any, 'app_db');
    expect(tables).toEqual(['users', 'orders']);
  });

  it('parses column metadata from DESCRIBE with enum values', async () => {
    mockPool.query.mockResolvedValueOnce([[
      { Field: 'id', Type: 'int', Null: 'NO', Key: 'PRI', Default: null, Extra: 'auto_increment' },
      { Field: 'status', Type: "enum('active','inactive','pending')", Null: 'NO', Key: '', Default: 'active', Extra: '' },
      { Field: 'bio', Type: 'text', Null: 'YES', Key: '', Default: null, Extra: '' },
    ]]);
    const cols = await sb.describeTable(mockPool as any, 'app_db', 'users');
    expect(cols).toHaveLength(3);
    expect(cols[0]).toEqual({ name: 'id', type: 'int', nullable: false, key: 'PRI', defaultValue: null, extra: 'auto_increment', enumValues: undefined });
    expect(cols[1].enumValues).toEqual(['active', 'inactive', 'pending']);
    expect(cols[2].nullable).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/main/schema-browser.test.ts
```

Expected: FAIL — `SchemaBrowser` not found.

- [ ] **Step 3: Implement SchemaBrowser**

`src/main/schema-browser.ts`:
```typescript
import { Pool } from 'mysql2/promise';
import { ColumnMeta } from '../shared/types';

export class SchemaBrowser {
  async listDatabases(pool: Pool): Promise<string[]> {
    const [rows] = await pool.query('SHOW DATABASES');
    return (rows as any[]).map(r => r.Database);
  }

  async listTables(pool: Pool, database: string): Promise<string[]> {
    const [rows] = await pool.query(`SHOW TABLES FROM \`${database}\``);
    return (rows as any[]).map(r => Object.values(r)[0] as string);
  }

  async describeTable(pool: Pool, database: string, table: string): Promise<ColumnMeta[]> {
    const [rows] = await pool.query(`DESCRIBE \`${database}\`.\`${table}\``);
    return (rows as any[]).map(row => {
      const type: string = row.Type;
      let enumValues: string[] | undefined;

      const enumMatch = type.match(/^enum\((.+)\)$/i);
      if (enumMatch) {
        enumValues = enumMatch[1]
          .split(',')
          .map(v => v.trim().replace(/^'|'$/g, ''));
      }

      return {
        name: row.Field,
        type,
        nullable: row.Null === 'YES',
        key: row.Key || '',
        defaultValue: row.Default,
        extra: row.Extra || '',
        enumValues,
      };
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/main/schema-browser.test.ts
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/schema-browser.ts tests/main/schema-browser.test.ts
git commit -m "feat: implement SchemaBrowser for listing databases, tables, and column metadata"
```

---

### Task 6: Query Executor (Main Process)

**Files:**
- Create: `src/main/query-executor.ts`, `tests/main/query-executor.test.ts`

- [ ] **Step 1: Write tests for QueryExecutor**

`tests/main/query-executor.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { QueryExecutor } from '../../src/main/query-executor';

const mockPool = { query: vi.fn(), getConnection: vi.fn() };

describe('QueryExecutor', () => {
  const qe = new QueryExecutor();

  describe('execute', () => {
    it('detects SELECT and returns rows result', async () => {
      mockPool.query.mockResolvedValueOnce([[{ id: 1, name: 'John' }], [{ name: 'id' }, { name: 'name' }]]);
      const result = await qe.execute(mockPool as any, 'SELECT * FROM users');
      expect(result.type).toBe('rows');
      expect(result.rows).toEqual([{ id: 1, name: 'John' }]);
    });

    it('detects SHOW and returns rows result', async () => {
      mockPool.query.mockResolvedValueOnce([[{ Database: 'test' }], [{ name: 'Database' }]]);
      const result = await qe.execute(mockPool as any, '  SHOW DATABASES');
      expect(result.type).toBe('rows');
    });

    it('detects UPDATE and returns affected result', async () => {
      mockPool.query.mockResolvedValueOnce([{ affectedRows: 5 }]);
      const result = await qe.execute(mockPool as any, 'UPDATE users SET status = "active"');
      expect(result.type).toBe('affected');
      expect(result.affectedRows).toBe(5);
    });

    it('returns error on SQL failure', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Unknown column'));
      const result = await qe.execute(mockPool as any, 'SELECT bad FROM nope');
      expect(result.error).toBe('Unknown column');
    });
  });

  describe('paginate', () => {
    it('builds correct query with filters and pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce([[{ 'COUNT(*)': 2500 }]])  // count query
        .mockResolvedValueOnce([[{ id: 1 }, { id: 2 }], []]); // data query
      const result = await qe.paginate(mockPool as any, 'app_db', 'users', {
        page: 2,
        pageSize: 1000,
        where: "status = 'active'",
      });
      expect(result.page).toBe(2);
      expect(result.totalCount).toBe(2500);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 1000 OFFSET 1000'),
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'active'"),
      );
    });
  });

  describe('updateCell', () => {
    it('generates UPDATE with parameterized values', async () => {
      mockPool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const result = await qe.updateCell(mockPool as any, 'app_db', 'users', 'name', 'John', 'id', 1);
      expect(result.affectedRows).toBe(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE `app_db`.`users` SET `name` = ? WHERE `id` = ?',
        ['John', 1],
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/main/query-executor.test.ts
```

Expected: FAIL — `QueryExecutor` not found.

- [ ] **Step 3: Implement QueryExecutor**

`src/main/query-executor.ts`:
```typescript
import { Pool, PoolConnection } from 'mysql2/promise';
import { QueryResult, TableData } from '../shared/types';

const SELECT_PATTERN = /^\s*(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i;

export class QueryExecutor {
  async execute(pool: Pool, sql: string): Promise<QueryResult> {
    const start = Date.now();
    try {
      const isSelect = SELECT_PATTERN.test(sql);
      const [result, fields] = await pool.query(sql);
      const executionTimeMs = Date.now() - start;

      if (isSelect) {
        return {
          type: 'rows',
          rows: result as Record<string, unknown>[],
          totalCount: (result as any[]).length,
          executionTimeMs,
        };
      } else {
        return {
          type: 'affected',
          affectedRows: (result as any).affectedRows,
          executionTimeMs,
        };
      }
    } catch (err: any) {
      return {
        type: 'affected',
        executionTimeMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  async paginate(
    pool: Pool,
    database: string,
    table: string,
    opts: { page: number; pageSize: number; where?: string; orderBy?: string },
  ): Promise<TableData> {
    const whereClause = opts.where ? `WHERE ${opts.where}` : '';
    const orderClause = opts.orderBy ? `ORDER BY ${opts.orderBy}` : '';
    const offset = (opts.page - 1) * opts.pageSize;

    const countSql = `SELECT COUNT(*) FROM \`${database}\`.\`${table}\` ${whereClause}`;
    const [[countRow]] = await pool.query(countSql) as any;
    const totalCount = countRow['COUNT(*)'];

    const dataSql = `SELECT * FROM \`${database}\`.\`${table}\` ${whereClause} ${orderClause} LIMIT ${opts.pageSize} OFFSET ${offset}`;
    const [rows] = await pool.query(dataSql);

    return {
      columns: [],  // Caller should use SchemaBrowser.describeTable separately
      rows: rows as Record<string, unknown>[],
      totalCount,
      page: opts.page,
      pageSize: opts.pageSize,
      primaryKey: null, // Caller determines from column metadata
    };
  }

  async updateCell(
    pool: Pool,
    database: string,
    table: string,
    column: string,
    value: unknown,
    pkColumn: string,
    pkValue: unknown,
  ): Promise<{ affectedRows: number }> {
    const sql = `UPDATE \`${database}\`.\`${table}\` SET \`${column}\` = ? WHERE \`${pkColumn}\` = ?`;
    const [result] = await pool.query(sql, [value, pkValue]);
    return { affectedRows: (result as any).affectedRows };
  }

  async bulkUpdate(
    pool: Pool,
    database: string,
    table: string,
    pkColumn: string,
    changes: { pkValue: unknown; column: string; value: unknown }[],
  ): Promise<{ affectedRows: number }> {
    const conn = await pool.getConnection();
    let totalAffected = 0;
    try {
      await conn.beginTransaction();
      for (const change of changes) {
        const sql = `UPDATE \`${database}\`.\`${table}\` SET \`${change.column}\` = ? WHERE \`${pkColumn}\` = ?`;
        const [result] = await conn.query(sql, [change.value, change.pkValue]);
        totalAffected += (result as any).affectedRows;
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return { affectedRows: totalAffected };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/main/query-executor.test.ts
```

Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/main/query-executor.ts tests/main/query-executor.test.ts
git commit -m "feat: implement QueryExecutor with SQL execution, pagination, and cell updates"
```

---

### Task 7: IPC Bridge (Main ↔ Renderer)

**Files:**
- Create: `src/main/ipc-handlers.ts`
- Modify: `src/main/index.ts`
- Modify: `src/preload/index.ts`
- Create: `src/renderer/hooks/use-ipc.ts`

- [ ] **Step 1: Define the preload bridge**

`src/preload/index.ts`:
```typescript
import { contextBridge, ipcRenderer } from 'electron';

const electronAPI = {
  // Connection CRUD
  connectionList: () => ipcRenderer.invoke('connection:list'),
  connectionCreate: (config: any) => ipcRenderer.invoke('connection:create', config),
  connectionUpdate: (id: string, updates: any) => ipcRenderer.invoke('connection:update', id, updates),
  connectionDelete: (id: string) => ipcRenderer.invoke('connection:delete', id),
  connectionTest: (config: any) => ipcRenderer.invoke('connection:test', config),
  connectionConnect: (id: string) => ipcRenderer.invoke('connection:connect', id),
  connectionDisconnect: (id: string) => ipcRenderer.invoke('connection:disconnect', id),

  // Schema
  schemaDatabases: (connectionId: string) => ipcRenderer.invoke('schema:databases', connectionId),
  schemaTables: (connectionId: string, database: string) => ipcRenderer.invoke('schema:tables', connectionId, database),
  schemaDescribe: (connectionId: string, database: string, table: string) => ipcRenderer.invoke('schema:describe', connectionId, database, table),

  // Query
  queryExecute: (connectionId: string, sql: string) => ipcRenderer.invoke('query:execute', connectionId, sql),
  queryPaginate: (connectionId: string, database: string, table: string, opts: any) => ipcRenderer.invoke('query:paginate', connectionId, database, table, opts),
  queryUpdate: (connectionId: string, database: string, table: string, column: string, value: any, pkColumn: string, pkValue: any) =>
    ipcRenderer.invoke('query:update', connectionId, database, table, column, value, pkColumn, pkValue),
  queryBulkUpdate: (connectionId: string, database: string, table: string, pkColumn: string, changes: any[]) =>
    ipcRenderer.invoke('query:bulk-update', connectionId, database, table, pkColumn, changes),

  // File
  sqlFileLoad: (connectionId: string) => ipcRenderer.invoke('file:sql-load', connectionId),
  sqlFileSave: (connectionId: string, content: string) => ipcRenderer.invoke('file:sql-save', connectionId, content),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
```

- [ ] **Step 2: Register IPC handlers in main**

`src/main/ipc-handlers.ts`:
```typescript
import { ipcMain } from 'electron';
import { ConnectionManager } from './connection-manager';
import { SchemaBrowser } from './schema-browser';
import { QueryExecutor } from './query-executor';
import { FileManager } from './file-manager';

export function registerIpcHandlers(
  connectionManager: ConnectionManager,
  schemaBrowser: SchemaBrowser,
  queryExecutor: QueryExecutor,
  fileManager: FileManager,
): void {
  // Connection CRUD
  ipcMain.handle('connection:list', () => connectionManager.listConnections());
  ipcMain.handle('connection:create', (_, config) => connectionManager.createConnection(config));
  ipcMain.handle('connection:update', (_, id, updates) => connectionManager.updateConnection(id, updates));
  ipcMain.handle('connection:delete', (_, id) => connectionManager.deleteConnection(id));
  ipcMain.handle('connection:test', (_, config) => connectionManager.testConnection(config));

  ipcMain.handle('connection:connect', async (_, id) => {
    const conns = connectionManager.listConnections();
    const config = conns.find(c => c.id === id);
    if (!config) throw new Error(`Connection ${id} not found`);
    await connectionManager.connect(config);
  });

  ipcMain.handle('connection:disconnect', (_, id) => connectionManager.disconnect(id));

  // Schema
  ipcMain.handle('schema:databases', (_, connectionId) => {
    const pool = connectionManager.getPool(connectionId);
    return schemaBrowser.listDatabases(pool);
  });

  ipcMain.handle('schema:tables', (_, connectionId, database) => {
    const pool = connectionManager.getPool(connectionId);
    return schemaBrowser.listTables(pool, database);
  });

  ipcMain.handle('schema:describe', (_, connectionId, database, table) => {
    const pool = connectionManager.getPool(connectionId);
    return schemaBrowser.describeTable(pool, database, table);
  });

  // Query
  ipcMain.handle('query:execute', (_, connectionId, sql) => {
    const pool = connectionManager.getPool(connectionId);
    return queryExecutor.execute(pool, sql);
  });

  ipcMain.handle('query:paginate', (_, connectionId, database, table, opts) => {
    const pool = connectionManager.getPool(connectionId);
    return queryExecutor.paginate(pool, database, table, opts);
  });

  ipcMain.handle('query:update', (_, connectionId, database, table, column, value, pkColumn, pkValue) => {
    const pool = connectionManager.getPool(connectionId);
    return queryExecutor.updateCell(pool, database, table, column, value, pkColumn, pkValue);
  });

  ipcMain.handle('query:bulk-update', (_, connectionId, database, table, pkColumn, changes) => {
    const pool = connectionManager.getPool(connectionId);
    return queryExecutor.bulkUpdate(pool, database, table, pkColumn, changes);
  });

  // File
  ipcMain.handle('file:sql-load', (_, connectionId) => fileManager.loadSqlFile(connectionId));
  ipcMain.handle('file:sql-save', (_, connectionId, content) => fileManager.saveSqlFile(connectionId, content));
}
```

- [ ] **Step 3: Wire everything in main/index.ts**

Update `src/main/index.ts` — after creating the BrowserWindow, instantiate all managers and register handlers:

```typescript
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { FileManager } from './file-manager';
import { ConnectionManager } from './connection-manager';
import { SchemaBrowser } from './schema-browser';
import { QueryExecutor } from './query-executor';
import { registerIpcHandlers } from './ipc-handlers';

const fileManager = new FileManager(app.getPath('userData'));
const connectionManager = new ConnectionManager(fileManager);
const schemaBrowser = new SchemaBrowser();
const queryExecutor = new QueryExecutor();

registerIpcHandlers(connectionManager, schemaBrowser, queryExecutor, fileManager);

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
};

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  await connectionManager.disconnectAll();
  app.quit();
});
```

- [ ] **Step 4: Create typed IPC hook for renderer**

`src/renderer/hooks/use-ipc.ts`:
```typescript
import type { ElectronAPI } from '../../preload/index';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export function useIpc(): ElectronAPI {
  return window.electronAPI;
}
```

- [ ] **Step 5: Verify app still launches**

```bash
npm start
```

Expected: App opens without errors. No visible changes yet.

- [ ] **Step 6: Commit**

```bash
git add src/main/ipc-handlers.ts src/main/index.ts src/preload/index.ts src/renderer/hooks/use-ipc.ts
git commit -m "feat: wire IPC bridge between main process and renderer"
```

---

### Task 8: App Context (Global State)

**Files:**
- Create: `src/renderer/context/app-context.tsx`, `tests/renderer/app-context.test.tsx`

- [ ] **Step 1: Write tests for AppContext tab management**

`tests/renderer/app-context.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { AppProvider, useAppContext } from '../../src/renderer/context/app-context';
import { TabInfo } from '../../src/shared/types';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AppProvider>{children}</AppProvider>
);

describe('AppContext', () => {
  describe('tab management', () => {
    it('opens a new tab', () => {
      const { result } = renderHook(() => useAppContext(), { wrapper });
      act(() => {
        result.current.openTab({
          connectionId: 'c1', connectionName: 'Prod', connectionColor: '#00d2ff',
          type: 'table', database: 'app_db', table: 'users',
        });
      });
      expect(result.current.tabs).toHaveLength(1);
      expect(result.current.tabs[0].table).toBe('users');
      expect(result.current.activeTabId).toBe(result.current.tabs[0].id);
    });

    it('focuses existing tab instead of duplicating', () => {
      const { result } = renderHook(() => useAppContext(), { wrapper });
      act(() => {
        result.current.openTab({ connectionId: 'c1', connectionName: 'Prod', connectionColor: '#00d2ff', type: 'table', database: 'app_db', table: 'users' });
      });
      act(() => {
        result.current.openTab({ connectionId: 'c1', connectionName: 'Prod', connectionColor: '#00d2ff', type: 'table', database: 'app_db', table: 'users' });
      });
      expect(result.current.tabs).toHaveLength(1);
    });

    it('evicts oldest tab when exceeding 10', () => {
      const { result } = renderHook(() => useAppContext(), { wrapper });
      for (let i = 0; i < 11; i++) {
        act(() => {
          result.current.openTab({ connectionId: 'c1', connectionName: 'Prod', connectionColor: '#00d2ff', type: 'table', database: 'db', table: `table_${i}` });
        });
      }
      expect(result.current.tabs).toHaveLength(10);
      expect(result.current.tabs.find(t => t.table === 'table_0')).toBeUndefined();
    });

    it('closes a tab', () => {
      const { result } = renderHook(() => useAppContext(), { wrapper });
      act(() => {
        result.current.openTab({ connectionId: 'c1', connectionName: 'Prod', connectionColor: '#00d2ff', type: 'table', database: 'db', table: 'users' });
      });
      const tabId = result.current.tabs[0].id;
      act(() => { result.current.closeTab(tabId); });
      expect(result.current.tabs).toHaveLength(0);
      expect(result.current.activeTabId).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/renderer/app-context.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement AppContext**

`src/renderer/context/app-context.tsx`:
```tsx
import React, { createContext, useContext, useReducer, useCallback } from 'react';
import { TabInfo, ConnectionConfig, SchemaTree } from '../../shared/types';

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

const MAX_TABS = 10;

interface AppState {
  connections: ConnectionConfig[];
  tabs: TabInfo[];
  activeTabId: string | null;
  schema: SchemaTree;
}

type Action =
  | { type: 'SET_CONNECTIONS'; connections: ConnectionConfig[] }
  | { type: 'OPEN_TAB'; tab: TabInfo }
  | { type: 'CLOSE_TAB'; tabId: string }
  | { type: 'SET_ACTIVE_TAB'; tabId: string }
  | { type: 'SET_SCHEMA'; connectionId: string; databases: SchemaTree[string]['databases']; loaded: boolean }
  | { type: 'SET_TABLES'; connectionId: string; database: string; tables: string[] };

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_CONNECTIONS':
      return { ...state, connections: action.connections };

    case 'OPEN_TAB': {
      const newTabs = [...state.tabs];
      // Evict oldest if at limit
      if (newTabs.length >= MAX_TABS) {
        const oldest = newTabs.reduce((min, t) => t.lastAccessed < min.lastAccessed ? t : min);
        const idx = newTabs.indexOf(oldest);
        newTabs.splice(idx, 1);
      }
      newTabs.push(action.tab);
      return { ...state, tabs: newTabs, activeTabId: action.tab.id };
    }

    case 'CLOSE_TAB': {
      const newTabs = state.tabs.filter(t => t.id !== action.tabId);
      let newActiveId = state.activeTabId;
      if (state.activeTabId === action.tabId) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }
      return { ...state, tabs: newTabs, activeTabId: newActiveId };
    }

    case 'SET_ACTIVE_TAB': {
      const tabs = state.tabs.map(t =>
        t.id === action.tabId ? { ...t, lastAccessed: Date.now() } : t
      );
      return { ...state, tabs, activeTabId: action.tabId };
    }

    case 'SET_SCHEMA': {
      return {
        ...state,
        schema: {
          ...state.schema,
          [action.connectionId]: { databases: action.databases, loaded: action.loaded },
        },
      };
    }

    case 'SET_TABLES': {
      const connSchema = state.schema[action.connectionId];
      if (!connSchema) return state;
      const databases = connSchema.databases.map(db =>
        db.name === action.database ? { ...db, tables: action.tables, loaded: true } : db
      );
      return {
        ...state,
        schema: { ...state.schema, [action.connectionId]: { ...connSchema, databases } },
      };
    }

    default:
      return state;
  }
}

interface AppContextValue extends AppState {
  dispatch: React.Dispatch<Action>;
  openTab: (opts: Omit<TabInfo, 'id' | 'lastAccessed'>) => void;
  closeTab: (tabId: string) => void;
  setActiveTab: (tabId: string) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, {
    connections: [],
    tabs: [],
    activeTabId: null,
    schema: {},
  });

  const openTab = useCallback((opts: Omit<TabInfo, 'id' | 'lastAccessed'>) => {
    // Check for duplicate
    const existing = state.tabs.find(t =>
      t.connectionId === opts.connectionId &&
      t.type === opts.type &&
      t.database === opts.database &&
      t.table === opts.table
    );
    if (existing) {
      dispatch({ type: 'SET_ACTIVE_TAB', tabId: existing.id });
      return;
    }
    const tab: TabInfo = { ...opts, id: randomId(), lastAccessed: Date.now() };
    dispatch({ type: 'OPEN_TAB', tab });
  }, [state.tabs]);

  const closeTab = useCallback((tabId: string) => {
    dispatch({ type: 'CLOSE_TAB', tabId });
  }, []);

  const setActiveTab = useCallback((tabId: string) => {
    dispatch({ type: 'SET_ACTIVE_TAB', tabId });
  }, []);

  return (
    <AppContext.Provider value={{ ...state, dispatch, openTab, closeTab, setActiveTab }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useAppContext must be used within AppProvider');
  return ctx;
}
```

Note: Remove the `import { randomId } from './utils';` line — the `randomId` function is defined inline above it. Clean up the duplicate.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/renderer/app-context.test.tsx
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/context/app-context.tsx tests/renderer/app-context.test.tsx
git commit -m "feat: implement AppContext with tab management, schema cache, and connection state"
```

---

### Task 9: App Shell Layout

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/app.css`
- Modify: `src/renderer/index.tsx`
- Create: `src/renderer/components/Sidebar.tsx`
- Create: `src/renderer/components/TabBar.tsx`

- [ ] **Step 1: Update index.tsx to wrap App in AppProvider**

`src/renderer/index.tsx`:
```tsx
import { createRoot } from 'react-dom/client';
import { AppProvider } from './context/app-context';
import App from './App';
import './app.css';

const root = createRoot(document.getElementById('root')!);
root.render(
  <AppProvider>
    <App />
  </AppProvider>
);
```

- [ ] **Step 2: Create Sidebar placeholder**

`src/renderer/components/Sidebar.tsx`:
```tsx
import { useAppContext } from '../context/app-context';

export default function Sidebar() {
  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Connections</span>
        <button className="sidebar-refresh" title="Refresh all">↻</button>
      </div>
      <div className="sidebar-tree">
        <button className="add-connection-btn">+ Add Connection</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create TabBar placeholder**

`src/renderer/components/TabBar.tsx`:
```tsx
import { useAppContext } from '../context/app-context';

export default function TabBar() {
  const { tabs, activeTabId, setActiveTab, closeTab } = useAppContext();

  if (tabs.length === 0) return null;

  return (
    <div className="tab-bar">
      {tabs.map(tab => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'tab-active' : ''}`}
          onClick={() => setActiveTab(tab.id)}
        >
          <span className="tab-badge" style={{ backgroundColor: tab.connectionColor + '22', color: tab.connectionColor }}>
            {tab.connectionName.slice(0, 4)}
          </span>
          <span className="tab-label">
            {tab.type === 'console' ? '⌨️ SQL Console' : `📋 ${tab.table}`}
          </span>
          <span className="tab-close" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>✕</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Wire up App.tsx layout**

`src/renderer/App.tsx`:
```tsx
import { useAppContext } from './context/app-context';
import Sidebar from './components/Sidebar';
import TabBar from './components/TabBar';

export default function App() {
  const { tabs, activeTabId } = useAppContext();
  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <div className="app">
      <Sidebar />
      <div className="main-area">
        <TabBar />
        <div className="main-content">
          {!activeTab && (
            <div className="empty-state">Select a table or open a SQL Console</div>
          )}
          {activeTab?.type === 'table' && (
            <div className="placeholder">Table View: {activeTab.database}.{activeTab.table}</div>
          )}
          {activeTab?.type === 'console' && (
            <div className="placeholder">SQL Console: {activeTab.connectionName}</div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add dark theme CSS**

`src/renderer/app.css`:
```css
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #e0e0e0; overflow: hidden; font-size: 13px; }

.app { display: flex; height: 100vh; width: 100vw; }

/* Sidebar */
.sidebar { width: 240px; background: #16213e; border-right: 1px solid #0f3460; display: flex; flex-direction: column; }
.sidebar-header { display: flex; align-items: center; padding: 10px 12px; border-bottom: 1px solid #0f3460; }
.sidebar-title { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #888; flex: 1; }
.sidebar-refresh { background: none; border: none; color: #888; cursor: pointer; font-size: 14px; padding: 2px 6px; border-radius: 3px; }
.sidebar-refresh:hover { background: #0f3460; color: #00d2ff; }
.sidebar-tree { flex: 1; overflow-y: auto; padding: 8px; }
.add-connection-btn { width: 100%; padding: 8px; background: none; border: 1px dashed #0f3460; border-radius: 4px; color: #555; cursor: pointer; font-size: 11px; }
.add-connection-btn:hover { border-color: #00d2ff; color: #00d2ff; }

/* Tree nodes */
.tree-node { padding: 4px 8px; cursor: pointer; border-radius: 3px; display: flex; align-items: center; gap: 6px; user-select: none; }
.tree-node:hover { background: #0f3460; }
.tree-node-active { background: #1a1a4e; color: #00d2ff; }
.tree-node-indent { padding-left: 16px; }
.tree-arrow { font-size: 10px; width: 12px; color: #888; }

/* Main area */
.main-area { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* Tab bar */
.tab-bar { display: flex; background: #16213e; border-bottom: 1px solid #0f3460; overflow-x: auto; padding-top: 4px; }
.tab { display: flex; align-items: center; gap: 6px; padding: 7px 14px; cursor: pointer; white-space: nowrap; border-top: 2px solid transparent; font-size: 12px; color: #888; }
.tab:hover { color: #c0c0c0; }
.tab-active { background: #1a1a2e; color: #e0e0e0; border-top-color: #00d2ff; border-radius: 4px 4px 0 0; }
.tab-badge { font-size: 10px; font-weight: 600; padding: 1px 5px; border-radius: 2px; }
.tab-close { font-size: 10px; margin-left: 4px; color: #555; padding: 0 2px; border-radius: 2px; }
.tab-close:hover { background: #ef4444; color: white; }

/* Main content */
.main-content { flex: 1; overflow: auto; }
.empty-state { display: flex; align-items: center; justify-content: center; height: 100%; color: #555; font-size: 14px; }
.placeholder { padding: 20px; color: #888; }

/* Context menu */
.context-menu { position: fixed; background: #16213e; border: 1px solid #0f3460; border-radius: 4px; padding: 4px 0; z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.4); min-width: 160px; }
.context-menu-item { padding: 6px 12px; cursor: pointer; font-size: 12px; }
.context-menu-item:hover { background: #0f3460; color: #00d2ff; }

/* Buttons */
.btn { padding: 4px 12px; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; }
.btn-primary { background: #00d2ff; color: #1a1a2e; font-weight: 600; }
.btn-primary:hover { background: #00b8e6; }
.btn-secondary { background: #0f3460; color: #c0c0c0; }
.btn-secondary:hover { background: #163a6e; }
.btn-danger { background: #ef4444; color: white; }

/* Inputs */
.input { background: #0d0d1a; border: 1px solid #0f3460; border-radius: 3px; color: #e0e0e0; padding: 6px 10px; font-size: 12px; width: 100%; }
.input:focus { outline: none; border-color: #00d2ff; }
.select { background: #0d0d1a; border: 1px solid #0f3460; border-radius: 3px; color: #e0e0e0; padding: 6px 10px; font-size: 12px; }

/* Modal overlay */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal { background: #16213e; border: 1px solid #0f3460; border-radius: 8px; padding: 24px; min-width: 400px; max-width: 600px; box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
.modal-title { font-size: 16px; font-weight: 600; margin-bottom: 16px; color: #e0e0e0; }
```

- [ ] **Step 6: Verify app launches with sidebar + tab bar layout**

```bash
npm start
```

Expected: Dark-themed app with left sidebar (showing "Connections" header + "+ Add Connection" button) and main area showing "Select a table or open a SQL Console".

- [ ] **Step 7: Commit**

```bash
git add src/renderer/App.tsx src/renderer/app.css src/renderer/index.tsx src/renderer/components/Sidebar.tsx src/renderer/components/TabBar.tsx
git commit -m "feat: implement app shell layout with sidebar, tab bar, and dark theme"
```

---

### Task 10: Connection Dialog

**Files:**
- Create: `src/renderer/components/ConnectionDialog.tsx`
- Modify: `src/renderer/components/Sidebar.tsx`

- [ ] **Step 1: Implement ConnectionDialog**

`src/renderer/components/ConnectionDialog.tsx`:
```tsx
import { useState } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { ConnectionConfig } from '../../shared/types';

interface Props {
  connection?: ConnectionConfig; // If editing
  onClose: () => void;
  onSaved: () => void;
}

const COLORS = ['#00d2ff', '#4ade80', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#84cc16'];

export default function ConnectionDialog({ connection, onClose, onSaved }: Props) {
  const ipc = useIpc();
  const [form, setForm] = useState({
    name: connection?.name ?? '',
    color: connection?.color ?? COLORS[0],
    host: connection?.host ?? 'localhost',
    port: connection?.port ?? 3306,
    user: connection?.user ?? 'root',
    password: connection?.password ?? '',
    defaultDatabase: connection?.defaultDatabase ?? '',
    sshEnabled: connection?.sshEnabled ?? false,
    sshHost: connection?.sshHost ?? '',
    sshPort: connection?.sshPort ?? 22,
    sshUser: connection?.sshUser ?? '',
    sshAuthType: connection?.sshAuthType ?? 'password' as 'password' | 'key',
    sshPassword: connection?.sshPassword ?? '',
    sshKeyPath: connection?.sshKeyPath ?? '',
    sshPassphrase: connection?.sshPassphrase ?? '',
  });
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; error?: string } | null>(null);

  const set = (key: string, value: any) => setForm(f => ({ ...f, [key]: value }));

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const result = await ipc.connectionTest(form);
    setTestResult(result);
    setTesting(false);
  };

  const handleSave = async () => {
    if (connection) {
      await ipc.connectionUpdate(connection.id, form);
    } else {
      await ipc.connectionCreate(form);
    }
    onSaved();
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ minWidth: 500 }}>
        <div className="modal-title">{connection ? 'Edit' : 'New'} Connection</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Name</div>
            <input className="input" value={form.name} onChange={e => set('name', e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Color</div>
            <div style={{ display: 'flex', gap: 4 }}>
              {COLORS.map(c => (
                <div
                  key={c}
                  onClick={() => set('color', c)}
                  style={{
                    width: 24, height: 24, borderRadius: 4, background: c, cursor: 'pointer',
                    outline: form.color === c ? '2px solid white' : 'none', outlineOffset: 2,
                  }}
                />
              ))}
            </div>
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Host</div>
            <input className="input" value={form.host} onChange={e => set('host', e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Port</div>
            <input className="input" type="number" value={form.port} onChange={e => set('port', Number(e.target.value))} />
          </label>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>User</div>
            <input className="input" value={form.user} onChange={e => set('user', e.target.value)} />
          </label>
          <label>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Password</div>
            <input className="input" type="password" value={form.password} onChange={e => set('password', e.target.value)} />
          </label>
        </div>

        <label style={{ marginBottom: 16, display: 'block' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Default Database (optional)</div>
          <input className="input" value={form.defaultDatabase} onChange={e => set('defaultDatabase', e.target.value)} />
        </label>

        {/* SSH Section */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.sshEnabled} onChange={e => set('sshEnabled', e.target.checked)} />
          <span style={{ fontSize: 12, color: '#c0c0c0' }}>Connect via SSH Tunnel</span>
        </label>

        {form.sshEnabled && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12, marginBottom: 12 }}>
              <label>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>SSH Host</div>
                <input className="input" value={form.sshHost} onChange={e => set('sshHost', e.target.value)} />
              </label>
              <label>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>SSH Port</div>
                <input className="input" type="number" value={form.sshPort} onChange={e => set('sshPort', Number(e.target.value))} />
              </label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <label>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>SSH User</div>
                <input className="input" value={form.sshUser} onChange={e => set('sshUser', e.target.value)} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="radio" checked={form.sshAuthType === 'password'} onChange={() => set('sshAuthType', 'password')} />
                <span style={{ fontSize: 12 }}>Password</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
                <input type="radio" checked={form.sshAuthType === 'key'} onChange={() => set('sshAuthType', 'key')} />
                <span style={{ fontSize: 12 }}>Key File</span>
              </label>
            </div>
            {form.sshAuthType === 'password' ? (
              <label style={{ marginBottom: 12, display: 'block' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>SSH Password</div>
                <input className="input" type="password" value={form.sshPassword} onChange={e => set('sshPassword', e.target.value)} />
              </label>
            ) : (
              <>
                <label style={{ marginBottom: 12, display: 'block' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Key File Path</div>
                  <input className="input" value={form.sshKeyPath} onChange={e => set('sshKeyPath', e.target.value)} />
                </label>
                <label style={{ marginBottom: 12, display: 'block' }}>
                  <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>Passphrase (optional)</div>
                  <input className="input" type="password" value={form.sshPassphrase} onChange={e => set('sshPassphrase', e.target.value)} />
                </label>
              </>
            )}
          </>
        )}

        {/* Test result */}
        {testResult && (
          <div style={{ padding: 8, borderRadius: 4, marginBottom: 12, fontSize: 12, background: testResult.success ? '#002a00' : '#2a0000', color: testResult.success ? '#4ade80' : '#ef4444' }}>
            {testResult.success ? '✓ Connection successful' : `✗ ${testResult.error}`}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary" onClick={handleTest} disabled={testing}>
            {testing ? 'Testing...' : 'Test Connection'}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update Sidebar to open the dialog**

Update `src/renderer/components/Sidebar.tsx` to add state for showing the dialog:

```tsx
import { useState } from 'react';
import ConnectionDialog from './ConnectionDialog';
import { useAppContext } from '../context/app-context';
import { useIpc } from '../hooks/use-ipc';

export default function Sidebar() {
  const [showDialog, setShowDialog] = useState(false);
  const { connections, dispatch } = useAppContext();
  const ipc = useIpc();

  const refreshConnections = async () => {
    const conns = await ipc.connectionList();
    dispatch({ type: 'SET_CONNECTIONS', connections: conns });
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Connections</span>
        <button className="sidebar-refresh" title="Refresh all" onClick={refreshConnections}>↻</button>
      </div>
      <div className="sidebar-tree">
        {/* Tree nodes will be added in Task 11 */}
        <button className="add-connection-btn" onClick={() => setShowDialog(true)}>+ Add Connection</button>
      </div>
      {showDialog && (
        <ConnectionDialog
          onClose={() => setShowDialog(false)}
          onSaved={refreshConnections}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify dialog opens in the app**

```bash
npm start
```

Expected: Click "+ Add Connection" → modal opens with all MySQL + SSH fields, color picker, test button.

- [ ] **Step 4: Commit**

```bash
git add src/renderer/components/ConnectionDialog.tsx src/renderer/components/Sidebar.tsx
git commit -m "feat: implement connection config dialog with SSH support and test button"
```

---

### Task 11: Sidebar Tree View

**Files:**
- Modify: `src/renderer/components/Sidebar.tsx`

- [ ] **Step 1: Implement full sidebar tree with connection → database → table hierarchy**

Replace `src/renderer/components/Sidebar.tsx` with the full implementation:

```tsx
import { useState, useEffect, useCallback } from 'react';
import ConnectionDialog from './ConnectionDialog';
import { useAppContext } from '../context/app-context';
import { useIpc } from '../hooks/use-ipc';
import { ConnectionConfig } from '../../shared/types';

export default function Sidebar() {
  const [showDialog, setShowDialog] = useState(false);
  const [editingConnection, setEditingConnection] = useState<ConnectionConfig | undefined>();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connectionId: string } | null>(null);
  const [expandedConns, setExpandedConns] = useState<Set<string>>(new Set());
  const [expandedDbs, setExpandedDbs] = useState<Set<string>>(new Set());
  const [connecting, setConnecting] = useState<Set<string>>(new Set());

  const { connections, schema, dispatch, openTab } = useAppContext();
  const ipc = useIpc();

  useEffect(() => {
    loadConnections();
    const handler = () => setContextMenu(null);
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
  }, []);

  const loadConnections = async () => {
    const conns = await ipc.connectionList();
    dispatch({ type: 'SET_CONNECTIONS', connections: conns });
  };

  const handleRefreshAll = async () => {
    for (const connId of expandedConns) {
      const dbs = await ipc.schemaDatabases(connId);
      dispatch({
        type: 'SET_SCHEMA',
        connectionId: connId,
        databases: dbs.map((name: string) => ({ name, tables: [], loaded: false })),
        loaded: true,
      });
    }
  };

  const toggleConnection = async (conn: ConnectionConfig) => {
    if (expandedConns.has(conn.id)) {
      setExpandedConns(prev => { const s = new Set(prev); s.delete(conn.id); return s; });
      return;
    }

    setConnecting(prev => new Set(prev).add(conn.id));
    try {
      await ipc.connectionConnect(conn.id);
      const dbs = await ipc.schemaDatabases(conn.id);
      dispatch({
        type: 'SET_SCHEMA',
        connectionId: conn.id,
        databases: dbs.map((name: string) => ({ name, tables: [], loaded: false })),
        loaded: true,
      });
      setExpandedConns(prev => new Set(prev).add(conn.id));
    } catch (err: any) {
      alert(`Connection failed: ${err.message}`);
    } finally {
      setConnecting(prev => { const s = new Set(prev); s.delete(conn.id); return s; });
    }
  };

  const toggleDatabase = async (connectionId: string, dbName: string) => {
    const key = `${connectionId}:${dbName}`;
    if (expandedDbs.has(key)) {
      setExpandedDbs(prev => { const s = new Set(prev); s.delete(key); return s; });
      return;
    }

    const tables = await ipc.schemaTables(connectionId, dbName);
    dispatch({ type: 'SET_TABLES', connectionId, database: dbName, tables });
    setExpandedDbs(prev => new Set(prev).add(key));
  };

  const handleTableClick = (conn: ConnectionConfig, database: string, table: string) => {
    openTab({
      connectionId: conn.id,
      connectionName: conn.name,
      connectionColor: conn.color,
      type: 'table',
      database,
      table,
    });
  };

  const handleContextMenu = (e: React.MouseEvent, connectionId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, connectionId });
  };

  const handleContextAction = async (action: string) => {
    if (!contextMenu) return;
    const conn = connections.find(c => c.id === contextMenu.connectionId);
    if (!conn) return;

    switch (action) {
      case 'edit':
        setEditingConnection(conn);
        setShowDialog(true);
        break;
      case 'delete':
        await ipc.connectionDelete(conn.id);
        loadConnections();
        break;
      case 'disconnect':
        await ipc.connectionDisconnect(conn.id);
        setExpandedConns(prev => { const s = new Set(prev); s.delete(conn.id); return s; });
        break;
      case 'console':
        openTab({
          connectionId: conn.id,
          connectionName: conn.name,
          connectionColor: conn.color,
          type: 'console',
        });
        break;
    }
    setContextMenu(null);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-title">Connections</span>
        <button className="sidebar-refresh" title="Refresh all" onClick={handleRefreshAll}>↻</button>
      </div>
      <div className="sidebar-tree">
        {connections.map(conn => (
          <div key={conn.id}>
            <div
              className="tree-node"
              onClick={() => toggleConnection(conn)}
              onContextMenu={(e) => handleContextMenu(e, conn.id)}
            >
              <span className="tree-arrow">{connecting.has(conn.id) ? '⏳' : expandedConns.has(conn.id) ? '▼' : '▶'}</span>
              <span>🔌</span>
              <span>{conn.name}</span>
            </div>

            {expandedConns.has(conn.id) && schema[conn.id]?.databases.map(db => (
              <div key={db.name} className="tree-node-indent">
                <div className="tree-node" onClick={() => toggleDatabase(conn.id, db.name)}>
                  <span className="tree-arrow">{expandedDbs.has(`${conn.id}:${db.name}`) ? '▼' : '▶'}</span>
                  <span>📁</span>
                  <span>{db.name}</span>
                </div>

                {expandedDbs.has(`${conn.id}:${db.name}`) && db.tables.map(table => (
                  <div key={table} className="tree-node-indent">
                    <div className="tree-node" onClick={() => handleTableClick(conn, db.name, table)}>
                      <span style={{ width: 12 }}></span>
                      <span>📋</span>
                      <span>{table}</span>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}

        <button className="add-connection-btn" onClick={() => { setEditingConnection(undefined); setShowDialog(true); }}>
          + Add Connection
        </button>
      </div>

      {showDialog && (
        <ConnectionDialog
          connection={editingConnection}
          onClose={() => { setShowDialog(false); setEditingConnection(undefined); }}
          onSaved={loadConnections}
        />
      )}

      {contextMenu && (
        <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }}>
          <div className="context-menu-item" onClick={() => handleContextAction('console')}>Open SQL Console</div>
          <div className="context-menu-item" onClick={() => handleContextAction('edit')}>Edit</div>
          <div className="context-menu-item" onClick={() => handleContextAction('disconnect')}>Disconnect</div>
          <div className="context-menu-item" onClick={() => handleContextAction('delete')} style={{ color: '#ef4444' }}>Delete</div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify tree works in the app**

```bash
npm start
```

Expected: Add a connection, expand it to see databases, expand a database to see tables, click a table to open a tab. Right-click for context menu.

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/Sidebar.tsx
git commit -m "feat: implement sidebar tree view with expand/collapse, context menu, and schema loading"
```

---

### Task 12: Pagination Component

**Files:**
- Create: `src/renderer/components/Pagination.tsx`, `tests/renderer/Pagination.test.tsx`

- [ ] **Step 1: Write tests for Pagination**

`tests/renderer/Pagination.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Pagination from '../../src/renderer/components/Pagination';

describe('Pagination', () => {
  it('shows correct range text', () => {
    render(<Pagination page={1} pageSize={1000} totalCount={2500} onPageChange={() => {}} />);
    expect(screen.getByText('Showing 1-1000 of 2,500 rows')).toBeTruthy();
  });

  it('shows last page partial range', () => {
    render(<Pagination page={3} pageSize={1000} totalCount={2500} onPageChange={() => {}} />);
    expect(screen.getByText('Showing 2001-2500 of 2,500 rows')).toBeTruthy();
  });

  it('calls onPageChange when clicking next', () => {
    const onPageChange = vi.fn();
    render(<Pagination page={1} pageSize={1000} totalCount={2500} onPageChange={onPageChange} />);
    fireEvent.click(screen.getByText('Next →'));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('disables prev on first page', () => {
    render(<Pagination page={1} pageSize={1000} totalCount={2500} onPageChange={() => {}} />);
    expect(screen.getByText('← Prev').closest('span')).toHaveStyle({ opacity: '0.3' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/renderer/Pagination.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement Pagination**

`src/renderer/components/Pagination.tsx`:
```tsx
interface Props {
  page: number;
  pageSize: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export default function Pagination({ page, pageSize, totalCount, onPageChange }: Props) {
  const totalPages = Math.ceil(totalCount / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);

  const pageNumbers = (): (number | '...')[] => {
    const pages: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
        pages.push(i);
      }
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="pagination">
      <span>Showing {start.toLocaleString()}-{end.toLocaleString()} of {totalCount.toLocaleString()} rows</span>
      <div className="pagination-controls">
        <span
          className="pagination-btn"
          style={{ opacity: page === 1 ? 0.3 : 1, pointerEvents: page === 1 ? 'none' : 'auto' }}
          onClick={() => onPageChange(page - 1)}
        >
          ← Prev
        </span>
        {pageNumbers().map((p, i) =>
          p === '...' ? (
            <span key={`ellipsis-${i}`} className="pagination-ellipsis">...</span>
          ) : (
            <span
              key={p}
              className={`pagination-btn ${p === page ? 'pagination-active' : ''}`}
              onClick={() => onPageChange(p)}
            >
              {p}
            </span>
          )
        )}
        <span
          className="pagination-btn"
          style={{ opacity: page === totalPages ? 0.3 : 1, pointerEvents: page === totalPages ? 'none' : 'auto' }}
          onClick={() => onPageChange(page + 1)}
        >
          Next →
        </span>
      </div>
      <span>{pageSize.toLocaleString()} rows/page</span>
    </div>
  );
}
```

Add to `app.css`:
```css
/* Pagination */
.pagination { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #16213e; border-top: 1px solid #0f3460; font-size: 11px; color: #888; }
.pagination-controls { display: flex; gap: 4px; }
.pagination-btn { padding: 4px 8px; background: #0f3460; border-radius: 3px; cursor: pointer; }
.pagination-btn:hover { background: #163a6e; }
.pagination-active { background: #00d2ff; color: #1a1a2e; font-weight: 600; }
.pagination-ellipsis { padding: 4px; color: #555; }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/renderer/Pagination.test.tsx
```

Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/Pagination.tsx tests/renderer/Pagination.test.tsx src/renderer/app.css
git commit -m "feat: implement Pagination component with page navigation and range display"
```

---

### Task 13: Filter Topbar

**Files:**
- Create: `src/renderer/components/FilterTopbar.tsx`, `tests/renderer/FilterTopbar.test.tsx`

- [ ] **Step 1: Write tests for FilterTopbar**

`tests/renderer/FilterTopbar.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import FilterTopbar from '../../src/renderer/components/FilterTopbar';

const columns = [
  { name: 'id', type: 'int', nullable: false, key: 'PRI', defaultValue: null, extra: '' },
  { name: 'status', type: "enum('active','inactive')", nullable: false, key: '', defaultValue: null, extra: '', enumValues: ['active', 'inactive'] },
  { name: 'name', type: 'varchar(255)', nullable: true, key: '', defaultValue: null, extra: '' },
];

describe('FilterTopbar', () => {
  it('renders with structured mode by default', () => {
    render(<FilterTopbar columns={columns} onFilterChange={() => {}} saveMode="auto" onSaveModeChange={() => {}} onRefresh={() => {}} />);
    expect(screen.getByText('+ Add Filter')).toBeTruthy();
  });

  it('switches to raw WHERE mode', () => {
    render(<FilterTopbar columns={columns} onFilterChange={() => {}} saveMode="auto" onSaveModeChange={() => {}} onRefresh={() => {}} />);
    fireEvent.click(screen.getByText('WHERE clause'));
    expect(screen.getByPlaceholderText('e.g. status = \'active\' AND age > 18')).toBeTruthy();
  });

  it('toggles save mode', () => {
    const onSaveModeChange = vi.fn();
    render(<FilterTopbar columns={columns} onFilterChange={() => {}} saveMode="auto" onSaveModeChange={onSaveModeChange} onRefresh={() => {}} />);
    fireEvent.click(screen.getByText('Bulk Commit'));
    expect(onSaveModeChange).toHaveBeenCalledWith('bulk');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- tests/renderer/FilterTopbar.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement FilterTopbar**

`src/renderer/components/FilterTopbar.tsx`:
```tsx
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
      logic: filters.length === 0 ? 'AND' : 'AND',
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
```

Add to `app.css`:
```css
/* Filter topbar */
.filter-topbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; background: #16213e; border-bottom: 1px solid #0f3460; gap: 8px; flex-wrap: wrap; }
.filter-left { display: flex; align-items: center; gap: 6px; flex: 1; flex-wrap: wrap; }
.filter-right { display: flex; align-items: center; gap: 8px; }
.filter-mode-btn { padding: 4px 8px; border-radius: 3px; font-size: 11px; cursor: pointer; color: #888; background: #0f3460; }
.filter-mode-active { color: #00d2ff; background: #0a2744; }
.save-mode-active { color: #4ade80; background: #002a00; }
.filter-chip { display: flex; align-items: center; gap: 4px; background: #1a1a4e; padding: 2px 6px; border-radius: 3px; }
.filter-remove { color: #ef4444; cursor: pointer; font-size: 10px; padding: 0 2px; }
.filter-add { color: #00d2ff; cursor: pointer; font-size: 11px; }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- tests/renderer/FilterTopbar.test.tsx
```

Expected: All 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/renderer/components/FilterTopbar.tsx tests/renderer/FilterTopbar.test.tsx src/renderer/app.css
git commit -m "feat: implement FilterTopbar with structured filters, raw WHERE, and save mode toggle"
```

---

### Task 14: Cell Editors (Inline + Text Modal)

**Files:**
- Create: `src/renderer/components/CellEditor.tsx`
- Create: `src/renderer/components/TextEditModal.tsx`

- [ ] **Step 1: Implement CellEditor**

`src/renderer/components/CellEditor.tsx`:
```tsx
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

  const isNull = value === null;
  const displayValue = isNull ? 'NULL' : String(value);
  const isNumber = NUMBER_TYPES.test(column.type);
  const isText = TEXT_TYPES.test(column.type);
  const isEnum = ENUM_TYPE.test(column.type);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  if (!editable) {
    return <span className={isNull ? 'cell-null' : ''}>{displayValue}</span>;
  }

  // ENUM → dropdown
  if (isEnum && column.enumValues) {
    return (
      <select
        className="select cell-select"
        value={isNull ? '' : String(value)}
        onChange={e => onSave(e.target.value)}
      >
        {column.nullable && <option value="">NULL</option>}
        {column.enumValues.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
    );
  }

  // TEXT/BLOB → click to open modal
  if (isText) {
    return (
      <span
        className="cell-text-trigger"
        onClick={() => onOpenTextModal(isNull ? '' : String(value), (v) => onSave(v || null))}
      >
        {isNull ? <span className="cell-null">NULL</span> : `${displayValue.slice(0, 50)}${displayValue.length > 50 ? '...' : ''}`}
        <span className="cell-text-icon">📝</span>
      </span>
    );
  }

  // Inline editing for numbers, varchar, dates
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
      onClick={() => { setEditValue(isNull ? '' : String(value)); setEditing(true); }}
    >
      {displayValue}
    </span>
  );
}
```

- [ ] **Step 2: Implement TextEditModal**

`src/renderer/components/TextEditModal.tsx`:
```tsx
import { useState } from 'react';

interface Props {
  initialValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
}

export default function TextEditModal({ initialValue, onSave, onClose }: Props) {
  const [value, setValue] = useState(initialValue);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Edit Text Field</div>
        <textarea
          className="input"
          style={{ height: 200, resize: 'vertical', fontFamily: 'monospace' }}
          value={value}
          onChange={e => setValue(e.target.value)}
          autoFocus
        />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => { onSave(value); onClose(); }}>Save</button>
        </div>
      </div>
    </div>
  );
}
```

Add to `app.css`:
```css
/* Cell editors */
.cell-null { color: #555; font-style: italic; }
.cell-editable { cursor: pointer; border-bottom: 1px dashed #0f3460; }
.cell-editable:hover { color: #00d2ff; }
.cell-input { padding: 2px 6px; font-size: 12px; width: 100%; }
.cell-select { padding: 2px 4px; font-size: 11px; }
.cell-text-trigger { cursor: pointer; display: flex; align-items: center; gap: 4px; }
.cell-text-trigger:hover { color: #00d2ff; }
.cell-text-icon { font-size: 10px; opacity: 0.5; }
.cell-modified { background: #1a2a1a !important; }
```

- [ ] **Step 3: Commit**

```bash
git add src/renderer/components/CellEditor.tsx src/renderer/components/TextEditModal.tsx src/renderer/app.css
git commit -m "feat: implement type-aware cell editors (inline, dropdown, text modal)"
```

---

### Task 15: DataGrid + TableView

**Files:**
- Create: `src/renderer/components/DataGrid.tsx`
- Create: `src/renderer/components/ResultTable.tsx`
- Create: `src/renderer/components/TableView.tsx`

- [ ] **Step 1: Install TanStack Table**

```bash
npm install @tanstack/react-table
```

- [ ] **Step 2: Implement DataGrid (editable)**

`src/renderer/components/DataGrid.tsx`:
```tsx
import { useMemo, useState } from 'react';
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from '@tanstack/react-table';
import { ColumnMeta } from '../../shared/types';
import CellEditor from './CellEditor';
import TextEditModal from './TextEditModal';

interface Props {
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  primaryKey: string | null;
  saveMode: 'auto' | 'bulk';
  onCellSave: (rowPkValue: unknown, column: string, value: unknown) => void;
  pendingChanges: Map<string, unknown>; // key: `${pkValue}:${column}`
}

export default function DataGrid({ columns, rows, primaryKey, saveMode, onCellSave, pendingChanges }: Props) {
  const [textModal, setTextModal] = useState<{ value: string; onSave: (v: string) => void } | null>(null);
  const editable = primaryKey !== null;

  const tableCols = useMemo<ColumnDef<Record<string, unknown>>[]>(() =>
    columns.map(col => ({
      accessorKey: col.name,
      header: col.name,
      cell: ({ row }) => {
        const pkValue = primaryKey ? row.original[primaryKey] : null;
        const changeKey = `${pkValue}:${col.name}`;
        const currentValue = pendingChanges.has(changeKey)
          ? pendingChanges.get(changeKey)
          : row.original[col.name];

        return (
          <CellEditor
            value={currentValue}
            column={col}
            editable={editable && col.key !== 'PRI'}
            onSave={(newValue) => onCellSave(pkValue, col.name, newValue)}
            onOpenTextModal={(val, saveFn) => setTextModal({ value: val, onSave: saveFn })}
          />
        );
      },
    })),
    [columns, primaryKey, editable, pendingChanges, onCellSave],
  );

  const table = useReactTable({
    data: rows,
    columns: tableCols,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <>
      <div className="datagrid-wrapper">
        <table className="datagrid">
          <thead>
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(h => (
                  <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map(row => (
              <tr key={row.id}>
                {row.getVisibleCells().map(cell => {
                  const pkValue = primaryKey ? row.original[primaryKey] : null;
                  const isModified = pendingChanges.has(`${pkValue}:${cell.column.id}`);
                  return (
                    <td key={cell.id} className={isModified ? 'cell-modified' : ''}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!editable && (
        <div className="no-pk-notice">This table has no primary key. Editing is disabled.</div>
      )}

      {textModal && (
        <TextEditModal
          initialValue={textModal.value}
          onSave={textModal.onSave}
          onClose={() => setTextModal(null)}
        />
      )}
    </>
  );
}
```

Add to `app.css`:
```css
/* DataGrid */
.datagrid-wrapper { flex: 1; overflow: auto; }
.datagrid { width: 100%; border-collapse: collapse; font-size: 12px; }
.datagrid thead th { padding: 8px 12px; text-align: left; color: #00d2ff; font-weight: 500; background: #0f3460; position: sticky; top: 0; z-index: 1; white-space: nowrap; }
.datagrid tbody tr { border-bottom: 1px solid #0f3460; }
.datagrid tbody tr:nth-child(even) { background: #16213e; }
.datagrid tbody td { padding: 6px 12px; white-space: nowrap; max-width: 300px; overflow: hidden; text-overflow: ellipsis; }
.no-pk-notice { padding: 8px 12px; background: #2a2000; color: #f59e0b; font-size: 11px; text-align: center; }
```

- [ ] **Step 3: Implement ResultTable (read-only, used by SQL Console)**

`src/renderer/components/ResultTable.tsx`:
```tsx
import { useMemo } from 'react';
import { useReactTable, getCoreRowModel, flexRender, ColumnDef } from '@tanstack/react-table';

interface Props {
  columns: string[];
  rows: Record<string, unknown>[];
}

export default function ResultTable({ columns, rows }: Props) {
  const tableCols = useMemo<ColumnDef<Record<string, unknown>>[]>(() =>
    columns.map(col => ({
      accessorKey: col,
      header: col,
    })),
    [columns],
  );

  const table = useReactTable({
    data: rows,
    columns: tableCols,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="datagrid-wrapper">
      <table className="datagrid">
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(h => (
                <th key={h.id}>{flexRender(h.column.columnDef.header, h.getContext())}</th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>
                  {cell.getValue() === null
                    ? <span className="cell-null">NULL</span>
                    : String(cell.getValue())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Implement TableView (container)**

`src/renderer/components/TableView.tsx`:
```tsx
import { useState, useEffect, useCallback } from 'react';
import { useIpc } from '../hooks/use-ipc';
import { ColumnMeta, TabInfo } from '../../shared/types';
import FilterTopbar from './FilterTopbar';
import DataGrid from './DataGrid';
import Pagination from './Pagination';

interface Props {
  tab: TabInfo;
}

const PAGE_SIZE = 1000;

export default function TableView({ tab }: Props) {
  const ipc = useIpc();
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [where, setWhere] = useState('');
  const [saveMode, setSaveMode] = useState<'auto' | 'bulk'>('auto');
  const [pendingChanges, setPendingChanges] = useState<Map<string, unknown>>(new Map());
  const [loading, setLoading] = useState(true);
  const [primaryKey, setPrimaryKey] = useState<string | null>(null);

  const loadData = useCallback(async (pageNum: number, whereClause: string) => {
    setLoading(true);
    try {
      // Load columns if not yet loaded
      if (columns.length === 0) {
        const cols = await ipc.schemaDescribe(tab.connectionId, tab.database!, tab.table!);
        setColumns(cols);
        const pk = cols.find((c: ColumnMeta) => c.key === 'PRI');
        setPrimaryKey(pk ? pk.name : null);
      }

      const data = await ipc.queryPaginate(tab.connectionId, tab.database!, tab.table!, {
        page: pageNum,
        pageSize: PAGE_SIZE,
        where: whereClause || undefined,
      });

      setRows(data.rows);
      setTotalCount(data.totalCount);
      setPage(pageNum);
    } finally {
      setLoading(false);
    }
  }, [tab.connectionId, tab.database, tab.table, columns.length]);

  useEffect(() => {
    loadData(1, '');
  }, [tab.connectionId, tab.database, tab.table]);

  const handlePageChange = (newPage: number) => {
    loadData(newPage, where);
  };

  const handleFilterChange = (newWhere: string) => {
    setWhere(newWhere);
    loadData(1, newWhere);
  };

  const handleRefresh = () => {
    loadData(page, where);
  };

  const handleCellSave = async (pkValue: unknown, column: string, value: unknown) => {
    if (saveMode === 'auto') {
      await ipc.queryUpdate(tab.connectionId, tab.database!, tab.table!, column, value, primaryKey!, pkValue);
      handleRefresh();
    } else {
      setPendingChanges(prev => {
        const next = new Map(prev);
        next.set(`${pkValue}:${column}`, value);
        return next;
      });
    }
  };

  const handleBulkCommit = async () => {
    if (!primaryKey || pendingChanges.size === 0) return;
    const changes = Array.from(pendingChanges.entries()).map(([key, value]) => {
      const separatorIdx = key.indexOf(':');
      const pkValue = key.slice(0, separatorIdx);
      const column = key.slice(separatorIdx + 1);
      return { pkValue, column, value };
    });
    await ipc.queryBulkUpdate(tab.connectionId, tab.database!, tab.table!, primaryKey, changes);
    setPendingChanges(new Map());
    handleRefresh();
  };

  return (
    <div className="table-view">
      <FilterTopbar
        columns={columns}
        onFilterChange={handleFilterChange}
        saveMode={saveMode}
        onSaveModeChange={setSaveMode}
        onRefresh={handleRefresh}
      />
      {saveMode === 'bulk' && pendingChanges.size > 0 && (
        <div className="bulk-commit-bar">
          <span>{pendingChanges.size} pending change(s)</span>
          <button className="btn btn-primary" onClick={handleBulkCommit}>Commit</button>
          <button className="btn btn-secondary" onClick={() => setPendingChanges(new Map())}>Discard</button>
        </div>
      )}
      {loading ? (
        <div className="empty-state">Loading...</div>
      ) : (
        <DataGrid
          columns={columns}
          rows={rows}
          primaryKey={primaryKey}
          saveMode={saveMode}
          onCellSave={handleCellSave}
          pendingChanges={pendingChanges}
        />
      )}
      {!loading && totalCount > 0 && (
        <Pagination page={page} pageSize={PAGE_SIZE} totalCount={totalCount} onPageChange={handlePageChange} />
      )}
    </div>
  );
}
```

Add to `app.css`:
```css
/* Table view */
.table-view { display: flex; flex-direction: column; height: 100%; }
.bulk-commit-bar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: #1a2a1a; border-bottom: 1px solid #0f3460; font-size: 11px; color: #4ade80; }
```

- [ ] **Step 5: Wire TableView into App.tsx**

Update the table-type tab rendering in `src/renderer/App.tsx`:

```tsx
import TableView from './components/TableView';

// Replace the placeholder:
{activeTab?.type === 'table' && <TableView tab={activeTab} />}
```

- [ ] **Step 6: Verify table view loads data**

```bash
npm start
```

Expected: Connect to a MySQL server, expand database, click table → see data grid with filters, pagination, inline editing.

- [ ] **Step 7: Commit**

```bash
git add src/renderer/components/DataGrid.tsx src/renderer/components/ResultTable.tsx src/renderer/components/TableView.tsx src/renderer/App.tsx src/renderer/app.css package.json package-lock.json
git commit -m "feat: implement TableView with editable DataGrid, filters, pagination, and save modes"
```

---

### Task 16: SQL Console

**Files:**
- Create: `src/renderer/components/SqlConsole.tsx`
- Create: `src/renderer/hooks/use-debounce.ts`

- [ ] **Step 1: Install CodeMirror dependencies**

```bash
npm install @codemirror/lang-sql @codemirror/autocomplete @codemirror/theme-one-dark codemirror @uiw/react-codemirror
```

- [ ] **Step 2: Implement useDebounce hook**

`src/renderer/hooks/use-debounce.ts`:
```typescript
import { useRef, useEffect, useCallback } from 'react';

export function useDebounce<T extends (...args: any[]) => any>(fn: T, delay: number): T {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    return () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  return useCallback((...args: any[]) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => fn(...args), delay);
  }, [fn, delay]) as any;
}
```

- [ ] **Step 3: Implement SqlConsole**

`src/renderer/components/SqlConsole.tsx`:
```tsx
import { useState, useEffect, useCallback, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { sql, MySQL } from '@codemirror/lang-sql';
import { oneDark } from '@codemirror/theme-one-dark';
import { useIpc } from '../hooks/use-ipc';
import { useDebounce } from '../hooks/use-debounce';
import { useAppContext } from '../context/app-context';
import { TabInfo, QueryResult } from '../../shared/types';
import ResultTable from './ResultTable';
import Pagination from './Pagination';

interface Props {
  tab: TabInfo;
}

const PAGE_SIZE = 1000;

export default function SqlConsole({ tab }: Props) {
  const ipc = useIpc();
  const { schema } = useAppContext();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [resultPage, setResultPage] = useState(1);
  const [running, setRunning] = useState(false);
  const [dividerY, setDividerY] = useState(250);
  const dragging = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load persisted SQL
  useEffect(() => {
    ipc.sqlFileLoad(tab.connectionId).then((content: string) => {
      if (content) setCode(content);
    });
  }, [tab.connectionId]);

  // Debounced save
  const debouncedSave = useDebounce((content: string) => {
    ipc.sqlFileSave(tab.connectionId, content);
  }, 1000);

  const handleCodeChange = (value: string) => {
    setCode(value);
    debouncedSave(value);
  };

  const handleRun = async () => {
    if (!code.trim()) return;
    setRunning(true);
    setResult(null);
    const res = await ipc.queryExecute(tab.connectionId, code);
    setResult(res);
    setResultPage(1);
    setRunning(false);
  };

  // Build autocomplete schema from sidebar data
  const completionSchema = useCallback(() => {
    const connSchema = schema[tab.connectionId];
    if (!connSchema) return {};
    const tables: Record<string, string[]> = {};
    for (const db of connSchema.databases) {
      for (const table of db.tables) {
        tables[table] = []; // Column completion would need describe call
      }
    }
    return tables;
  }, [schema, tab.connectionId]);

  // Resizer
  const handleMouseDown = () => { dragging.current = true; };
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const y = e.clientY - rect.top;
      setDividerY(Math.max(100, Math.min(y, rect.height - 100)));
    };
    const handleMouseUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Paginated result rows
  const resultRows = result?.rows || [];
  const totalResultCount = result?.totalCount || 0;
  const pagedRows = resultRows.slice((resultPage - 1) * PAGE_SIZE, resultPage * PAGE_SIZE);
  const resultColumns = pagedRows.length > 0 ? Object.keys(pagedRows[0]) : [];

  return (
    <div className="sql-console" ref={containerRef}>
      {/* Editor area */}
      <div className="sql-editor" style={{ height: dividerY }}>
        <div className="sql-toolbar">
          <button className="btn btn-primary" onClick={handleRun} disabled={running}>
            {running ? '⏳ Running...' : '▶ Run'}
          </button>
          <span className="sql-shortcut">⌘+Enter</span>
        </div>
        <div className="sql-codemirror" onKeyDown={e => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); handleRun(); }
        }}>
          <CodeMirror
            value={code}
            onChange={handleCodeChange}
            extensions={[sql({ dialect: MySQL, schema: completionSchema() })]}
            theme={oneDark}
            height={`${dividerY - 36}px`}
            basicSetup={{ lineNumbers: true, foldGutter: true, autocompletion: true }}
          />
        </div>
      </div>

      {/* Resizer */}
      <div className="sql-resizer" onMouseDown={handleMouseDown}>
        <span>⋯⋯⋯</span>
      </div>

      {/* Result area */}
      <div className="sql-result">
        {!result && !running && (
          <div className="empty-state">Run a query to see results</div>
        )}

        {result?.error && (
          <div className="sql-error">
            <div className="sql-error-title">Error</div>
            <div>{result.error}</div>
          </div>
        )}

        {result && !result.error && result.type === 'rows' && (
          <>
            <div className="sql-result-header">
              <span style={{ color: '#4ade80' }}>✓ {totalResultCount.toLocaleString()} rows returned</span>
              <span style={{ color: '#555', marginLeft: 12 }}>in {(result.executionTimeMs / 1000).toFixed(3)}s</span>
              <span style={{ marginLeft: 'auto', color: '#555' }}>Read-only result</span>
            </div>
            <ResultTable columns={resultColumns} rows={pagedRows} />
            {totalResultCount > PAGE_SIZE && (
              <Pagination page={resultPage} pageSize={PAGE_SIZE} totalCount={totalResultCount} onPageChange={setResultPage} />
            )}
          </>
        )}

        {result && !result.error && result.type === 'affected' && (
          <div className="sql-affected">
            <div className="sql-affected-count">{result.affectedRows}</div>
            <div className="sql-affected-label">rows affected</div>
            <div className="sql-affected-time">in {(result.executionTimeMs / 1000).toFixed(3)}s</div>
          </div>
        )}
      </div>
    </div>
  );
}
```

Add to `app.css`:
```css
/* SQL Console */
.sql-console { display: flex; flex-direction: column; height: 100%; }
.sql-editor { display: flex; flex-direction: column; overflow: hidden; }
.sql-toolbar { display: flex; align-items: center; gap: 8px; padding: 6px 12px; background: #16213e; border-bottom: 1px solid #0f3460; }
.sql-shortcut { color: #555; font-size: 10px; }
.sql-codemirror { flex: 1; overflow: hidden; }
.sql-codemirror .cm-editor { height: 100%; }
.sql-resizer { height: 4px; background: #0f3460; cursor: row-resize; display: flex; align-items: center; justify-content: center; color: #555; font-size: 8px; user-select: none; }
.sql-resizer:hover { background: #00d2ff; }
.sql-result { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
.sql-result-header { display: flex; align-items: center; padding: 6px 12px; background: #16213e; border-bottom: 1px solid #0f3460; font-size: 11px; }
.sql-error { padding: 16px; color: #ef4444; }
.sql-error-title { font-weight: 600; margin-bottom: 8px; }
.sql-affected { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; }
.sql-affected-count { font-size: 36px; font-weight: 700; color: #f59e0b; }
.sql-affected-label { font-size: 13px; color: #888; margin-top: 4px; }
.sql-affected-time { font-size: 11px; color: #555; margin-top: 4px; }
```

- [ ] **Step 4: Wire SqlConsole into App.tsx**

Update `src/renderer/App.tsx`:

```tsx
import SqlConsole from './components/SqlConsole';

// Replace the console placeholder:
{activeTab?.type === 'console' && <SqlConsole tab={activeTab} />}
```

- [ ] **Step 5: Verify SQL Console works**

```bash
npm start
```

Expected: Right-click a connection → Open SQL Console. Type SQL with autocomplete, run with ⌘+Enter, see table results for SELECT or affected count for UPDATE. Resize the editor/result split.

- [ ] **Step 6: Commit**

```bash
git add src/renderer/components/SqlConsole.tsx src/renderer/hooks/use-debounce.ts src/renderer/App.tsx src/renderer/app.css package.json package-lock.json
git commit -m "feat: implement SQL Console with CodeMirror 6, autocomplete, and result display"
```

---

### Task 17: Final Integration & CLAUDE.md

**Files:**
- Create: `CLAUDE.md`
- Create: `.gitignore` (finalize)

- [ ] **Step 1: Create CLAUDE.md**

`CLAUDE.md`:
```markdown
# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MySQL Explorer — personal Electron desktop app for browsing and editing MySQL databases. Built with Electron Forge + React + TypeScript.

## Architecture

Electron main process handles all MySQL connections (mysql2), SSH tunnels (ssh2), config persistence, and SQL file storage. React renderer communicates via IPC invoke/handle. State managed with React context + useReducer.

- `src/main/` — Electron main process: ConnectionManager, SchemaBrowser, QueryExecutor, FileManager, IPC handlers
- `src/preload/` — contextBridge exposing typed IPC API to renderer
- `src/renderer/` — React UI: components, context, hooks
- `src/shared/types.ts` — TypeScript types shared between main and renderer

## Commands

- `npm start` — launch the app in development mode
- `npm test` — run all tests with Vitest
- `npm test -- tests/main/file-manager.test.ts` — run a single test file
- `npm run make` — build distributable packages

## Key Libraries

- **TanStack Table** for data grids (DataGrid.tsx, ResultTable.tsx)
- **CodeMirror 6** with @codemirror/lang-sql for the SQL editor (SqlConsole.tsx)
- **mysql2/promise** for MySQL connections (connection-manager.ts)
- **ssh2** for SSH tunneling (connection-manager.ts)

## Connection configs stored in Electron's userData directory as connections.json. SQL console files persisted as {connectionId}.sql in the same location.
```

- [ ] **Step 2: Finalize .gitignore**

`.gitignore`:
```
node_modules/
out/
.superpowers/
dist/
*.log
```

- [ ] **Step 3: Run full test suite**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md .gitignore
git commit -m "docs: add CLAUDE.md and finalize .gitignore"
```
