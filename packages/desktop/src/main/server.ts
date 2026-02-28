/**
 * Desktop Server — thin wrapper around the embedded host.
 *
 * Picks a project directory, starts the embedded host (workspace server +
 * server.json discovery), and manages lifecycle. All document server logic
 * lives in @carta/server.
 */

import * as path from 'node:path';
import createDebug from 'debug';
import { startEmbeddedHost } from '@carta/server/embedded-host';
import type { EmbeddedHost } from '@carta/server/embedded-host';
import type { WorkspaceServerInfo } from '@carta/server/embedded-host';
import { scaffoldWorkspace } from '@carta/server/init';
import type { ScaffoldResult } from '@carta/server/init';

export type { WorkspaceServerInfo };

const log = createDebug('carta:desktop-server');

let host: EmbeddedHost | null = null;

/**
 * Start the workspace server for a project directory.
 * Writes server.json to userData for MCP discovery.
 */
export async function startDesktopServer(
  userDataPath: string,
  workspacePath: string,
): Promise<WorkspaceServerInfo> {
  const cartaDir = path.join(workspacePath, '.carta');
  // Use Electron's userData path for backwards compat with existing MCP configs
  const discoveryPath = path.join(userDataPath, 'server.json');

  host = await startEmbeddedHost({ cartaDir, discoveryPath });
  log('Running at %s, cartaDir: %s', host.info.url, cartaDir);
  return host.info;
}

/**
 * Stop the workspace server and clean up server.json.
 */
export async function stopDesktopServer(): Promise<void> {
  if (host) {
    await host.stop();
    host = null;
  }
  log('Stopped');
}

/**
 * Scaffold a .carta/ workspace inside projectDir.
 * Idempotent — safe to call on an existing workspace.
 */
export function initializeWorkspace(projectDir: string, title: string): ScaffoldResult {
  return scaffoldWorkspace({ projectDir, title });
}

/**
 * Get the path where the MCP binary expects to find server.json.
 */
export function getServerInfoPath(userDataPath: string): string {
  return path.join(userDataPath, 'server.json');
}
