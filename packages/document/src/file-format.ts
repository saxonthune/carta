/**
 * .carta file format types and validation.
 *
 * Platform-agnostic: uses unknown[] for nodes/edges instead of @xyflow/react types.
 * Web-client re-exports these and adds browser-specific import/export functions.
 */

import type { ConstructSchema, PortSchema, SchemaGroup, SchemaPackage, PackageManifestEntry, CartaSchemasFile, Resource } from '@carta/domain';
import { CARTA_FILE_VERSION } from './constants.js';

/**
 * Page structure in a .carta file
 */
export interface CartaFilePage {
  id: string;
  name: string;
  description?: string;
  order: number;
  nodes: unknown[];
  edges: unknown[];
}

/**
 * Structure of a .carta project file
 */
export interface CartaFile {
  version: number;
  title: string;
  description?: string;
  pages: CartaFilePage[];
  customSchemas: ConstructSchema[];
  portSchemas: PortSchema[];
  schemaGroups: SchemaGroup[];
  schemaPackages: SchemaPackage[];
  packageManifest?: PackageManifestEntry[];
  resources?: Resource[];
  exportedAt: string;
}

/**
 * Parse and validate a .carta file from raw string content
 */
export function importProjectFromString(content: string): CartaFile {
  const data = JSON.parse(content);
  return validateCartaFile(data);
}

/**
 * Validate the structure of a .carta file
 */
