import fs from 'fs';
import path from 'path';
import os from 'os';
import { ConnectionConfig } from '../shared/types';

interface DataGripDataSource {
  name: string;
  uuid: string;
  jdbcUrl: string;
  userName?: string;
  sshConfigId?: string;
  sshEnabled?: boolean;
}

interface DataGripSshConfig {
  id: string;
  host: string;
  port: string;
  username: string;
  authType?: string;
  keyPath?: string;
}

const COLORS = ['#00d2ff', '#4ade80', '#f59e0b', '#ef4444', '#a855f7', '#ec4899', '#06b6d4', '#84cc16'];

/**
 * Find all DataGrip dataSources.xml files across projects
 */
function findDataSourceFiles(): string[] {
  const home = os.homedir();
  const projectDirs = [
    path.join(home, 'Projects'),
    path.join(home, 'IdeaProjects'),
    path.join(home, 'Documents'),
  ];

  const results: string[] = [];

  function scanDir(dir: string, depth: number) {
    if (depth > 4) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '.idea') {
            const dsFile = path.join(fullPath, 'dataSources.xml');
            if (fs.existsSync(dsFile)) results.push(dsFile);
          } else {
            scanDir(fullPath, depth + 1);
          }
        }
      }
    } catch {}
  }

  for (const dir of projectDirs) {
    if (fs.existsSync(dir)) scanDir(dir, 0);
  }

  return results;
}

/**
 * Find the DataGrip SSH configs file
 */
function findSshConfigsFile(): string | null {
  const home = os.homedir();
  const jetbrainsDir = path.join(home, 'Library', 'Application Support', 'JetBrains');
  if (!fs.existsSync(jetbrainsDir)) return null;

  try {
    const dirs = fs.readdirSync(jetbrainsDir)
      .filter(d => d.startsWith('DataGrip'))
      .sort()
      .reverse(); // newest first

    for (const dir of dirs) {
      const sshFile = path.join(jetbrainsDir, dir, 'options', 'sshConfigs.xml');
      if (fs.existsSync(sshFile)) return sshFile;
    }
  } catch {}
  return null;
}

/**
 * Simple XML attribute parser (no dependency needed)
 */
function parseAttr(tag: string, attr: string): string {
  const match = tag.match(new RegExp(`${attr}="([^"]*)"`, 'i'));
  return match ? match[1] : '';
}

function parseTag(xml: string, tagContent: string): string {
  const match = xml.match(new RegExp(`<${tagContent}[^>]*>([^<]*)</${tagContent.split(/\s/)[0]}>`, 'i'));
  return match ? match[1].trim() : '';
}

/**
 * Parse SSH configs from sshConfigs.xml
 */
function parseSshConfigs(filePath: string): Map<string, DataGripSshConfig> {
  const map = new Map<string, DataGripSshConfig>();
  const xml = fs.readFileSync(filePath, 'utf-8');

  const sshRegex = /<sshConfig\s[^>]+\/?>[\s\S]*?(?:\/>|<\/sshConfig>)/gi;
  let match;
  while ((match = sshRegex.exec(xml)) !== null) {
    const tag = match[0];
    const id = parseAttr(tag, 'id');
    if (!id) continue;
    map.set(id, {
      id,
      host: parseAttr(tag, 'host'),
      port: parseAttr(tag, 'port') || '22',
      username: parseAttr(tag, 'username'),
      authType: parseAttr(tag, 'authType') || 'KEY_PAIR',
      keyPath: parseAttr(tag, 'keyPath').replace('$USER_HOME$', os.homedir()),
    });
  }
  return map;
}

/**
 * Parse data sources from dataSources.xml + dataSources.local.xml
 */
