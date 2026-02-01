/**
 * .carta file format types and validation.
 *
 * Platform-agnostic: uses unknown[] for nodes/edges instead of @xyflow/react types.
 * Web-client re-exports these and adds browser-specific import/export functions.
 */

import type { Deployable, ConstructSchema, PortSchema, SchemaGroup } from '@carta/domain';
import { CARTA_FILE_VERSION } from './constants.js';

/**
 * Level structure in a .carta file
 */
export interface CartaFileLevel {
  id: string;
  name: string;
  description?: string;
  order: number;
  nodes: unknown[];
  edges: unknown[];
  deployables: Deployable[];
}

/**
 * Structure of a .carta project file (v5 with levels)
 */
export interface CartaFile {
  version: number;
  title: string;
  description?: string;
  // V5: levels contain nodes/edges/deployables
  levels?: CartaFileLevel[];
  // V4 and earlier: flat nodes/edges/deployables (for backwards compat on import)
  nodes: unknown[];
  edges: unknown[];
  deployables: Deployable[];
  customSchemas: ConstructSchema[];
  portSchemas: PortSchema[];
  schemaGroups: SchemaGroup[];
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

  // V5 files may have levels[] as the primary data structure
  // For older files, nodes/edges/deployables are required at the top level
  const hasLevels = Array.isArray(obj.levels) && obj.levels.length > 0;

  if (!hasLevels) {
    // Legacy format validation
    if (!Array.isArray(obj.nodes)) {
      throw new Error('Invalid file: missing or invalid nodes array');
    }

    if (!Array.isArray(obj.edges)) {
      throw new Error('Invalid file: missing or invalid edges array');
    }

    if (!Array.isArray(obj.deployables)) {
      throw new Error('Invalid file: missing or invalid deployables array');
    }
  }

  if (!Array.isArray(obj.customSchemas)) {
    throw new Error('Invalid file: missing or invalid customSchemas array');
  }

  // Validate levels if present
  if (hasLevels) {
    for (const level of obj.levels as unknown[]) {
      if (!level || typeof level !== 'object') {
        throw new Error('Invalid file: invalid level structure');
      }
      const l = level as Record<string, unknown>;
      if (typeof l.id !== 'string' || typeof l.name !== 'string' || typeof l.order !== 'number') {
        throw new Error('Invalid file: level missing required fields (id, name, order)');
      }
      if (!Array.isArray(l.nodes) || !Array.isArray(l.edges) || !Array.isArray(l.deployables)) {
        throw new Error('Invalid file: level missing required arrays (nodes, edges, deployables)');
      }
    }
  }

  // Validate nodes (either from levels or flat)
  const nodesToValidate = hasLevels
    ? (obj.levels as Array<Record<string, unknown>>).flatMap(l => l.nodes as unknown[])
    : obj.nodes as unknown[];

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

  // Validate edges (either from levels or flat)
  const edgesToValidate = hasLevels
    ? (obj.levels as Array<Record<string, unknown>>).flatMap(l => l.edges as unknown[])
    : obj.edges as unknown[];

  for (const edge of edgesToValidate) {
    if (!edge || typeof edge !== 'object') {
      throw new Error('Invalid file: invalid edge structure');
    }
    const e = edge as Record<string, unknown>;
    if (typeof e.id !== 'string' || typeof e.source !== 'string' || typeof e.target !== 'string') {
      throw new Error('Invalid file: edge missing required fields (id, source, target)');
    }
  }

  // Validate deployables (either from levels or flat)
  const deployablesToValidate = hasLevels
    ? (obj.levels as Array<Record<string, unknown>>).flatMap(l => l.deployables as unknown[])
    : obj.deployables as unknown[];

  for (const deployable of deployablesToValidate) {
    if (!deployable || typeof deployable !== 'object') {
      throw new Error('Invalid file: invalid deployable structure');
    }
    const d = deployable as Record<string, unknown>;
    if (typeof d.id !== 'string' || typeof d.name !== 'string' || typeof d.description !== 'string') {
      throw new Error('Invalid file: deployable missing required fields');
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
            typeof p.position !== 'string' || typeof p.offset !== 'number' ||
            typeof p.label !== 'string') {
          throw new Error(`Invalid file: schema "${s.type}" has port missing required fields (id, portType, position, offset, label)`);
        }
        const validPositions = ['left', 'right', 'top', 'bottom'];
        if (!validPositions.includes(p.position as string)) {
          throw new Error(`Invalid file: schema "${s.type}" has port with invalid position "${p.position}"`);
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
        !Array.isArray(p.compatibleWith) || typeof p.defaultPosition !== 'string' ||
        typeof p.color !== 'string') {
      throw new Error(`Invalid file: portSchema missing required fields (id, displayName, semanticDescription, polarity, compatibleWith, defaultPosition, color)`);
    }
    const validPolarities = ['source', 'sink', 'bidirectional', 'relay', 'intercept'];
    if (!validPolarities.includes(p.polarity as string)) {
      throw new Error(`Invalid file: portSchema "${p.id}" has invalid polarity "${p.polarity}"`);
    }
    const validPositions = ['left', 'right', 'top', 'bottom'];
    if (!validPositions.includes(p.defaultPosition as string)) {
      throw new Error(`Invalid file: portSchema "${p.id}" has invalid defaultPosition "${p.defaultPosition}"`);
    }
  }

  // Validate schemaGroups (required)
  if (!Array.isArray(obj.schemaGroups)) {
    throw new Error('Invalid file: missing or invalid schemaGroups array');
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

  return {
    version: obj.version as number,
    title: obj.title as string,
    description: (obj.description as string | undefined),
    levels: hasLevels ? (obj.levels as CartaFileLevel[]) : undefined,
    nodes: (obj.nodes as unknown[]) || [],
    edges: (obj.edges as unknown[]) || [],
    deployables: (obj.deployables as Deployable[]) || [],
    customSchemas: obj.customSchemas as ConstructSchema[],
    portSchemas: obj.portSchemas as PortSchema[],
    schemaGroups: obj.schemaGroups as SchemaGroup[],
    exportedAt: (obj.exportedAt as string) || new Date().toISOString(),
  };
}