export function validateCartaFile(data: unknown): CartaFile {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid file: expected JSON object');
  }

  const obj = data as Record<string, unknown>;

  // Check version
  if (typeof obj.version !== 'number') {
    throw new Error('Invalid file: missing or invalid version');
  }

  if (obj.version > CARTA_FILE_VERSION) {
    throw new Error(`File version ${obj.version} is newer than supported version ${CARTA_FILE_VERSION}`);
  }

  // Check required fields
  if (typeof obj.title !== 'string') {
    throw new Error('Invalid file: missing or invalid title');
  }

  // Require pages array (accept legacy 'levels' key)
  if (!Array.isArray(obj.pages) && Array.isArray(obj.levels)) {
    obj.pages = obj.levels;
    delete obj.levels;
  }
  if (!Array.isArray(obj.pages) || obj.pages.length === 0) {
    throw new Error('Invalid file: missing or empty pages array');
  }

  if (!Array.isArray(obj.customSchemas)) {
    throw new Error('Invalid file: missing or invalid customSchemas array');
  }

  // Validate levels
  for (const page of obj.pages as unknown[]) {
    if (!page || typeof page !== 'object') {
      throw new Error('Invalid file: invalid page structure');
    }
    const l = page as Record<string, unknown>;
    if (typeof l.id !== 'string' || typeof l.name !== 'string' || typeof l.order !== 'number') {
      throw new Error('Invalid file: page missing required fields (id, name, order)');
    }
    if (!Array.isArray(l.nodes) || !Array.isArray(l.edges)) {
      throw new Error('Invalid file: page missing required arrays (nodes, edges)');
    }
  }

  // Validate nodes across all levels
  const nodesToValidate = (obj.pages as Array<Record<string, unknown>>).flatMap(l => l.nodes as unknown[]);

  for (const node of nodesToValidate) {
    if (!node || typeof node !== 'object') {
      throw new Error('Invalid file: invalid node structure');
    }
    const n = node as Record<string, unknown>;
    if (typeof n.id !== 'string' || !n.position || typeof n.type !== 'string') {
      throw new Error('Invalid file: node missing required fields (id, position, type)');
    }
    if (n.data && typeof n.data === 'object') {
      const nodeData = n.data as Record<string, unknown>;
      if (nodeData.connections !== undefined) {
        if (!Array.isArray(nodeData.connections)) {
          throw new Error(`Invalid file: node "${n.id}" has invalid connections (must be array)`);
        }
        for (const conn of nodeData.connections as unknown[]) {
          if (!conn || typeof conn !== 'object') {
            throw new Error(`Invalid file: node "${n.id}" has invalid connection structure`);
          }
          const c = conn as Record<string, unknown>;
          if (typeof c.portId !== 'string' || typeof c.targetSemanticId !== 'string' ||
              typeof c.targetPortId !== 'string') {
            throw new Error(`Invalid file: node "${n.id}" has connection missing required fields`);
          }
        }
      }
    }
  }

  // Validate edges across all levels
  const edgesToValidate = (obj.pages as Array<Record<string, unknown>>).flatMap(l => l.edges as unknown[]);

  for (const edge of edgesToValidate) {
    if (!edge || typeof edge !== 'object') {
      throw new Error('Invalid file: invalid edge structure');
    }
    const e = edge as Record<string, unknown>;
    if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') {
      throw new Error('Invalid file: edge missing required fields (id, source, target)');
    }
  }

  // Validate custom schemas
  for (const schema of obj.customSchemas as unknown[]) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Invalid file: invalid schema structure');
    }
    const s = schema as Record<string, unknown>;
    if (typeof s.type !== 'string' || typeof s.displayName !== 'string' ||
        typeof s.color !== 'string' || !Array.isArray(s.fields) || !s.compilation) {
      throw new Error('Invalid file: schema missing required fields');
    }
    if (s.ports !== undefined) {
      if (!Array.isArray(s.ports)) {
        throw new Error(`Invalid file: schema "${s.type}" has invalid ports (must be array)`);
      }
      for (const port of s.ports as unknown[]) {
        if (!port || typeof port !== 'object') {
          throw new Error(`Invalid file: schema "${s.type}" has invalid port structure`);
        }
        const p = port as Record<string, unknown>;
        if (typeof p.id !== 'string' || typeof p.portType !== 'string' ||
            typeof p.label !== 'string') {
          throw new Error(`Invalid file: schema "${s.type}" has port missing required fields (id, portType, label)`);
        }
      }
    }
  }

  // Validate portSchemas (required)
  if (!Array.isArray(obj.portSchemas)) {
    throw new Error('Invalid file: missing or invalid portSchemas array');
  }
  for (const ps of obj.portSchemas as unknown[]) {
    if (!ps || typeof ps !== 'object') {
      throw new Error('Invalid file: invalid portSchema structure');
    }
    const p = ps as Record<string, unknown>;
    if (typeof p.id !== 'string' || typeof p.displayName !== 'string' ||
        typeof p.semanticDescription !== 'string' || typeof p.polarity !== 'string' ||
        !Array.isArray(p.compatibleWith) ||
        typeof p.color !== 'string') {
      throw new Error(`Invalid file: portSchema missing required fields (id, displayName, semanticDescription, polarity, compatibleWith, color)`);
    }
    const validPolarities = ['source', 'sink', 'bidirectional', 'relay', 'intercept'];
    if (!validPolarities.includes(p.polarity as string)) {
      throw new Error(`Invalid file: portSchema "${p.id}" has invalid polarity "${p.polarity}"`);
    }
  }

  // Validate schemaGroups (required for v5 and earlier, optional for v6+)
  if (!Array.isArray(obj.schemaGroups)) {
    // Allow missing schemaGroups for newer files
    if (obj.version < 6) {
      throw new Error('Invalid file: missing or invalid schemaGroups array');
    }
    obj.schemaGroups = [];
  }
  for (const sg of obj.schemaGroups as unknown[]) {
    if (!sg || typeof sg !== 'object') {
      throw new Error('Invalid file: invalid schemaGroup structure');
    }
    const g = sg as Record<string, unknown>;
    if (typeof g.id !== 'string' || typeof g.name !== 'string') {
      throw new Error(`Invalid file: schemaGroup missing required fields (id, name)`);
    }
    if (g.parentId !== undefined && typeof g.parentId !== 'string') {
      throw new Error(`Invalid file: schemaGroup "${g.id}" has invalid parentId (must be string)`);
    }
  }

  // Validate schemaPackages (optional for v6 and earlier, required for v7+)
  if (!Array.isArray(obj.schemaPackages)) {
    obj.schemaPackages = [];
  }
  for (const sp of obj.schemaPackages as unknown[]) {
    if (!sp || typeof sp !== 'object') {
      throw new Error('Invalid file: invalid schemaPackage structure');
    }
    const p = sp as Record<string, unknown>;
    if (typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.color !== 'string') {
      throw new Error(`Invalid file: schemaPackage missing required fields (id, name, color)`);
    }
  }

  // Validate packageManifest (optional, default to empty array)
  if (!Array.isArray(obj.packageManifest)) {
    obj.packageManifest = [];
  }

  // Validate resources (optional, backward-compatible)
  if (obj.resources !== undefined) {
    if (!Array.isArray(obj.resources)) {
      throw new Error('Invalid file: resources must be an array');
    }
    for (const resource of obj.resources as unknown[]) {
      if (!resource || typeof resource !== 'object') {
        throw new Error('Invalid file: invalid resource structure');
      }
      const r = resource as Record<string, unknown>;
      if (typeof r.id !== 'string' || typeof r.name !== 'string' ||
          typeof r.format !== 'string' || typeof r.body !== 'string' ||
          typeof r.currentHash !== 'string') {
        throw new Error('Invalid file: resource missing required fields (id, name, format, body, currentHash)');
      }
      if (!Array.isArray(r.versions)) {
        throw new Error(`Invalid file: resource "${r.id}" missing versions array`);
      }
      for (const ver of r.versions as unknown[]) {
        if (!ver || typeof ver !== 'object') {
          throw new Error(`Invalid file: resource "${r.id}" has invalid version structure`);
        }
        const v = ver as Record<string, unknown>;
        if (typeof v.versionId !== 'string' || typeof v.contentHash !== 'string' ||
            typeof v.publishedAt !== 'string' || typeof v.body !== 'string') {
          throw new Error(`Invalid file: resource "${r.id}" has version missing required fields`);
        }
      }
    }
  }

  // v6→v7 migration: promote top-level groups to packages
  if (obj.version <= 6 && Array.isArray(obj.schemaGroups) && obj.schemaGroups.length > 0) {
    const groups = obj.schemaGroups as Array<Record<string, unknown>>;
    const schemas = obj.customSchemas as Array<Record<string, unknown>>;
    const portSchemas = obj.portSchemas as Array<Record<string, unknown>>;
    const packages: Array<Record<string, unknown>> = [];

    // Find top-level groups (no parentId)
    const topLevelGroups = groups.filter(g => !g.parentId);

    for (const topGroup of topLevelGroups) {
      // Create a package from this top-level group
      packages.push({
        id: topGroup.id as string,
        name: topGroup.name as string,
        description: topGroup.description as string | undefined,
        color: (topGroup.color as string) || '#7c7fca',
      });

      // Find all subgroups of this group
      const subgroups = groups.filter(g => g.parentId === topGroup.id);

      // Assign packageId to schemas in this group or its subgroups
      const groupIds = new Set([topGroup.id, ...subgroups.map(g => g.id as string)]);
      for (const schema of schemas) {
        if (groupIds.has(schema.groupId as string)) {
          schema.packageId = topGroup.id as string;
        }
      }

      // Assign packageId to subgroups
      for (const subgroup of subgroups) {
        subgroup.packageId = topGroup.id as string;
      }

      // Assign packageId to port schemas in this group
      for (const portSchema of portSchemas) {
        if (portSchema.groupId === topGroup.id) {
          portSchema.packageId = topGroup.id as string;
        }
      }
    }

    // Remove promoted groups from schemaGroups
    obj.schemaGroups = groups.filter(g => g.parentId !== undefined);
    obj.schemaPackages = packages;
    obj.version = 7;
  }

  // Repair orphaned connections before returning
  const repairedData = repairOrphanedConnections(obj);

  return {
    version: repairedData.version as number,
    title: repairedData.title as string,
    description: (repairedData.description as string | undefined),
    pages: repairedData.pages as CartaFilePage[],
    customSchemas: repairedData.customSchemas as ConstructSchema[],
    portSchemas: repairedData.portSchemas as PortSchema[],
    schemaGroups: repairedData.schemaGroups as SchemaGroup[],
    schemaPackages: repairedData.schemaPackages as SchemaPackage[],
    packageManifest: repairedData.packageManifest as PackageManifestEntry[] | undefined,
    resources: (repairedData.resources as Resource[] | undefined) || [],
    exportedAt: (repairedData.exportedAt as string) || new Date().toISOString(),
  };
}