function parseDataSources(dsFile: string): DataGripDataSource[] {
  const sources: DataGripDataSource[] = [];
  const xml = fs.readFileSync(dsFile, 'utf-8');

  // Parse main dataSources.xml for names and JDBC URLs
  const dsRegex = /<data-source\s[^>]*>[\s\S]*?<\/data-source>/gi;
  let match;
  while ((match = dsRegex.exec(xml)) !== null) {
    const block = match[0];
    const name = parseAttr(block, 'name');
    const uuid = parseAttr(block, 'uuid');
    const driverRef = parseTag(block, 'driver-ref');

    // Only import MySQL/MariaDB connections
    if (!driverRef.match(/mysql|mariadb/i)) continue;

    const jdbcUrl = parseTag(block, 'jdbc-url');
    sources.push({ name, uuid, jdbcUrl });
  }

  // Try to find dataSources.local.xml for usernames and SSH config refs
  const localFile = dsFile.replace('dataSources.xml', 'dataSources.local.xml');
  if (fs.existsSync(localFile)) {
    const localXml = fs.readFileSync(localFile, 'utf-8');

    let localMatch;
    while ((localMatch = dsRegex.exec(localXml)) !== null) {
      const block = localMatch[0];
      const uuid = parseAttr(block, 'uuid');
      const source = sources.find(s => s.uuid === uuid);
      if (!source) continue;

      // Extract username
      const userMatch = block.match(/<user-name>([^<]*)<\/user-name>/);
      if (userMatch) source.userName = userMatch[1];

      // Extract SSH config
      const sshEnabledMatch = block.match(/<enabled>true<\/enabled>/);
      const sshIdMatch = block.match(/<ssh-config-id>([^<]*)<\/ssh-config-id>/);
      if (sshEnabledMatch && sshIdMatch) {
        source.sshEnabled = true;
        source.sshConfigId = sshIdMatch[1];
      }
    }
  }

  return sources;
}

/**
 * Parse JDBC URL: jdbc:mariadb://host:port/database
 */
function parseJdbcUrl(url: string): { host: string; port: number; database?: string } {
  const match = url.match(/jdbc:(?:mysql|mariadb):\/\/([^:/]+)(?::(\d+))?(?:\/([^?]*))?/);
  if (!match) return { host: 'localhost', port: 3306 };
  return {
    host: match[1] || 'localhost',
    port: parseInt(match[2] || '3306', 10),
    database: match[3] || undefined,
  };
}

/**
 * Import all DataGrip connections
 */
export function importDataGripConnections(): ConnectionConfig[] {
  const sshConfigsFile = findSshConfigsFile();
  const sshConfigs = sshConfigsFile ? parseSshConfigs(sshConfigsFile) : new Map<string, DataGripSshConfig>();

  const dsFiles = findDataSourceFiles();
  const seen = new Set<string>(); // deduplicate by name
  const connections: ConnectionConfig[] = [];

  for (const dsFile of dsFiles) {
    const sources = parseDataSources(dsFile);

    for (const source of sources) {
      if (seen.has(source.name)) continue;
      seen.add(source.name);

      const jdbc = parseJdbcUrl(source.jdbcUrl);
      const sshConfig = source.sshConfigId ? sshConfigs.get(source.sshConfigId) : undefined;

      const conn: ConnectionConfig = {
        id: source.uuid,
        name: source.name,
        color: COLORS[connections.length % COLORS.length],
        host: jdbc.host,
        port: jdbc.port,
        user: source.userName || 'root',
        password: '', // never import passwords
        defaultDatabase: jdbc.database || '',
        sshEnabled: source.sshEnabled || false,
        sshHost: sshConfig?.host || '',
        sshPort: parseInt(sshConfig?.port || '22', 10),
        sshUser: sshConfig?.username || '',
        sshAuthType: sshConfig?.authType === 'PASSWORD' ? 'password' : 'key',
        sshPassword: '', // never import passwords
        sshKeyPath: sshConfig?.keyPath || '',
        sshPassphrase: '',
      };

      connections.push(conn);
    }
  }

  return connections;
}
