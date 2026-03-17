/**
 * Explode a monolithic CartaFile into a workspace directory structure.
 *
 * Returns a Map of relative paths (within .carta/) to file contents (JSON strings).
 * Pure in-memory transformation — no filesystem I/O.
 *
 * See ADR 009 (doc02.04.09) for workspace format design.
 */

import type { CartaFile } from './file-format.js';
import type { WorkspaceManifest, CanvasFile, SchemasFile } from './workspace-format.js';

/**
 * Slugify a string: lowercase, replace non-alphanumeric with `-`,
 * collapse multiple `-`, trim leading/trailing `-`.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Convert a monolithic CartaFile into a workspace directory structure.
 *
 * Returns a map of relative paths (within .carta/) to file contents (JSON strings).
 * Callers are responsible for writing files to disk.
 */
export function explodeCartaFile(cartaFile: CartaFile): Map<string, string> {
  const files = new Map<string, string>();

  // --- workspace.json ---
  const manifest: WorkspaceManifest = {
    formatVersion: 1,
    title: cartaFile.title,
    ...(cartaFile.description !== undefined ? { description: cartaFile.description } : {}),
    ...(cartaFile.groupMetadata !== undefined && Object.keys(cartaFile.groupMetadata).length > 0
      ? { groups: cartaFile.groupMetadata }
      : {}),
  };
  files.set('workspace.json', JSON.stringify(manifest, null, 2));

  // --- schemas/schemas.json ---
  const schemasFile: SchemasFile = {
    formatVersion: 1,
    schemas: cartaFile.customSchemas,
    portSchemas: cartaFile.portSchemas,
    schemaGroups: cartaFile.schemaGroups,
    schemaRelationships: [],
    schemaPackages: cartaFile.schemaPackages,
    ...(cartaFile.packageManifest !== undefined ? { packageManifest: cartaFile.packageManifest } : {}),
  };
  files.set('schemas/schemas.json', JSON.stringify(schemasFile, null, 2));

  // --- Canvas files (one per page) ---
  for (const page of cartaFile.pages) {
    const canvas: CanvasFile = {
      formatVersion: 1,
      nodes: page.nodes,
      edges: page.edges,
    };
    const slug = slugify(page.name);
    const filename = `${slug}.canvas.json`;
    const path = page.group ? `${page.group}/${filename}` : filename;
    files.set(path, JSON.stringify(canvas, null, 2));
  }

  return files;
}
