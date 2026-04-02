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
  ipcMain.handle('query:use-database', async (_, connectionId, database) => {
    const pool = connectionManager.getPool(connectionId);
    await pool.query(`USE \`${database}\``);
  });

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
