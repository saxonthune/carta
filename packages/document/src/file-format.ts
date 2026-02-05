/**
 * .carta file format types and validation.
 *
 * Platform-agnostic: uses unknown[] for nodes/edges instead of @xyflow/react types.
 * Web-client re-exports these and adds browser-specific import/export functions.
 */

import type { ConstructSchema, PortSchema, SchemaGroup } from '@carta/domain';
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
}

/**
 * Structure of a .carta project file
 */
export interface CartaFile {
  version: number;
  title: string;
  description?: string;
  levels: CartaFileLevel[];
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

  // Require levels array
  if (!Array.isArray(obj.levels) || obj.levels.length === 0) {
    throw new Error('Invalid file: missing or empty levels array');
  }

  if (!Array.isArray(obj.customSchemas)) {
    throw new Error('Invalid file: missing or invalid customSchemas array');
  }

  // Validate levels
  for (const level of obj.levels as unknown[]) {
    if (!level || typeof level !== 'object') {
      throw new Error('Invalid file: invalid level structure');
    }
    const l = level as Record<string, unknown>;
    if (typeof l.id !== 'string' || typeof l.name !== 'string' || typeof l.order !== 'number') {
      throw new Error('Invalid file: level missing required fields (id, name, order)');
    }
    if (!Array.isArray(l.nodes) || !Array.isArray(l.edges)) {
      throw new Error('Invalid file: level missing required arrays (nodes, edges)');
    }
  }

  // Validate nodes across all levels
  const nodesToValidate = (obj.levels as Array<Record<string, unknown>>).flatMap(l => l.nodes as unknown[]);

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
  const edgesToValidate = (obj.levels as Array<Record<string, unknown>>).flatMap(l => l.edges as unknown[]);

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

  // Repair orphaned connections before returning
  const repairedData = repairOrphanedConnections(obj);

  return {
    version: repairedData.version as number,
    title: repairedData.title as string,
    description: (repairedData.description as string | undefined),
    levels: repairedData.levels as CartaFileLevel[],
    customSchemas: repairedData.customSchemas as ConstructSchema[],
    portSchemas: repairedData.portSchemas as PortSchema[],
    schemaGroups: repairedData.schemaGroups as SchemaGroup[],
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

  const nodesToCheck = (obj.levels as Array<Record<string, unknown>>).flatMap(l => l.nodes as unknown[]);

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
  const repairedLevels = (obj.levels as unknown[]).map((level: unknown) => {
    if (!level || typeof level !== 'object') return level;
    const l = level as Record<string, unknown>;
    if (!Array.isArray(l.nodes)) return level;

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
    levels: repairedLevels,
  };
}
