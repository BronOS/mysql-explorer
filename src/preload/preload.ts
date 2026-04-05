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
  schemaAllColumns: (connectionId: string, database: string, tables: string[]) => ipcRenderer.invoke('schema:all-columns', connectionId, database, tables),
  schemaFullColumns: (connectionId: string, database: string, table: string) => ipcRenderer.invoke('schema:full-columns', connectionId, database, table),
  schemaIndexes: (connectionId: string, database: string, table: string) => ipcRenderer.invoke('schema:indexes', connectionId, database, table),
  schemaCreateTable: (connectionId: string, database: string, table: string) => ipcRenderer.invoke('schema:create-table', connectionId, database, table),
  schemaAlterTable: (connectionId: string, sql: string) => ipcRenderer.invoke('schema:alter-table', connectionId, sql),
  schemaDropTable: (connectionId: string, database: string, table: string) => ipcRenderer.invoke('schema:drop-table', connectionId, database, table),
  schemaDropDatabase: (connectionId: string, name: string) => ipcRenderer.invoke('schema:drop-database', connectionId, name),
  schemaCreateDatabase: (connectionId: string, name: string, charset: string, collation: string) => ipcRenderer.invoke('schema:create-database', connectionId, name, charset, collation),
  schemaViews: (connectionId: string, database: string) => ipcRenderer.invoke('schema:views', connectionId, database),
  schemaCreateView: (connectionId: string, database: string, view: string) => ipcRenderer.invoke('schema:create-view', connectionId, database, view),
  schemaProcedures: (connectionId: string, database: string) => ipcRenderer.invoke('schema:procedures', connectionId, database),
  schemaCreateProcedure: (connectionId: string, database: string, name: string) => ipcRenderer.invoke('schema:create-procedure', connectionId, database, name),
  schemaFunctions: (connectionId: string, database: string) => ipcRenderer.invoke('schema:functions', connectionId, database),
  schemaCreateFunction: (connectionId: string, database: string, name: string) => ipcRenderer.invoke('schema:create-function', connectionId, database, name),
  schemaTriggers: (connectionId: string, database: string) => ipcRenderer.invoke('schema:triggers', connectionId, database),
  schemaCreateTrigger: (connectionId: string, database: string, name: string) => ipcRenderer.invoke('schema:create-trigger', connectionId, database, name),
  schemaEvents: (connectionId: string, database: string) => ipcRenderer.invoke('schema:events', connectionId, database),
  schemaCreateEvent: (connectionId: string, database: string, name: string) => ipcRenderer.invoke('schema:create-event', connectionId, database, name),

  // Query
  queryUseDatabase: (connectionId: string, database: string) => ipcRenderer.invoke('query:use-database', connectionId, database),
  queryExecute: (connectionId: string, sql: string) => ipcRenderer.invoke('query:execute', connectionId, sql),
  queryPaginate: (connectionId: string, database: string, table: string, opts: any) => ipcRenderer.invoke('query:paginate', connectionId, database, table, opts),
  queryUpdate: (connectionId: string, database: string, table: string, column: string, value: any, pkColumn: string, pkValue: any) =>
    ipcRenderer.invoke('query:update', connectionId, database, table, column, value, pkColumn, pkValue),
  queryBulkUpdate: (connectionId: string, database: string, table: string, pkColumn: string, changes: any[]) =>
    ipcRenderer.invoke('query:bulk-update', connectionId, database, table, pkColumn, changes),
  queryInsertRows: (connectionId: string, database: string, table: string, rows: any[]) =>
    ipcRenderer.invoke('query:insert-rows', connectionId, database, table, rows),
  queryDeleteRow: (connectionId: string, database: string, table: string, pkColumn: string, pkValue: any) =>
    ipcRenderer.invoke('query:delete-row', connectionId, database, table, pkColumn, pkValue),

  // File
  sqlFileLoad: (connectionId: string) => ipcRenderer.invoke('file:sql-load', connectionId),
  sqlFileSave: (connectionId: string, content: string) => ipcRenderer.invoke('file:sql-save', connectionId, content),

  // Schema cache
  schemaCacheLoad: () => ipcRenderer.invoke('schema:cache-load'),
  schemaCacheSave: (cache: any) => ipcRenderer.invoke('schema:cache-save', cache),

  // Export
  exportPickFolder: () => ipcRenderer.invoke('export:pick-folder'),
  exportPickSaveFile: (defaultName: string, ext: string) => ipcRenderer.invoke('export:pick-save-file', defaultName, ext),
  exportWriteFile: (filePath: string, content: string) => ipcRenderer.invoke('export:write-file', filePath, content),
  exportFetchAllRows: (connectionId: string, database: string, table: string, columns?: string[]) =>
    ipcRenderer.invoke('export:fetch-all-rows', connectionId, database, table, columns),

  // Import SQL file
  importPickSqlFile: () => ipcRenderer.invoke('import:pick-sql-file'),
  importExecuteSqlFile: (connectionId: string, filePath: string, database?: string) =>
    ipcRenderer.invoke('import:execute-sql-file', connectionId, filePath, database),
  onImportProgress: (callback: (progress: { executed: number; errors: number; currentStatement: string }) => void) => {
    const handler = (_: any, progress: any) => callback(progress);
    ipcRenderer.on('import:progress', handler);
    return () => { ipcRenderer.removeListener('import:progress', handler); };
  },

  // Snippets
  snippetsLoad: () => ipcRenderer.invoke('snippets:load'),
  snippetsSave: (snippets: any[]) => ipcRenderer.invoke('snippets:save', snippets),

  // Import
  importDataGrip: () => ipcRenderer.invoke('import:datagrip'),

  // UI State (persisted to disk, not localStorage)
  uiLoadState: () => ipcRenderer.invoke('ui:load-state'),
  uiSaveState: (state: any) => ipcRenderer.invoke('ui:save-state', state),

  // Events
  onRefresh: (callback: () => void) => {
    ipcRenderer.on('app:refresh', callback);
    return () => { ipcRenderer.removeListener('app:refresh', callback); };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