/**
 * Repair orphaned connections in a .carta file.
 * Removes connections that reference non-existent nodes.
 */
function repairOrphanedConnections(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  // Build set of all valid semantic IDs
  const validSemanticIds = new Set<string>();

  const nodesToCheck = (obj.pages as Array<Record<string, unknown>>).flatMap(l => l.nodes as unknown[]);

  for (const node of nodesToCheck) {
    if (!node || typeof node !== 'object') continue;
    const n = node as Record<string, unknown>;
    if (n.data && typeof n.data === 'object') {
      const nodeData = n.data as Record<string, unknown>;
      if (typeof nodeData.semanticId === 'string') {
        validSemanticIds.add(nodeData.semanticId);
      }
    }
  }

  // Repair connections in all levels
  const repairedPages = (obj.pages as unknown[]).map((page: unknown) => {
    if (!page || typeof page !== 'object') return page;
    const l = page as Record<string, unknown>;
    if (!Array.isArray(l.nodes)) return page;

    const repairedNodes = l.nodes.map((node: unknown) => {
      if (!node || typeof node !== 'object') return node;
      const n = node as Record<string, unknown>;
      if (!n.data || typeof n.data !== 'object') return node;

      const nodeData = n.data as Record<string, unknown>;
      if (!Array.isArray(nodeData.connections)) return node;

      const validConnections = nodeData.connections.filter((conn: unknown) => {
        if (!conn || typeof conn !== 'object') return false;
        const c = conn as Record<string, unknown>;
        return validSemanticIds.has(c.targetSemanticId as string);
      });

      // Only modify if connections changed
      if (validConnections.length === nodeData.connections.length) return node;

      return {
        ...n,
        data: {
          ...nodeData,
          connections: validConnections,
        },
      };
    });

    return {
      ...l,
      nodes: repairedNodes,
    };
  });

  return {
    ...obj,
    pages: repairedPages,
  };
}

