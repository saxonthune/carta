/**
 * Workspace file format types and validation.
 *
 * Defines the filesystem-first workspace format (.carta/ vault directory).
 * See ADR 009 (doc02.04.09) for design decisions.
 *
 * Platform-agnostic: no browser or Node.js dependencies.
 */

import type {
  ConstructSchema,
  PortSchema,
  SchemaGroup,
  SchemaRelationship,
  SchemaPackage,
  PackageManifestEntry,
} from '@carta/schema';

// ============================================
// Types
// ============================================

/**
 * Workspace manifest — .carta/workspace.json
 */
export interface WorkspaceManifest {
  formatVersion: 1;
  title: string;
  description?: string;
}

/**
 * Spec group metadata — .carta/{group-dir}/_group.json
 */
export interface GroupMeta {
  name: string;
  description?: string;
}

/**
 * Canvas file — .carta/{group-dir}/foo.canvas.json or .carta/foo.canvas.json
 *
 * nodes contains ConstructNodeData and OrganizerNodeData nodes,
 * same shape as CartaFilePage.nodes.
 */
export interface CanvasFile {
  formatVersion: 1;
  nodes: unknown[];
  edges: unknown[];
}

/**
 * All-in-one schema file — .carta/schemas/schemas.json
 */
export interface SchemasFile {
  formatVersion: 1;
  schemas: ConstructSchema[];
  portSchemas: PortSchema[];
  schemaGroups: SchemaGroup[];
  schemaRelationships: SchemaRelationship[];
  schemaPackages: SchemaPackage[];
  packageManifest?: PackageManifestEntry[];
}

// ============================================
// Validation functions
// ============================================

/**
 * Validate the structure of a WorkspaceManifest
 */
export function validateWorkspaceManifest(data: unknown): WorkspaceManifest {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid workspace.json: expected JSON object');
  }

  const obj = data as Record<string, unknown>;

  if (obj.formatVersion !== 1) {
    throw new Error('Invalid workspace.json: formatVersion must be 1');
  }

  if (typeof obj.title !== 'string') {
    throw new Error('Invalid workspace.json: missing or invalid title');
  }

  if (obj.description !== undefined && typeof obj.description !== 'string') {
    throw new Error('Invalid workspace.json: description must be a string');
  }

  return {
    formatVersion: 1,
    title: obj.title,
    description: obj.description as string | undefined,
  };
}

/**
 * Validate the structure of a GroupMeta
 */
export function validateGroupMeta(data: unknown): GroupMeta {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid _group.json: expected JSON object');
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.name !== 'string') {
    throw new Error('Invalid _group.json: missing or invalid name');
  }

  if (obj.description !== undefined && typeof obj.description !== 'string') {
    throw new Error('Invalid _group.json: description must be a string');
  }

  return {
    name: obj.name,
    description: obj.description as string | undefined,
  };
}

/**
 * Validate the structure of a CanvasFile
 */
