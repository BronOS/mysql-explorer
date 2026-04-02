import { describe, it, expect, vi } from 'vitest';
import { SchemaBrowser } from '../../src/main/schema-browser';

const mockPool = {
  query: vi.fn(),
};

describe('SchemaBrowser', () => {
  const sb = new SchemaBrowser();

  it('parses database list from SHOW DATABASES', async () => {
    mockPool.query.mockResolvedValueOnce([[
      { Database: 'app_db' },
      { Database: 'analytics_db' },
      { Database: 'information_schema' },
    ]]);
    const dbs = await sb.listDatabases(mockPool as any);
    expect(dbs).toEqual(['app_db', 'analytics_db', 'information_schema']);
    expect(mockPool.query).toHaveBeenCalledWith('SHOW DATABASES');
  });

  it('parses table list from SHOW TABLES', async () => {
    mockPool.query.mockResolvedValueOnce([[
      { Tables_in_app_db: 'users' },
      { Tables_in_app_db: 'orders' },
    ]]);
    const tables = await sb.listTables(mockPool as any, 'app_db');
    expect(tables).toEqual(['users', 'orders']);
  });

  it('parses column metadata from DESCRIBE with enum values', async () => {
    mockPool.query.mockResolvedValueOnce([[
      { Field: 'id', Type: 'int', Null: 'NO', Key: 'PRI', Default: null, Extra: 'auto_increment' },
      { Field: 'status', Type: "enum('active','inactive','pending')", Null: 'NO', Key: '', Default: 'active', Extra: '' },
      { Field: 'bio', Type: 'text', Null: 'YES', Key: '', Default: null, Extra: '' },
    ]]);
    const cols = await sb.describeTable(mockPool as any, 'app_db', 'users');
    expect(cols).toHaveLength(3);
    expect(cols[0]).toEqual({ name: 'id', type: 'int', nullable: false, key: 'PRI', defaultValue: null, extra: 'auto_increment', enumValues: undefined });
    expect(cols[1].enumValues).toEqual(['active', 'inactive', 'pending']);
    expect(cols[2].nullable).toBe(true);
  });
});
