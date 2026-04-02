import fs from 'fs';
import path from 'path';
import { ConnectionConfig } from '../shared/types';

export class FileManager {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
    if (!fs.existsSync(basePath)) {
      fs.mkdirSync(basePath, { recursive: true });
    }
  }

  private get connectionsPath(): string {
    return path.join(this.basePath, 'connections.json');
  }

  private sqlFilePath(connectionId: string): string {
    return path.join(this.basePath, `${connectionId}.sql`);
  }

  loadConnections(): ConnectionConfig[] {
    if (!fs.existsSync(this.connectionsPath)) return [];
    const data = fs.readFileSync(this.connectionsPath, 'utf-8');
    return JSON.parse(data);
  }

  saveConnections(connections: ConnectionConfig[]): void {
    fs.writeFileSync(this.connectionsPath, JSON.stringify(connections, null, 2));
  }

  loadSqlFile(connectionId: string): string {
    const filePath = this.sqlFilePath(connectionId);
    if (!fs.existsSync(filePath)) return '';
    return fs.readFileSync(filePath, 'utf-8');
  }

  saveSqlFile(connectionId: string, content: string): void {
    fs.writeFileSync(this.sqlFilePath(connectionId), content);
  }

  private get schemaCachePath(): string {
    return path.join(this.basePath, 'schema-cache.json');
  }

  loadSchemaCache(): Record<string, any> {
    if (!fs.existsSync(this.schemaCachePath)) return {};
    try {
      return JSON.parse(fs.readFileSync(this.schemaCachePath, 'utf-8'));
    } catch {
      return {};
    }
  }

  saveSchemaCache(cache: Record<string, any>): void {
    fs.writeFileSync(this.schemaCachePath, JSON.stringify(cache));
  }
}
