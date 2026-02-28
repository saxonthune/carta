import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

export interface ServerDiscoveryInfo {
  url: string;
  wsUrl: string;
  pid: number;
}

/**
 * Platform-specific default path for server.json.
 *   macOS:   ~/Library/Application Support/@carta/server.json
 *   Linux:   ~/.config/@carta/server.json
 *   Windows: %APPDATA%/@carta/server.json
 */
export function getDefaultDiscoveryPath(): string {
  const platform = os.platform();
  let configDir: string;
  if (platform === 'darwin') {
    configDir = path.join(os.homedir(), 'Library', 'Application Support', '@carta');
  } else if (platform === 'win32') {
    configDir = path.join(
      process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'),
      '@carta',
    );
  } else {
    configDir = path.join(os.homedir(), '.config', '@carta');
  }
  return path.join(configDir, 'server.json');
}

/** Write server.json atomically. Creates parent directory if needed. */
export function writeServerDiscovery(filePath: string, info: ServerDiscoveryInfo): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(info, null, 2));
}

/**
 * Read server.json and verify the process is still running.
 * Returns null if the file is missing, malformed, or the PID is stale.
 */
export function readServerDiscovery(filePath: string): ServerDiscoveryInfo | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    if (!data.url || !data.pid) return null;
    // Verify the server process is alive
    try {
      process.kill(data.pid, 0);
    } catch {
      return null; // stale — process not running
    }
    return { url: data.url, wsUrl: data.wsUrl, pid: data.pid };
  } catch {
    return null;
  }
}

/** Remove server.json. No-op if it doesn't exist. */
export function cleanupServerDiscovery(filePath: string): void {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}
