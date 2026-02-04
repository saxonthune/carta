/**
 * .carta file format types and validation.
 *
 * Platform-agnostic: uses unknown[] for nodes/edges instead of @xyflow/react types.
 * Web-client re-exports these and adds browser-specific import/export functions.
 */

import type { Deployable, ConstructSchema, PortSchema, SchemaGroup, VisualGroup } from '@carta/domain';
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
  deployables: Deployable[];      // v5 and earlier
  visualGroups?: VisualGroup[];    // v6+
}

/**
 * Structure of a .carta project file (v6 with visualGroups)
 */
export interface CartaFile {
  version: number;
  title: string;
  description?: string;
  // V5+: levels contain nodes/edges/deployables/visualGroups
  levels?: CartaFileLevel[];
  // V4 and earlier: flat nodes/edges/deployables (for backwards compat on import)
  nodes: unknown[];
  edges: unknown[];
  deployables: Deployable[];
  customSchemas: ConstructSchema[];
  portSchemas: PortSchema[];
  schemaGroups: SchemaGroup[];
  // V6+: metamap visual groups (for schema grouping in Metamap view)
  metamapVisualGroups?: VisualGroup[];
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
    // Allow missing schemaGroups for v6+ files that use metamapVisualGroups instead
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

  // Validate visualGroups in levels if present (v6+)
  if (hasLevels) {
    for (const level of obj.levels as unknown[]) {
      const l = level as Record<string, unknown>;
      if (Array.isArray(l.visualGroups)) {
        for (const vg of l.visualGroups as unknown[]) {
          validateVisualGroup(vg);
        }
      }
    }
  }

  // Validate metamapVisualGroups if present (v6+)
  if (Array.isArray(obj.metamapVisualGroups)) {
    for (const vg of obj.metamapVisualGroups as unknown[]) {
      validateVisualGroup(vg);
    }
  }

  // Repair orphaned connections before returning
  const repairedData = repairOrphanedConnections(obj, hasLevels);

  return {
    version: repairedData.version as number,
    title: repairedData.title as string,
    description: (repairedData.description as string | undefined),
    levels: hasLevels ? (repairedData.levels as CartaFileLevel[]) : undefined,
    nodes: (repairedData.nodes as unknown[]) || [],
    edges: (repairedData.edges as unknown[]) || [],
    deployables: (repairedData.deployables as Deployable[]) || [],
    customSchemas: repairedData.customSchemas as ConstructSchema[],
    portSchemas: repairedData.portSchemas as PortSchema[],
    schemaGroups: repairedData.schemaGroups as SchemaGroup[],
    metamapVisualGroups: (repairedData.metamapVisualGroups as VisualGroup[]) || undefined,
    exportedAt: (repairedData.exportedAt as string) || new Date().toISOString(),
  };
}

/**
 * Validate a VisualGroup structure
 */
function validateVisualGroup(vg: unknown): void {
  if (!vg || typeof vg !== 'object') {
    throw new Error('Invalid file: invalid visualGroup structure');
  }
  const g = vg as Record<string, unknown>;
  if (typeof g.id !== 'string' || typeof g.name !== 'string') {
    throw new Error(`Invalid file: visualGroup missing required fields (id, name)`);
  }
  if (typeof g.collapsed !== 'boolean') {
    throw new Error(`Invalid file: visualGroup "${g.id}" missing required field (collapsed)`);
  }
  if (g.parentGroupId !== undefined && typeof g.parentGroupId !== 'string') {
    throw new Error(`Invalid file: visualGroup "${g.id}" has invalid parentGroupId (must be string)`);
  }
  if (g.position !== undefined) {
    if (typeof g.position !== 'object' || g.position === null) {
      throw new Error(`Invalid file: visualGroup "${g.id}" has invalid position`);
    }
    const pos = g.position as Record<string, unknown>;
    if (typeof pos.x !== 'number' || typeof pos.y !== 'number') {
      throw new Error(`Invalid file: visualGroup "${g.id}" position must have numeric x and y`);
    }
  }
  if (g.size !== undefined) {
    if (typeof g.size !== 'object' || g.size === null) {
      throw new Error(`Invalid file: visualGroup "${g.id}" has invalid size`);
    }
    const size = g.size as Record<string, unknown>;
    if (typeof size.width !== 'number' || typeof size.height !== 'number') {
      throw new Error(`Invalid file: visualGroup "${g.id}" size must have numeric width and height`);
    }
  }
}

/**
 * Repair orphaned connections in a .carta file.
 * Removes connections that reference non-existent nodes.
 */
function repairOrphanedConnections(
  obj: Record<string, unknown>,
  hasLevels: boolean
): Record<string, unknown> {
  // Build set of all valid semantic IDs
  const validSemanticIds = new Set<string>();

  const nodesToCheck = hasLevels
    ? (obj.levels as Array<Record<string, unknown>>).flatMap(l => l.nodes as unknown[])
    : obj.nodes as unknown[];

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

  // Repair connections in all nodes
  if (hasLevels && Array.isArray(obj.levels)) {
    const repairedLevels = obj.levels.map((level: unknown) => {
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
  } else {
    // Flat structure
    if (!Array.isArray(obj.nodes)) return obj;

    const repairedNodes = obj.nodes.map((node: unknown) => {
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
      ...obj,
      nodes: repairedNodes,
    };
  }
}
