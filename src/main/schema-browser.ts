import { Pool } from 'mysql2/promise';
import { ColumnMeta, FullColumnInfo, IndexInfo } from '../shared/types';

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
}
