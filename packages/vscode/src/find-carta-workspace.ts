import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';

/**
 * Find the first .carta/workspace.json in VS Code's open workspace folders.
 * Returns the absolute path to the .carta/ directory, or null if not found.
 */
export function findCartaWorkspace(): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) return null;

  for (const folder of workspaceFolders) {
    const cartaDir = path.join(folder.uri.fsPath, '.carta');
    const manifestPath = path.join(cartaDir, 'workspace.json');
    if (fs.existsSync(manifestPath)) return cartaDir;
  }
  return null;
}

/**
 * Derive a workspace-server room name from a .canvas.json file path.
 * Given: /project/.carta/01-vision/sketch.canvas.json
 * cartaDir: /project/.carta
 * Returns: "01-vision/sketch"
 */
export function deriveRoomName(cartaDir: string, filePath: string): string | null {
  const rel = path.relative(cartaDir, filePath);
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null;
  // Strip .canvas.json extension
  if (!rel.endsWith('.canvas.json')) return null;
  return rel.slice(0, -'.canvas.json'.length).replace(/\\/g, '/');
}