export function validateCanvasFile(data: unknown): CanvasFile {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid canvas file: expected JSON object');
  }

  const obj = data as Record<string, unknown>;

  if (obj.formatVersion !== 1) {
    throw new Error('Invalid canvas file: formatVersion must be 1');
  }

  if (!Array.isArray(obj.nodes)) {
    throw new Error('Invalid canvas file: missing or invalid nodes array');
  }

  if (!Array.isArray(obj.edges)) {
    throw new Error('Invalid canvas file: missing or invalid edges array');
  }

  // Validate nodes
  for (const node of obj.nodes as unknown[]) {
    if (!node || typeof node !== 'object') {
      throw new Error('Invalid canvas file: invalid node structure');
    }
    const n = node as Record<string, unknown>;
    if (typeof n.id !== 'string' || !n.position || typeof n.type !== 'string') {
      throw new Error('Invalid canvas file: node missing required fields (id, position, type)');
    }
    if (n.data && typeof n.data === 'object') {
      const nodeData = n.data as Record<string, unknown>;
      if (nodeData.connections !== undefined) {
        if (!Array.isArray(nodeData.connections)) {
          throw new Error(`Invalid canvas file: node "${n.id}" has invalid connections (must be array)`);
        }
        for (const conn of nodeData.connections as unknown[]) {
          if (!conn || typeof conn !== 'object') {
            throw new Error(`Invalid canvas file: node "${n.id}" has invalid connection structure`);
          }
          const c = conn as Record<string, unknown>;
          if (
            typeof c.portId !== 'string' ||
            typeof c.targetSemanticId !== 'string' ||
            typeof c.targetPortId !== 'string'
          ) {
            throw new Error(`Invalid canvas file: node "${n.id}" has connection missing required fields`);
          }
        }
      }
    }
  }

  // Validate edges
  for (const edge of obj.edges as unknown[]) {
    if (!edge || typeof edge !== 'object') {
      throw new Error('Invalid canvas file: invalid edge structure');
    }
    const e = edge as Record<string, unknown>;
    if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') {
      throw new Error('Invalid canvas file: edge missing required fields (id, source, target)');
    }
  }

  return {
    formatVersion: 1,
    nodes: obj.nodes,
    edges: obj.edges,
  };
}

const VALID_POLARITIES = ['source', 'sink', 'bidirectional', 'relay', 'intercept'];

/**
 * Validate the structure of a SchemasFile
 */
export function validateSchemasFile(data: unknown): SchemasFile {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid schemas.json: expected JSON object');
  }

  const obj = data as Record<string, unknown>;

  if (obj.formatVersion !== 1) {
    throw new Error('Invalid schemas.json: formatVersion must be 1');
  }

  // Validate schemas array
  if (!Array.isArray(obj.schemas)) {
    throw new Error('Invalid schemas.json: missing or invalid schemas array');
  }

  for (const schema of obj.schemas as unknown[]) {
    if (!schema || typeof schema !== 'object') {
      throw new Error('Invalid schemas.json: invalid schema structure');
    }
    const s = schema as Record<string, unknown>;
    if (
      typeof s.type !== 'string' ||
      typeof s.displayName !== 'string' ||
      typeof s.color !== 'string' ||
      !Array.isArray(s.fields) ||
      !s.compilation
    ) {
      throw new Error('Invalid schemas.json: schema missing required fields (type, displayName, color, fields, compilation)');
    }
    if (s.ports !== undefined) {
      if (!Array.isArray(s.ports)) {
        throw new Error(`Invalid schemas.json: schema "${s.type}" has invalid ports (must be array)`);
      }
      for (const port of s.ports as unknown[]) {
        if (!port || typeof port !== 'object') {
          throw new Error(`Invalid schemas.json: schema "${s.type}" has invalid port structure`);
        }
        const p = port as Record<string, unknown>;
        if (typeof p.id !== 'string' || typeof p.portType !== 'string' || typeof p.label !== 'string') {
          throw new Error(`Invalid schemas.json: schema "${s.type}" has port missing required fields (id, portType, label)`);
        }
      }
    }
  }

  // Validate portSchemas array
  if (!Array.isArray(obj.portSchemas)) {
    throw new Error('Invalid schemas.json: missing or invalid portSchemas array');
  }

  for (const ps of obj.portSchemas as unknown[]) {
    if (!ps || typeof ps !== 'object') {
      throw new Error('Invalid schemas.json: invalid portSchema structure');
    }
    const p = ps as Record<string, unknown>;
    if (
      typeof p.id !== 'string' ||
      typeof p.displayName !== 'string' ||
      typeof p.semanticDescription !== 'string' ||
      typeof p.polarity !== 'string' ||
      !Array.isArray(p.compatibleWith) ||
      typeof p.color !== 'string'
    ) {
      throw new Error(
        'Invalid schemas.json: portSchema missing required fields (id, displayName, semanticDescription, polarity, compatibleWith, color)',
      );
    }
    if (!VALID_POLARITIES.includes(p.polarity as string)) {
      throw new Error(`Invalid schemas.json: portSchema "${p.id}" has invalid polarity "${p.polarity}"`);
    }
  }

  // Validate schemaGroups array
  if (!Array.isArray(obj.schemaGroups)) {
    throw new Error('Invalid schemas.json: missing or invalid schemaGroups array');
  }

  for (const sg of obj.schemaGroups as unknown[]) {
    if (!sg || typeof sg !== 'object') {
      throw new Error('Invalid schemas.json: invalid schemaGroup structure');
    }
    const g = sg as Record<string, unknown>;
    if (typeof g.id !== 'string' || typeof g.name !== 'string') {
      throw new Error('Invalid schemas.json: schemaGroup missing required fields (id, name)');
    }
    if (g.parentId !== undefined && typeof g.parentId !== 'string') {
      throw new Error(`Invalid schemas.json: schemaGroup "${g.id}" has invalid parentId (must be string)`);
    }
  }

  // Validate schemaRelationships array
  if (!Array.isArray(obj.schemaRelationships)) {
    throw new Error('Invalid schemas.json: missing or invalid schemaRelationships array');
  }

  // Validate schemaPackages array
  if (!Array.isArray(obj.schemaPackages)) {
    throw new Error('Invalid schemas.json: missing or invalid schemaPackages array');
  }

  for (const sp of obj.schemaPackages as unknown[]) {
    if (!sp || typeof sp !== 'object') {
      throw new Error('Invalid schemas.json: invalid schemaPackage structure');
    }
    const p = sp as Record<string, unknown>;
    if (typeof p.id !== 'string' || typeof p.name !== 'string' || typeof p.color !== 'string') {
      throw new Error('Invalid schemas.json: schemaPackage missing required fields (id, name, color)');
    }
  }

  // packageManifest is optional
  if (obj.packageManifest !== undefined && !Array.isArray(obj.packageManifest)) {
    throw new Error('Invalid schemas.json: packageManifest must be an array');
  }

  return {
    formatVersion: 1,
    schemas: obj.schemas as ConstructSchema[],
    portSchemas: obj.portSchemas as PortSchema[],
    schemaGroups: obj.schemaGroups as SchemaGroup[],
    schemaRelationships: obj.schemaRelationships as SchemaRelationship[],
    schemaPackages: obj.schemaPackages as SchemaPackage[],
    packageManifest: obj.packageManifest as PackageManifestEntry[] | undefined,
  };
}

