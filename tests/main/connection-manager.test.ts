import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConnectionManager } from '../../src/main/connection-manager';
import { FileManager } from '../../src/main/file-manager';

describe('ConnectionManager', () => {
  let tmpDir: string;
  let fm: FileManager;
  let cm: ConnectionManager;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-test-'));
    fm = new FileManager(tmpDir);
    cm = new ConnectionManager(fm);
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('config CRUD', () => {
    it('lists empty connections initially', () => {
      expect(cm.listConnections()).toEqual([]);
    });

    it('creates a connection with generated id', () => {
      const config = { name: 'Test', color: '#ff0000', host: 'localhost', port: 3306, user: 'root', password: '', sshEnabled: false };
      const created = cm.createConnection(config as any);
      expect(created.id).toBeDefined();
      expect(created.name).toBe('Test');
      expect(cm.listConnections()).toHaveLength(1);
    });

    it('updates an existing connection', () => {
      const created = cm.createConnection({ name: 'Old', color: '#ff0000', host: 'localhost', port: 3306, user: 'root', password: '', sshEnabled: false } as any);
      const updated = cm.updateConnection(created.id, { name: 'New' } as any);
      expect(updated.name).toBe('New');
      expect(updated.host).toBe('localhost');
    });

    it('deletes a connection', () => {
      const created = cm.createConnection({ name: 'Del', color: '#ff0000', host: 'localhost', port: 3306, user: 'root', password: '', sshEnabled: false } as any);
      cm.deleteConnection(created.id);
      expect(cm.listConnections()).toHaveLength(0);
    });
  });
});
