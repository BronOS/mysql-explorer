import { randomUUID } from 'crypto';
import mysql, { Pool } from 'mysql2/promise';
import { Client as SSHClient } from 'ssh2';
import net from 'net';
import fs from 'fs';
import { ConnectionConfig } from '../shared/types';
import { FileManager } from './file-manager';

interface ActiveConnection {
  pool: Pool;
  sshClient?: SSHClient;
  sshServer?: net.Server;
}

export class ConnectionManager {
  private fileManager: FileManager;
  private active: Map<string, ActiveConnection> = new Map();

  constructor(fileManager: FileManager) {
    this.fileManager = fileManager;
  }

  listConnections(): ConnectionConfig[] {
    return this.fileManager.loadConnections();
  }

  createConnection(config: Omit<ConnectionConfig, 'id'>): ConnectionConfig {
    const connections = this.fileManager.loadConnections();
    const newConn: ConnectionConfig = { ...config, id: randomUUID() };
    connections.push(newConn);
    this.fileManager.saveConnections(connections);
    return newConn;
  }

  updateConnection(id: string, updates: Partial<ConnectionConfig>): ConnectionConfig {
    const connections = this.fileManager.loadConnections();
    const idx = connections.findIndex(c => c.id === id);
    if (idx === -1) throw new Error(`Connection ${id} not found`);
    connections[idx] = { ...connections[idx], ...updates, id };
    this.fileManager.saveConnections(connections);
    return connections[idx];
  }

  deleteConnection(id: string): void {
    const connections = this.fileManager.loadConnections();
    this.fileManager.saveConnections(connections.filter(c => c.id !== id));
    this.disconnect(id);
  }

  async connect(config: ConnectionConfig): Promise<void> {
    if (this.active.has(config.id)) return;

    let mysqlHost = config.host;
    let mysqlPort = config.port;
    let sshClient: SSHClient | undefined;
    let sshServer: net.Server | undefined;

    if (config.sshEnabled) {
      const tunnel = await this.createSshTunnel(config);
      sshClient = tunnel.client;
      sshServer = tunnel.server;
      mysqlHost = '127.0.0.1';
      mysqlPort = tunnel.localPort;
    }

    const pool = mysql.createPool({
      host: mysqlHost,
      port: mysqlPort,
      user: config.user,
      password: config.password,
      database: config.defaultDatabase || undefined,
      connectionLimit: 5,
      waitForConnections: true,
      connectTimeout: 10000,
      multipleStatements: true,
    });

    // Verify the connection works
    const conn = await pool.getConnection();
    conn.release();

    this.active.set(config.id, { pool, sshClient, sshServer });
  }

  async disconnect(id: string): Promise<void> {
    const active = this.active.get(id);
    if (!active) return;
    await active.pool.end();
    active.sshServer?.close();
    active.sshClient?.end();
    this.active.delete(id);
  }

  getPool(connectionId: string): Pool {
    const active = this.active.get(connectionId);
    if (!active) throw new Error(`Connection ${connectionId} is not active`);
    return active.pool;
  }

  async ensureConnected(connectionId: string): Promise<Pool> {
    const active = this.active.get(connectionId);
    if (active) {
      // Test if connection is still alive
      try {
        const conn = await active.pool.getConnection();
        conn.release();
        return active.pool;
      } catch {
        // Connection is dead, clean up and reconnect
        try { await active.pool.end(); } catch {}
        active.sshServer?.close();
        active.sshClient?.end();
        this.active.delete(connectionId);
      }
    }

    // Reconnect
    const config = this.fileManager.loadConnections().find(c => c.id === connectionId);
    if (!config) throw new Error(`Connection ${connectionId} not found in config`);
    await this.connect(config);
    return this.getPool(connectionId);
  }

  isConnected(connectionId: string): boolean {
    return this.active.has(connectionId);
  }

  async testConnection(config: ConnectionConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const tempId = randomUUID();
      const tempConfig = { ...config, id: tempId };
      await this.connect(tempConfig);
      await this.disconnect(tempId);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  async disconnectAll(): Promise<void> {
    for (const id of this.active.keys()) {
      await this.disconnect(id);
    }
  }

  private createSshTunnel(config: ConnectionConfig): Promise<{ client: SSHClient; server: net.Server; localPort: number }> {
    return new Promise((resolve, reject) => {
      const client = new SSHClient();
      let settled = false;

      const timeout = setTimeout(() => {
        if (!settled) {
          settled = true;
          client.end();
          reject(new Error('SSH connection timed out after 10 seconds'));
        }
      }, 10000);

      const fail = (err: Error) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          client.end();
          reject(err);
        }
      };

      const sshConfig: any = {
        host: config.sshHost,
        port: config.sshPort || 22,
        username: config.sshUser,
        readyTimeout: 10000,
        keepaliveInterval: 30000,
        keepaliveCountMax: 3,
      };

      if (config.sshAuthType === 'key') {
        try {
          sshConfig.privateKey = fs.readFileSync(config.sshKeyPath!);
        } catch (err: any) {
          clearTimeout(timeout);
          reject(new Error(`Cannot read SSH key file: ${err.message}`));
          return;
        }
        if (config.sshPassphrase) sshConfig.passphrase = config.sshPassphrase;
      } else {
        sshConfig.password = config.sshPassword;
      }

      client.on('ready', () => {
        clearTimeout(timeout);
        const server = net.createServer((sock) => {
          client.forwardOut(
            sock.remoteAddress || '127.0.0.1',
            sock.remotePort || 0,
            config.host,
            config.port,
            (err, stream) => {
              if (err) { sock.end(); return; }
              sock.pipe(stream).pipe(sock);
            }
          );
        });

        server.listen(0, '127.0.0.1', () => {
          if (!settled) {
            settled = true;
            const localPort = (server.address() as net.AddressInfo).port;
            resolve({ client, server, localPort });
          }
        });
      });

      client.on('error', fail);
      client.connect(sshConfig);
    });
  }
}
