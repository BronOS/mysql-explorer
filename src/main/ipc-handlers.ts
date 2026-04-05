import { ipcMain, dialog, BrowserWindow } from 'electron';
import fs from 'fs';
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

  // Schema objects (views, procedures, functions, triggers, events)
  ipcMain.handle('schema:views', async (_, connectionId, database) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.listViews(pool, database);
  });
  ipcMain.handle('schema:create-view', async (_, connectionId, database, view) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.createViewDDL(pool, database, view);
  });
  ipcMain.handle('schema:procedures', async (_, connectionId, database) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.listProcedures(pool, database);
  });
  ipcMain.handle('schema:create-procedure', async (_, connectionId, database, name) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.createProcedureDDL(pool, database, name);
  });
  ipcMain.handle('schema:functions', async (_, connectionId, database) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.listFunctions(pool, database);
  });
  ipcMain.handle('schema:create-function', async (_, connectionId, database, name) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.createFunctionDDL(pool, database, name);
  });
  ipcMain.handle('schema:triggers', async (_, connectionId, database) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.listTriggers(pool, database);
  });
  ipcMain.handle('schema:create-trigger', async (_, connectionId, database, name) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.createTriggerDDL(pool, database, name);
  });
  ipcMain.handle('schema:events', async (_, connectionId, database) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.listEvents(pool, database);
  });
  ipcMain.handle('schema:create-event', async (_, connectionId, database, name) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return schemaBrowser.createEventDDL(pool, database, name);
  });

  ipcMain.handle('schema:execute-ddl', async (_, connectionId, sql) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    await pool.query(sql);
  });

  ipcMain.handle('schema:drop-object', async (_, connectionId, database, objectType, name) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    await pool.query(`DROP ${objectType} \`${database}\`.\`${name}\``);
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

  // Export
  ipcMain.handle('export:pick-folder', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Select Export Folder',
      properties: ['openDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('export:pick-save-file', async (_, defaultName: string, ext: string) => {
    const win = BrowserWindow.getFocusedWindow();
    const filters: Record<string, { name: string; extensions: string[] }> = {
      sql: { name: 'SQL Files', extensions: ['sql'] },
      csv: { name: 'CSV Files', extensions: ['csv'] },
      json: { name: 'JSON Files', extensions: ['json'] },
      md: { name: 'Markdown Files', extensions: ['md'] },
      tsv: { name: 'TSV Files', extensions: ['tsv'] },
      html: { name: 'HTML Files', extensions: ['html'] },
    };
    const result = await dialog.showSaveDialog(win!, {
      title: 'Export',
      defaultPath: defaultName,
      filters: [filters[ext] || { name: 'All Files', extensions: ['*'] }],
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  ipcMain.handle('export:write-file', async (_, filePath: string, content: string) => {
    fs.writeFileSync(filePath, content, 'utf-8');
  });

  ipcMain.handle('export:fetch-all-rows', async (_, connectionId: string, database: string, table: string, columns?: string[]) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    const colExpr = columns && columns.length > 0 ? columns.map(c => '`' + c + '`').join(', ') : '*';
    const sql = 'SELECT ' + colExpr + ' FROM `' + database + '`.`' + table + '`';
    const [rows] = await pool.query(sql);
    return rows;
  });

  // Import SQL file
  ipcMain.handle('import:pick-sql-file', async () => {
    const win = BrowserWindow.getFocusedWindow();
    const result = await dialog.showOpenDialog(win!, {
      title: 'Import SQL File',
      filters: [{ name: 'SQL Files', extensions: ['sql'] }],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const stat = fs.statSync(filePath);
    return { filePath, fileName: filePath.split('/').pop()!, size: stat.size };
  });

  ipcMain.handle('import:execute-sql-file', async (event, connectionId, filePath, database) => {
    const pool = await connectionManager.ensureConnected(connectionId);
    return queryExecutor.importSqlFile(pool, filePath, database, (progress) => {
      event.sender.send('import:progress', progress);
    });
  });

  // Snippets
  ipcMain.handle('snippets:load', () => fileManager.loadSnippets());
  ipcMain.handle('snippets:save', (_, snippets) => fileManager.saveSnippets(snippets));

  // Import
  ipcMain.handle('import:datagrip', () => importDataGripConnections());

  // UI State
  ipcMain.handle('ui:load-state', () => fileManager.loadUiState());
  ipcMain.handle('ui:save-state', (_, state) => fileManager.saveUiState(state));
}
