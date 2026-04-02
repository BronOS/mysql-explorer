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
