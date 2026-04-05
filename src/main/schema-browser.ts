import { Pool } from 'mysql2/promise';
import { ColumnMeta, FullColumnInfo, IndexInfo } from '../shared/types';

export class SchemaBrowser {
  async listDatabases(pool: Pool): Promise<string[]> {
    const [rows] = await pool.query('SHOW DATABASES');
    return (rows as any[]).map(r => r.Database);
  }

  async listTables(pool: Pool, database: string): Promise<string[]> {
    const [rows] = await pool.query(`SHOW FULL TABLES FROM \`${database}\` WHERE Table_type = 'BASE TABLE'`);
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

  async fullColumns(pool: Pool, database: string, table: string): Promise<FullColumnInfo[]> {
    const [rows] = await pool.query(`SHOW FULL COLUMNS FROM \`${database}\`.\`${table}\``);
    return (rows as any[]).map(row => {
      const fullType: string = row.Type;
      const typeMatch = fullType.match(/^(\w+)(?:\(([^)]+)\))?(.*)$/i);
      const baseType = (typeMatch?.[1] || fullType).toUpperCase();
      const length = typeMatch?.[2] || '';
      const flags = (typeMatch?.[3] || '').toLowerCase();
      const collation = row.Collation || '';
      const encoding = collation ? collation.split('_')[0] : '';
      return {
        field: row.Field,
        type: fullType,
        baseType,
        length,
        unsigned: flags.includes('unsigned'),
        zerofill: flags.includes('zerofill'),
        binary: flags.includes('binary'),
        nullable: row.Null === 'YES',
        key: row.Key || '',
        defaultValue: row.Default,
        extra: row.Extra || '',
        encoding,
        collation,
        comment: row.Comment || '',
      };
    });
  }

  async indexes(pool: Pool, database: string, table: string): Promise<IndexInfo[]> {
    const [rows] = await pool.query(`SHOW INDEX FROM \`${database}\`.\`${table}\``);
    const map = new Map<string, IndexInfo>();
    for (const row of rows as any[]) {
      const name = row.Key_name;
      if (!map.has(name)) {
        map.set(name, { name, type: row.Index_type || 'BTREE', columns: [], unique: row.Non_unique === 0 });
      }
      map.get(name)!.columns.push(row.Column_name);
    }
    return Array.from(map.values());
  }

  async createTableDDL(pool: Pool, database: string, table: string): Promise<string> {
    const [rows] = await pool.query(`SHOW CREATE TABLE \`${database}\`.\`${table}\``);
    return (rows as any[])[0]?.['Create Table'] || '';
  }

  async alterTable(pool: Pool, sql: string): Promise<void> {
    await pool.query(sql);
  }

  async dropTable(pool: Pool, database: string, table: string): Promise<void> {
    await pool.query(`DROP TABLE \`${database}\`.\`${table}\``);
  }

  async dropDatabase(pool: Pool, name: string): Promise<void> {
    await pool.query(`DROP DATABASE \`${name}\``);
  }

  async listViews(pool: Pool, database: string): Promise<string[]> {
    const [rows] = await pool.query(
      `SELECT TABLE_NAME FROM information_schema.VIEWS WHERE TABLE_SCHEMA = ?`, [database]
    );
    return (rows as any[]).map(r => r.TABLE_NAME);
  }

  async createViewDDL(pool: Pool, database: string, view: string): Promise<string> {
    const [rows] = await pool.query(`SHOW CREATE VIEW \`${database}\`.\`${view}\``);
    return (rows as any[])[0]?.['Create View'] || '';
  }

  async listProcedures(pool: Pool, database: string): Promise<string[]> {
    const [rows] = await pool.query(
      `SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'PROCEDURE'`, [database]
    );
    return (rows as any[]).map(r => r.ROUTINE_NAME);
  }

  async createProcedureDDL(pool: Pool, database: string, name: string): Promise<string> {
    const [rows] = await pool.query(`SHOW CREATE PROCEDURE \`${database}\`.\`${name}\``);
    return (rows as any[])[0]?.['Create Procedure'] || '';
  }

  async listFunctions(pool: Pool, database: string): Promise<string[]> {
    const [rows] = await pool.query(
      `SELECT ROUTINE_NAME FROM information_schema.ROUTINES WHERE ROUTINE_SCHEMA = ? AND ROUTINE_TYPE = 'FUNCTION'`, [database]
    );
    return (rows as any[]).map(r => r.ROUTINE_NAME);
  }

  async createFunctionDDL(pool: Pool, database: string, name: string): Promise<string> {
    const [rows] = await pool.query(`SHOW CREATE FUNCTION \`${database}\`.\`${name}\``);
    return (rows as any[])[0]?.['Create Function'] || '';
  }

  async listTriggers(pool: Pool, database: string): Promise<string[]> {
    const [rows] = await pool.query(
      `SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = ?`, [database]
    );
    return (rows as any[]).map(r => r.TRIGGER_NAME);
  }

  async createTriggerDDL(pool: Pool, database: string, name: string): Promise<string> {
    const [rows] = await pool.query(`SHOW CREATE TRIGGER \`${database}\`.\`${name}\``);
    return (rows as any[])[0]?.['SQL Original Statement'] || '';
  }

  async listEvents(pool: Pool, database: string): Promise<string[]> {
    const [rows] = await pool.query(
      `SELECT EVENT_NAME FROM information_schema.EVENTS WHERE EVENT_SCHEMA = ?`, [database]
    );
    return (rows as any[]).map(r => r.EVENT_NAME);
  }

  async createEventDDL(pool: Pool, database: string, name: string): Promise<string> {
    const [rows] = await pool.query(`SHOW CREATE EVENT \`${database}\`.\`${name}\``);
    return (rows as any[])[0]?.['Create Event'] || '';
  }

  async createDatabase(pool: Pool, name: string, charset: string, collation: string): Promise<void> {
    let sql = `CREATE DATABASE \`${name}\` DEFAULT CHARACTER SET ${charset}`;
    if (collation) sql += ` COLLATE ${collation}`;
    await pool.query(sql);
  }
}
