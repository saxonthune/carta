/**
 * Desktop Server — thin wrapper around the workspace server.
 *
 * Picks a project directory, calls scaffoldWorkspace() + startWorkspaceServer(),
 * and writes server.json to userData for MCP discovery.
 * All document server logic lives in @carta/server, not here.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import createDebug from 'debug';
import { startWorkspaceServer, stopWorkspaceServer } from '@carta/server/workspace-server';
import type { WorkspaceServerInfo } from '@carta/server/workspace-server';
import { scaffoldWorkspace } from '@carta/server/init';
import type { ScaffoldResult } from '@carta/server/init';

export type { WorkspaceServerInfo };

const log = createDebug('carta:desktop-server');

let serverInfoPath: string | null = null;

/**
 * Start the workspace server for a project directory.
 * Writes server.json to userData for MCP discovery.
 */
export async function startDesktopServer(
  userDataPath: string,
  workspacePath: string,
): Promise<WorkspaceServerInfo> {
  const cartaDir = path.join(workspacePath, '.carta');
  serverInfoPath = path.join(userDataPath, 'server.json');

  const info = await startWorkspaceServer({ cartaDir });

  const serverJson = { url: info.url, wsUrl: info.wsUrl, pid: process.pid };
  fs.writeFileSync(serverInfoPath, JSON.stringify(serverJson, null, 2));

  log('Running at %s, cartaDir: %s', info.url, cartaDir);
  return info;
}

/**
 * Stop the workspace server and clean up server.json.
 */
export async function stopDesktopServer(): Promise<void> {
  await stopWorkspaceServer();

  if (serverInfoPath && fs.existsSync(serverInfoPath)) {
    fs.unlinkSync(serverInfoPath);
    serverInfoPath = null;
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
