/**
 * Explode a monolithic CartaFile into a workspace directory structure.
 *
 * Returns a Map of relative paths (within .carta/) to file contents (JSON strings).
 * Pure in-memory transformation — no filesystem I/O.
 *
 * See ADR 009 (doc02.04.09) for workspace format design.
 */

import type { CartaFile, CartaFileSpecGroup } from './file-format.js';
import type { WorkspaceManifest, CanvasFile, SchemasFile, GroupMeta } from './workspace-format.js';

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
 * Build the directory name for a spec group: `{order:02d}-{slug}`.
 */
function groupDirName(group: CartaFileSpecGroup): string {
  const paddedOrder = String(group.order).padStart(2, '0');
  return `${paddedOrder}-${slugify(group.name)}`;
}

/**
 * Convert a monolithic CartaFile into a workspace directory structure.
 *
 * Returns a map of relative paths (within .carta/) to file contents (JSON strings).
 * Callers are responsible for writing files to disk.
 */
export function explodeCartaFile(cartaFile: CartaFile): Map<string, string> {
  const files = new Map<string, string>();

  // --- Build lookup: item id → spec group ---
  const pageGroupMap = new Map<string, CartaFileSpecGroup>();
  const resourceGroupMap = new Map<string, CartaFileSpecGroup>();

  for (const group of cartaFile.specGroups ?? []) {
    for (const item of group.items) {
      if (item.type === 'page') {
        pageGroupMap.set(item.id, group);
      } else if (item.type === 'resource') {
        resourceGroupMap.set(item.id, group);
      }
    }
  }

  // --- workspace.json ---
  const manifest: WorkspaceManifest = {
    formatVersion: 1,
    title: cartaFile.title,
    ...(cartaFile.description !== undefined ? { description: cartaFile.description } : {}),
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

  // --- Spec group _group.json files ---
  for (const group of cartaFile.specGroups ?? []) {
    const dir = groupDirName(group);
    const meta: GroupMeta = {
      name: group.name,
      ...(group.description !== undefined ? { description: group.description } : {}),
    };
    files.set(`${dir}/_group.json`, JSON.stringify(meta, null, 2));
  }

  // --- Canvas files (one per page) ---
  for (const page of cartaFile.pages) {
    const canvas: CanvasFile = {
      formatVersion: 1,
      nodes: page.nodes,
      edges: page.edges,
    };
    const slug = slugify(page.name);
    const filename = `${slug}.canvas.json`;
    const group = pageGroupMap.get(page.id);
    const path = group ? `${groupDirName(group)}/${filename}` : filename;
    files.set(path, JSON.stringify(canvas, null, 2));
  }

  // --- Resource files ---
  for (const resource of cartaFile.resources ?? []) {
    const slug = slugify(resource.name);
    const filename = `${slug}.${resource.format}`;
    const group = resourceGroupMap.get(resource.id);
    const path = group ? `${groupDirName(group)}/${filename}` : filename;
    files.set(path, resource.body);
  }

  return files;
}
