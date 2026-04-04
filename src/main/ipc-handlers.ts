import { ipcMain } from 'electron';
import { ConnectionManager } from './connection-manager';
import { SchemaBrowser } from './schema-browser';
import { QueryExecutor } from './query-executor';
import { FileManager } from './file-manager';
import { importDataGripConnections } from './datagrip-import';

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
  ipcMain.handle('schema:databases', async (_, connectionId) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.listDatabases(pool);
  });

  ipcMain.handle('schema:tables', async (_, connectionId, database) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.listTables(pool, database);
  });

  ipcMain.handle('schema:describe', async (_, connectionId, database, table) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.describeTable(pool, database, table);
  });

  ipcMain.handle('schema:all-columns', async (_, connectionId, database, tables: string[]) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    const result: { [table: string]: string[] } = {};
    // Fetch in parallel, batches of 10 to avoid overwhelming the pool
    for (let i = 0; i < tables.length; i += 10) {
      const batch = tables.slice(i, i + 10);
      const descriptions = await Promise.all(
        batch.map(t => schemaBrowser.describeTable(pool, database, t).catch(() => []))
      );
      batch.forEach((t, idx) => {
        result[t] = descriptions[idx].map(c => c.name);
      });
    }
    return result;
  });

  ipcMain.handle('schema:full-columns', async (_, connectionId, database, table) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.fullColumns(pool, database, table);
  });

  ipcMain.handle('schema:indexes', async (_, connectionId, database, table) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.indexes(pool, database, table);
  });

  ipcMain.handle('schema:create-table', async (_, connectionId, database, table) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.createTableDDL(pool, database, table);
  });

  ipcMain.handle('schema:alter-table', async (_, connectionId, sql) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.alterTable(pool, sql);
  });

  ipcMain.handle('schema:drop-table', async (_, connectionId, database, table) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.dropTable(pool, database, table);
  });

  ipcMain.handle('schema:drop-database', async (_, connectionId, name) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.dropDatabase(pool, name);
  });

  ipcMain.handle('schema:create-database', async (_, connectionId, name, charset, collation) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.createDatabase(pool, name, charset, collation);
  });

  // Query
  ipcMain.handle('query:use-database', async (_, connectionId, database) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    await pool.query(`USE \`${database}\``);
  });

  ipcMain.handle('query:execute', async (_, connectionId, sql) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return queryExecutor.execute(pool, sql);
  });

  ipcMain.handle('query:paginate', async (_, connectionId, database, table, opts) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return queryExecutor.paginate(pool, database, table, opts);
  });

  ipcMain.handle('query:update', async (_, connectionId, database, table, column, value, pkColumn, pkValue) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return queryExecutor.updateCell(pool, database, table, column, value, pkColumn, pkValue);
  });

  ipcMain.handle('query:bulk-update', async (_, connectionId, database, table, pkColumn, changes) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return queryExecutor.bulkUpdate(pool, database, table, pkColumn, changes);
  });

  ipcMain.handle('query:insert-rows', async (_, connectionId, database, table, rows) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return queryExecutor.insertRows(pool, database, table, rows);
  });

  ipcMain.handle('query:delete-row', async (_, connectionId, database, table, pkColumn, pkValue) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return queryExecutor.deleteRow(pool, database, table, pkColumn, pkValue);
  });

  // File
  ipcMain.handle('file:sql-load', (_, connectionId) => fileManager.loadSqlFile(connectionId));
  ipcMain.handle('file:sql-save', (_, connectionId, content) => fileManager.saveSqlFile(connectionId, content));

  // Schema cache
  ipcMain.handle('schema:cache-load', () => fileManager.loadSchemaCache());
  ipcMain.handle('schema:cache-save', (_, cache) => fileManager.saveSchemaCache(cache));

  // Import
  ipcMain.handle('import:datagrip', () => importDataGripConnections());

  // UI State
  ipcMain.handle('ui:load-state', () => fileManager.loadUiState());
  ipcMain.handle('ui:save-state', (_, state) => fileManager.saveUiState(state));
}
