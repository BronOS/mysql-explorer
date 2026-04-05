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
  type: string;
  nullable: boolean;
  key: string;
  defaultValue: string | null;
  extra: string;
  enumValues?: string[];
}

export interface TableData {
  columns: ColumnMeta[];
  rows: Record<string, unknown>[];
  totalCount: number;
  page: number;
  pageSize: number;
  primaryKey: string | null;
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

export interface FilterCondition {
  column: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IS NULL' | 'IS NOT NULL';
  value: string;
  logic: 'AND' | 'OR';
}

export interface FullColumnInfo {
  field: string;
  type: string;
  baseType: string;
  length: string;
  unsigned: boolean;
  zerofill: boolean;
  binary: boolean;
  nullable: boolean;
  key: string;
  defaultValue: string | null;
  extra: string;
  encoding: string;
  collation: string;
  comment: string;
}

export interface IndexInfo {
  name: string;
  type: string;
  columns: string[];
  unique: boolean;
}

export interface Snippet {
  id: string;
  name: string;
  prefix: string;
  body: string;
}

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
