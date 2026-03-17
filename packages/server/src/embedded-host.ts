import {
  startWorkspaceServer,
  stopWorkspaceServer,
} from './workspace-server.js';
import type { WorkspaceServerInfo } from './workspace-server.js';
import {
  getDefaultDiscoveryPath,
  writeServerDiscovery,
  cleanupServerDiscovery,
} from './server-discovery.js';

export type { WorkspaceServerInfo };

export interface EmbeddedHostOptions {
  /** Absolute path to .carta/ directory */
  cartaDir: string;
  /** Path to write server.json. Defaults to getDefaultDiscoveryPath() */
  discoveryPath?: string;
  /** Port override (default: 51234, auto-increments in workspace-server) */
  port?: number;
  /** Host override (default: 127.0.0.1) */
  host?: string;
  /** Path to built web-client dist/ for static serving */
  clientDir?: string;
}

export interface EmbeddedHost {
  /** Server info (url, wsUrl, port) */
  info: WorkspaceServerInfo;
  /** Path where server.json was written */
  discoveryPath: string;
  /** Stop server, flush docs, cleanup server.json */
  stop(): Promise<void>;
}

/**
 * Start workspace server + write server.json. One call does everything a host needs.
 */
export async function startEmbeddedHost(options: EmbeddedHostOptions): Promise<EmbeddedHost> {
  const discoveryPath = options.discoveryPath ?? getDefaultDiscoveryPath();

  const info = await startWorkspaceServer({
    cartaDir: options.cartaDir,
    port: options.port,
    host: options.host,
    clientDir: options.clientDir,
  });

  writeServerDiscovery(discoveryPath, {
    url: info.url,
    wsUrl: info.wsUrl,
    pid: process.pid,
  });

  return {
    info,
    discoveryPath,
    async stop() {
      await stopWorkspaceServer();
      cleanupServerDiscovery(discoveryPath);
    },
  };
}
