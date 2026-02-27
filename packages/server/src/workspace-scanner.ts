/**
 * Workspace Scanner
 *
 * Scans a .carta/ directory and returns a structured workspace tree.
 * Read-only — no file watching, no write operations.
 * See ADR 009 (doc02.04.09) for workspace format design.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parseWorkspaceManifest, parseGroupMeta, type WorkspaceManifest, type GroupMeta } from '@carta/document';

// ===== TYPES =====

/** A file entry in the workspace tree */
export interface WorkspaceFileEntry {
  name: string;    // filename (e.g., 'endpoint-map.canvas.json')
  path: string;    // relative to .carta/ (e.g., '01-api-contract/endpoint-map.canvas.json')
  type: 'canvas' | 'file';  // canvas if .canvas.json, file otherwise
  size: number;    // file size in bytes
}

/** A spec group (directory with _group.json) */
export interface WorkspaceGroup {
  name: string;          // from _group.json
  description?: string;  // from _group.json
  dirName: string;       // directory name (e.g., '01-api-contract')
  path: string;          // relative to .carta/
  files: WorkspaceFileEntry[];
}

/** Complete workspace tree */
export interface WorkspaceTree {
  manifest: WorkspaceManifest;
  groups: WorkspaceGroup[];
  ungroupedFiles: WorkspaceFileEntry[];  // files directly in .carta/ (not in a group dir)
  schemasPath: string | null;            // relative path to schemas.json if it exists
}

// ===== IMPLEMENTATION =====

/** Directories to skip when scanning top-level entries */
const SKIP_DIRS = new Set(['.state', 'schemas']);

/** Top-level files to skip from ungroupedFiles */
const SKIP_FILES = new Set(['workspace.json', 'ui-state.json']);

/**
 * Classify a filename as canvas or resource.
 * A file is canvas if its name ends with '.canvas.json'.
 */
function classifyFile(name: string): 'canvas' | 'file' {
  return name.endsWith('.canvas.json') ? 'canvas' : 'file';
}

/**
 * Build a WorkspaceFileEntry for a given file.
 */
function makeFileEntry(name: string, relativePath: string, absolutePath: string): WorkspaceFileEntry {
  const stat = fs.statSync(absolutePath);
  return {
    name,
    path: relativePath,
    type: classifyFile(name),
    size: stat.size,
  };
}

/**
 * Scan a .carta/ directory and return a structured workspace tree.
 * @param cartaDir Absolute path to the .carta/ directory
 * @throws If workspace.json is missing or invalid
 */
export function scanWorkspace(cartaDir: string): WorkspaceTree {
  // Step 1: Read and parse workspace.json
  const manifestPath = path.join(cartaDir, 'workspace.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Missing workspace.json in ${cartaDir}`);
  }
  const manifest = parseWorkspaceManifest(fs.readFileSync(manifestPath, 'utf-8'));

  // Step 2: Check for schemas/schemas.json
  const schemasFilePath = path.join(cartaDir, 'schemas', 'schemas.json');
  const schemasPath = fs.existsSync(schemasFilePath) ? 'schemas/schemas.json' : null;

  // Step 3: List top-level entries
  const entries = fs.readdirSync(cartaDir, { withFileTypes: true });

  const groups: WorkspaceGroup[] = [];
  const ungroupedFiles: WorkspaceFileEntry[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;  // Skip hidden entries

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;  // Skip .state/, schemas/

      // Step 4: Check for _group.json
      const groupMetaPath = path.join(cartaDir, entry.name, '_group.json');
      if (!fs.existsSync(groupMetaPath)) continue;  // Not a spec group

      const meta: GroupMeta = parseGroupMeta(fs.readFileSync(groupMetaPath, 'utf-8'));

      // Scan files in the group directory
      const groupEntries = fs.readdirSync(path.join(cartaDir, entry.name), { withFileTypes: true });
      const files: WorkspaceFileEntry[] = [];

      for (const groupEntry of groupEntries) {
        if (!groupEntry.isFile()) continue;
        if (groupEntry.name === '_group.json') continue;  // Skip metadata
        if (groupEntry.name.startsWith('.')) continue;     // Skip hidden

        const relPath = `${entry.name}/${groupEntry.name}`;
        const absPath = path.join(cartaDir, entry.name, groupEntry.name);
        files.push(makeFileEntry(groupEntry.name, relPath, absPath));
      }

      files.sort((a, b) => a.name.localeCompare(b.name));

      groups.push({
        name: meta.name,
        description: meta.description,
        dirName: entry.name,
        path: entry.name,
        files,
      });
    } else if (entry.isFile()) {
      // Step 5: Top-level files
      if (SKIP_FILES.has(entry.name)) continue;

      const absPath = path.join(cartaDir, entry.name);
      ungroupedFiles.push(makeFileEntry(entry.name, entry.name, absPath));
    }
  }

  // Step 6: Sort groups by dirName
  groups.sort((a, b) => a.dirName.localeCompare(b.dirName));

  // Step 7: Sort ungrouped files by name
  ungroupedFiles.sort((a, b) => a.name.localeCompare(b.name));

  return { manifest, groups, ungroupedFiles, schemasPath };
}
