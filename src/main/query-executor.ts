import { Pool } from 'mysql2/promise';
import fs from 'fs';
import readline from 'readline';
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

  async deleteRow(
    pool: Pool,
    database: string,
    table: string,
    pkColumn: string,
    pkValue: unknown,
  ): Promise<{ affectedRows: number }> {
    const sql = `DELETE FROM \`${database}\`.\`${table}\` WHERE \`${pkColumn}\` = ? LIMIT 1`;
    const [result] = await pool.query(sql, [pkValue]);
    return { affectedRows: (result as any).affectedRows };
  }

  async importSqlFile(
    pool: Pool,
    filePath: string,
    database: string | undefined,
    onProgress: (progress: { executed: number; errors: number; currentStatement: string }) => void,
  ): Promise<{ executed: number; errors: number; errorMessages: string[] }> {
    const conn = await pool.getConnection();
    if (database) {
      await conn.query(`USE \`${database}\``);
    }

    let executed = 0;
    let errors = 0;
    const errorMessages: string[] = [];
    let buffer = '';
    let inString: string | null = null;
    let escaped = false;

    const stream = fs.createReadStream(filePath, { encoding: 'utf-8' });
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    const executeStatement = async (sql: string) => {
      const trimmed = sql.trim();
      if (!trimmed) return;
      try {
        await conn.query(trimmed);
        executed++;
      } catch (err: any) {
        errors++;
        if (errorMessages.length < 50) {
          errorMessages.push(`${err.message}\n  SQL: ${trimmed.slice(0, 200)}`);
        }
      }
      if ((executed + errors) % 100 === 0) {
        onProgress({ executed, errors, currentStatement: trimmed.slice(0, 100) });
      }
    };

    for await (const line of rl) {
      // Skip comment-only lines and empty lines
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('--') || trimmedLine.startsWith('#') || trimmedLine === '') {
        continue;
      }

      // Parse character by character to handle strings and semicolons correctly
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (escaped) {
          buffer += ch;
          escaped = false;
          continue;
        }
        if (ch === '\\') {
          buffer += ch;
          escaped = true;
          continue;
        }
        if (inString) {
          buffer += ch;
          if (ch === inString) inString = null;
          continue;
        }
        if (ch === '\'' || ch === '"' || ch === '`') {
          buffer += ch;
          inString = ch;
          continue;
        }
        if (ch === '-' && line[i + 1] === '-') {
          // Inline comment — skip rest of line
          break;
        }
        if (ch === ';') {
          await executeStatement(buffer);
          buffer = '';
          continue;
        }
        buffer += ch;
      }
      buffer += '\n';
    }

    // Execute any remaining statement without trailing semicolon
    if (buffer.trim()) {
      await executeStatement(buffer);
    }

    conn.release();
    onProgress({ executed, errors, currentStatement: '' });
    return { executed, errors, errorMessages };
  }

  async insertRows(
    pool: Pool,
    database: string,
    table: string,
    rows: Record<string, unknown>[],
  ): Promise<{ affectedRows: number }> {
    if (rows.length === 0) return { affectedRows: 0 };
    const conn = await pool.getConnection();
    let totalAffected = 0;
    try {
      await conn.beginTransaction();
      for (const row of rows) {
        const cols = Object.keys(row).filter(k => row[k] !== undefined);
        const vals = cols.map(k => row[k]);
        const sql = `INSERT INTO \`${database}\`.\`${table}\` (${cols.map(c => `\`${c}\``).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`;
        const [result] = await conn.query(sql, vals);
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
