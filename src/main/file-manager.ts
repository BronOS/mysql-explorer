import fs from 'fs';
import path from 'path';
import { ConnectionConfig, Snippet } from '../shared/types';

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

  private get schemaCachePath(): string {
    return path.join(this.basePath, 'schema-cache.json');
  }

  loadSchemaCache(): Record<string, any> {
    if (!fs.existsSync(this.schemaCachePath)) return {};
    try {
      return JSON.parse(fs.readFileSync(this.schemaCachePath, 'utf-8'));
    } catch {
      return {};
    }
  }

  saveSchemaCache(cache: Record<string, any>): void {
    fs.writeFileSync(this.schemaCachePath, JSON.stringify(cache));
  }

  private get uiStatePath(): string {
    return path.join(this.basePath, 'ui-state.json');
  }

  loadUiState(): Record<string, any> {
    if (!fs.existsSync(this.uiStatePath)) return {};
    try {
      return JSON.parse(fs.readFileSync(this.uiStatePath, 'utf-8'));
    } catch {
      return {};
    }
  }

  saveUiState(state: Record<string, any>): void {
    fs.writeFileSync(this.uiStatePath, JSON.stringify(state));
  }

  private get snippetsPath(): string {
    return path.join(this.basePath, 'snippets.json');
  }

  loadSnippets(): Snippet[] {
    if (!fs.existsSync(this.snippetsPath)) {
      // Seed with common snippets on first use
      const defaults = this.defaultSnippets();
      this.saveSnippets(defaults);
      return defaults;
    }
    try {
      return JSON.parse(fs.readFileSync(this.snippetsPath, 'utf-8'));
    } catch {
      return [];
    }
  }

  private defaultSnippets(): Snippet[] {
    return [
      {
        id: 'default-select',
        name: 'Select all from table',
        prefix: 'sel',
        body: 'SELECT * FROM {{table}} LIMIT 100;',
      },
      {
        id: 'default-select-where',
        name: 'Select with WHERE',
        prefix: 'selw',
        body: 'SELECT * FROM {{table}} WHERE {{column}} = {{value}} LIMIT 100;',
      },
      {
        id: 'default-select-join',
        name: 'Select with JOIN',
        prefix: 'join',
        body: 'SELECT a.*, b.*\nFROM {{table1}} a\nINNER JOIN {{table2}} b ON a.{{column}} = b.{{column}}\nLIMIT 100;',
      },
      {
        id: 'default-select-count',
        name: 'Count rows',
        prefix: 'cnt',
        body: 'SELECT COUNT(*) AS total FROM {{table}};',
      },
      {
        id: 'default-select-group',
        name: 'Group by with count',
        prefix: 'grp',
        body: 'SELECT {{column}}, COUNT(*) AS cnt\nFROM {{table}}\nGROUP BY {{column}}\nORDER BY cnt DESC;',
      },
      {
        id: 'default-insert',
        name: 'Insert row',
        prefix: 'ins',
        body: 'INSERT INTO {{table}} ({{column1}}, {{column2}})\nVALUES ({{value1}}, {{value2}});',
      },
      {
        id: 'default-update',
        name: 'Update rows',
        prefix: 'upd',
        body: 'UPDATE {{table}}\nSET {{column}} = {{value}}\nWHERE {{condition}};',
      },
      {
        id: 'default-delete',
        name: 'Delete rows',
        prefix: 'del',
        body: 'DELETE FROM {{table}} WHERE {{condition}};',
      },
      {
        id: 'default-create-table',
        name: 'Create table',
        prefix: 'crt',
        body: 'CREATE TABLE {{table}} (\n  id INT NOT NULL AUTO_INCREMENT,\n  {{column}} VARCHAR(255) NOT NULL,\n  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,\n  PRIMARY KEY (id)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;',
      },
      {
        id: 'default-add-column',
        name: 'Add column',
        prefix: 'addc',
        body: 'ALTER TABLE {{table}} ADD COLUMN {{column}} {{type}} AFTER {{after_column}};',
      },
      {
        id: 'default-add-index',
        name: 'Add index',
        prefix: 'addi',
        body: 'ALTER TABLE {{table}} ADD INDEX idx_{{column}} ({{column}});',
      },
      {
        id: 'default-show-processlist',
        name: 'Show running queries',
        prefix: 'proc',
        body: 'SHOW FULL PROCESSLIST;',
      },
      {
        id: 'default-table-sizes',
        name: 'Table sizes in database',
        prefix: 'sizes',
        body: 'SELECT\n  table_name AS `Table`,\n  ROUND(data_length / 1024 / 1024, 2) AS `Data (MB)`,\n  ROUND(index_length / 1024 / 1024, 2) AS `Index (MB)`,\n  ROUND((data_length + index_length) / 1024 / 1024, 2) AS `Total (MB)`,\n  table_rows AS `Rows`\nFROM information_schema.tables\nWHERE table_schema = {{database}}\nORDER BY (data_length + index_length) DESC;',
      },
      {
        id: 'default-duplicates',
        name: 'Find duplicates',
        prefix: 'dup',
        body: 'SELECT {{column}}, COUNT(*) AS cnt\nFROM {{table}}\nGROUP BY {{column}}\nHAVING cnt > 1\nORDER BY cnt DESC;',
      },
      {
        id: 'default-foreign-keys',
        name: 'Show foreign keys',
        prefix: 'fk',
        body: 'SELECT\n  constraint_name,\n  table_name,\n  column_name,\n  referenced_table_name,\n  referenced_column_name\nFROM information_schema.key_column_usage\nWHERE table_schema = {{database}}\n  AND referenced_table_name IS NOT NULL\nORDER BY table_name;',
      },
      {
        id: 'default-slow-queries',
        name: 'Recent slow queries',
        prefix: 'slow',
        body: 'SELECT * FROM mysql.slow_log\nORDER BY start_time DESC\nLIMIT 50;',
      },
      {
        id: 'default-variables',
        name: 'Show server variables',
        prefix: 'vars',
        body: "SHOW VARIABLES LIKE '%{{pattern}}%';",
      },
      {
        id: 'default-status',
        name: 'Show server status',
        prefix: 'stat',
        body: "SHOW GLOBAL STATUS LIKE '%{{pattern}}%';",
      },
    ];
  }

  saveSnippets(snippets: Snippet[]): void {
    fs.writeFileSync(this.snippetsPath, JSON.stringify(snippets, null, 2));
  }
}