// ============================================
// Parse functions (string → validated type)
// ============================================

/**
 * Parse and validate workspace.json from raw string content
 */
export function parseWorkspaceManifest(content: string): WorkspaceManifest {
  const data = JSON.parse(content);
  return validateWorkspaceManifest(data);
}

/**
 * Parse and validate _group.json from raw string content
 */
export function parseGroupMeta(content: string): GroupMeta {
  const data = JSON.parse(content);
  return validateGroupMeta(data);
}

/**
 * Parse and validate a .canvas.json file from raw string content
 */
export function parseCanvasFile(content: string): CanvasFile {
  const data = JSON.parse(content);
  return validateCanvasFile(data);
}

/**
 * Parse and validate schemas.json from raw string content
 */
export function parseSchemasFile(content: string): SchemasFile {
  const data = JSON.parse(content);
  return validateSchemasFile(data);
}

// ============================================
// Serialize functions (type → string)
// ============================================

/**
 * Serialize a WorkspaceManifest to JSON string
 */
export function serializeWorkspaceManifest(manifest: WorkspaceManifest): string {
  return JSON.stringify(manifest, null, 2);
}

/**
 * Serialize a GroupMeta to JSON string
 */
export function serializeGroupMeta(meta: GroupMeta): string {
  return JSON.stringify(meta, null, 2);
}

/**
 * Serialize a CanvasFile to JSON string
 */
export function serializeCanvasFile(canvas: CanvasFile): string {
  return JSON.stringify(canvas, null, 2);
}

/**
 * Serialize a SchemasFile to JSON string
 */
export function serializeSchemasFile(schemas: SchemasFile): string {
  return JSON.stringify(schemas, null, 2);
}