// ============================================
// .carta-schemas file format (M1-only library packages)
// ============================================

/**
 * Parse and validate a .carta-schemas file from raw string content
 */
export function importSchemasFromString(content: string): CartaSchemasFile {
  const data = JSON.parse(content);
  return validateCartaSchemasFile(data);
}

/**
 * Validate the structure of a .carta-schemas file
 */
export function validateCartaSchemasFile(data: unknown): CartaSchemasFile {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid .carta-schemas file: expected JSON object');
  }

  const obj = data as Record<string, unknown>;

  // Check formatVersion
  if (obj.formatVersion !== 1) {
    throw new Error('Invalid .carta-schemas file: formatVersion must be 1');
  }

  // Check required fields
  if (typeof obj.name !== 'string') {
    throw new Error('Invalid .carta-schemas file: missing or invalid name');
  }

  if (typeof obj.version !== 'number') {
    throw new Error('Invalid .carta-schemas file: missing or invalid version');
  }

  if (typeof obj.exportedAt !== 'string') {
    throw new Error('Invalid .carta-schemas file: missing or invalid exportedAt');
  }

  // Validate schemas array
  if (!Array.isArray(obj.schemas)) {
    throw new Error('Invalid .carta-schemas file: missing or invalid schemas array');
  }

  for (const schema of obj.schemas as unknown[]) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Invalid .carta-schemas file: invalid schema structure');
    }
    const s = schema as Record<string, unknown>;
    if (typeof s.type !== 'string' || typeof s.displayName !== 'string' ||
        typeof s.color !== 'string' || !Array.isArray(s.fields) || !s.compilation) {
      throw new Error('Invalid .carta-schemas file: schema missing required fields');
    }
    if (s.ports !== undefined) {
      if (!Array.isArray(s.ports)) {
        throw new Error(`Invalid .carta-schemas file: schema "${s.type}" has invalid ports (must be array)`);
      }
      for (const port of s.ports as unknown[]) {
        if (!port || typeof port !== 'object') {
          throw new Error(`Invalid .carta-schemas file: schema "${s.type}" has invalid port structure`);
        }
        const p = port as Record<string, unknown>;
        if (typeof p.id !== 'string' || typeof p.portType !== 'string' ||
            typeof p.label !== 'string') {
          throw new Error(`Invalid .carta-schemas file: schema "${s.type}" has port missing required fields (id, portType, label)`);
        }
      }
    }
  }

  // Validate portSchemas array
  if (!Array.isArray(obj.portSchemas)) {
    throw new Error('Invalid .carta-schemas file: missing or invalid portSchemas array');
  }

  for (const ps of obj.portSchemas as unknown[]) {
    if (!ps || typeof ps !== 'object') {
      throw new Error('Invalid .carta-schemas file: invalid portSchema structure');
    }
    const p = ps as Record<string, unknown>;
    if (typeof p.id !== 'string' || typeof p.displayName !== 'string' ||
        typeof p.semanticDescription !== 'string' || typeof p.polarity !== 'string' ||
        !Array.isArray(p.compatibleWith) ||
        typeof p.color !== 'string') {
      throw new Error(`Invalid .carta-schemas file: portSchema missing required fields (id, displayName, semanticDescription, polarity, compatibleWith, color)`);
    }
    const validPolarities = ['source', 'sink', 'bidirectional', 'relay', 'intercept'];
    if (!validPolarities.includes(p.polarity as string)) {
      throw new Error(`Invalid .carta-schemas file: portSchema "${p.id}" has invalid polarity "${p.polarity}"`);
    }
  }

  // Validate schemaGroups array
  if (!Array.isArray(obj.schemaGroups)) {
    throw new Error('Invalid .carta-schemas file: missing or invalid schemaGroups array');
  }

  for (const sg of obj.schemaGroups as unknown[]) {
    if (!sg || typeof sg !== 'object') {
      throw new Error('Invalid .carta-schemas file: invalid schemaGroup structure');
    }
    const g = sg as Record<string, unknown>;
    if (typeof g.id !== 'string' || typeof g.name !== 'string') {
      throw new Error(`Invalid .carta-schemas file: schemaGroup missing required fields (id, name)`);
    }
    if (g.parentId !== undefined && typeof g.parentId !== 'string') {
      throw new Error(`Invalid .carta-schemas file: schemaGroup "${g.id}" has invalid parentId (must be string)`);
    }
  }

  return {
    formatVersion: 1,
    name: obj.name as string,
    description: obj.description as string | undefined,
    version: obj.version as number,
    changelog: obj.changelog as string | undefined,
    schemas: obj.schemas as ConstructSchema[],
    portSchemas: obj.portSchemas as PortSchema[],
    schemaGroups: obj.schemaGroups as SchemaGroup[],
    exportedAt: obj.exportedAt as string,
  };
}

/**
 * Serialize a CartaSchemasFile to JSON string
 */
export function exportSchemasToString(file: CartaSchemasFile): string {
  return JSON.stringify(file, null, 2);
}
