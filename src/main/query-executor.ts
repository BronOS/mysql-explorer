import { Pool } from 'mysql2/promise';
import { QueryResult, TableData } from '../shared/types';

const SELECT_PATTERN = /^\s*(SELECT|SHOW|DESCRIBE|EXPLAIN)\b/i;

export class QueryExecutor {
  async execute(pool: Pool, sql: string): Promise<QueryResult> {
    const start = Date.now();
    try {
      const isSelect = SELECT_PATTERN.test(sql);
      const [result] = await pool.query(sql);
      const executionTimeMs = Date.now() - start;

      if (isSelect) {
        return {
          type: 'rows',
          rows: result as Record<string, unknown>[],
          totalCount: (result as any[]).length,
          executionTimeMs,
        };
      } else {
        return {
          type: 'affected',
          affectedRows: (result as any).affectedRows,
          executionTimeMs,
        };
      }
    } catch (err: any) {
      return {
        type: 'affected',
        executionTimeMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  async paginate(
    pool: Pool,
    database: string,
    table: string,
    opts: { page: number; pageSize: number; where?: string; orderBy?: string },
  ): Promise<TableData> {
    const whereClause = opts.where ? `WHERE ${opts.where}` : '';
    const orderClause = opts.orderBy ? `ORDER BY ${opts.orderBy}` : '';
    const offset = (opts.page - 1) * opts.pageSize;

    const countSql = `SELECT COUNT(*) FROM \`${database}\`.\`${table}\` ${whereClause}`;
    const [[countRow]] = await pool.query(countSql) as any;
    const totalCount = countRow['COUNT(*)'];

    const dataSql = `SELECT * FROM \`${database}\`.\`${table}\` ${whereClause} ${orderClause} LIMIT ${opts.pageSize} OFFSET ${offset}`;
    const [rows] = await pool.query(dataSql);

    return {
      columns: [],
      rows: rows as Record<string, unknown>[],
      totalCount,
      page: opts.page,
      pageSize: opts.pageSize,
      primaryKey: null,
    };
  }

  async updateCell(
    pool: Pool,
    database: string,
    table: string,
    column: string,
    value: unknown,
    pkColumn: string,
    pkValue: unknown,
  ): Promise<{ affectedRows: number }> {
    const sql = `UPDATE \`${database}\`.\`${table}\` SET \`${column}\` = ? WHERE \`${pkColumn}\` = ?`;
    const [result] = await pool.query(sql, [value, pkValue]);
    return { affectedRows: (result as any).affectedRows };
  }

  async bulkUpdate(
    pool: Pool,
    database: string,
    table: string,
    pkColumn: string,
    changes: { pkValue: unknown; column: string; value: unknown }[],
  ): Promise<{ affectedRows: number }> {
    const conn = await pool.getConnection();
    let totalAffected = 0;
    try {
      await conn.beginTransaction();
      for (const change of changes) {
        const sql = `UPDATE \`${database}\`.\`${table}\` SET \`${change.column}\` = ? WHERE \`${pkColumn}\` = ?`;
        const [result] = await conn.query(sql, [change.value, change.pkValue]);
        totalAffected += (result as any).affectedRows;
      }
      await conn.commit();
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
    return { affectedRows: totalAffected };
  }
}
