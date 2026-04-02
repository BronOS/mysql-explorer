import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { FileManager } from '../../src/main/file-manager';

describe('FileManager', () => {
  let tmpDir: string;
  let fm: FileManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fm-test-'));
    fm = new FileManager(tmpDir);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('connections config', () => {
    it('returns empty array when no config file exists', () => {
      expect(fm.loadConnections()).toEqual([]);
    });

    it('saves and loads connections', () => {
      const conns = [{ id: '1', name: 'Test', color: '#ff0000', host: 'localhost', port: 3306, user: 'root', password: '', sshEnabled: false }];
      fm.saveConnections(conns as any);
      expect(fm.loadConnections()).toEqual(conns);
    });
  });

  describe('SQL file persistence', () => {
    it('returns empty string when no SQL file exists', () => {
      expect(fm.loadSqlFile('conn-1')).toBe('');
    });

    it('saves and loads SQL content', () => {
      fm.saveSqlFile('conn-1', 'SELECT * FROM users;');
      expect(fm.loadSqlFile('conn-1')).toBe('SELECT * FROM users;');
    });

    it('handles multiple connections independently', () => {
      fm.saveSqlFile('conn-1', 'SELECT 1');
      fm.saveSqlFile('conn-2', 'SELECT 2');
      expect(fm.loadSqlFile('conn-1')).toBe('SELECT 1');
      expect(fm.loadSqlFile('conn-2')).toBe('SELECT 2');
    });
  });
});
