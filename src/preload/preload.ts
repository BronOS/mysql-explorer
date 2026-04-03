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

  // Import
  importDataGrip: () => ipcRenderer.invoke('import:datagrip'),

  // Events
  onRefresh: (callback: () => void) => {
    ipcRenderer.on('app:refresh', callback);
    return () => { ipcRenderer.removeListener('app:refresh', callback); };
  },
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

export type ElectronAPI = typeof electronAPI;
