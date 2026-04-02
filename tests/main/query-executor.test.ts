import { describe, it, expect, vi } from 'vitest';
import { QueryExecutor } from '../../src/main/query-executor';

const mockPool = { query: vi.fn(), getConnection: vi.fn() };

describe('QueryExecutor', () => {
  const qe = new QueryExecutor();

  describe('execute', () => {
    it('detects SELECT and returns rows result', async () => {
      mockPool.query.mockResolvedValueOnce([[{ id: 1, name: 'John' }], [{ name: 'id' }, { name: 'name' }]]);
      const result = await qe.execute(mockPool as any, 'SELECT * FROM users');
      expect(result.type).toBe('rows');
      expect(result.rows).toEqual([{ id: 1, name: 'John' }]);
    });

    it('detects SHOW and returns rows result', async () => {
      mockPool.query.mockResolvedValueOnce([[{ Database: 'test' }], [{ name: 'Database' }]]);
      const result = await qe.execute(mockPool as any, '  SHOW DATABASES');
      expect(result.type).toBe('rows');
    });

    it('detects UPDATE and returns affected result', async () => {
      mockPool.query.mockResolvedValueOnce([{ affectedRows: 5 }]);
      const result = await qe.execute(mockPool as any, 'UPDATE users SET status = "active"');
      expect(result.type).toBe('affected');
      expect(result.affectedRows).toBe(5);
    });

    it('returns error on SQL failure', async () => {
      mockPool.query.mockRejectedValueOnce(new Error('Unknown column'));
      const result = await qe.execute(mockPool as any, 'SELECT bad FROM nope');
      expect(result.error).toBe('Unknown column');
    });
  });

  describe('paginate', () => {
    it('builds correct query with filters and pagination', async () => {
      mockPool.query
        .mockResolvedValueOnce([[{ 'COUNT(*)': 2500 }]])
        .mockResolvedValueOnce([[{ id: 1 }, { id: 2 }], []]);
      const result = await qe.paginate(mockPool as any, 'app_db', 'users', {
        page: 2,
        pageSize: 1000,
        where: "status = 'active'",
      });
      expect(result.page).toBe(2);
      expect(result.totalCount).toBe(2500);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining('LIMIT 1000 OFFSET 1000'),
      );
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE status = 'active'"),
      );
    });
  });

  describe('updateCell', () => {
    it('generates UPDATE with parameterized values', async () => {
      mockPool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
      const result = await qe.updateCell(mockPool as any, 'app_db', 'users', 'name', 'John', 'id', 1);
      expect(result.affectedRows).toBe(1);
      expect(mockPool.query).toHaveBeenCalledWith(
        'UPDATE `app_db`.`users` SET `name` = ? WHERE `id` = ?',
        ['John', 1],
      );
    });
  });
});
