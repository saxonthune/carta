/**
 * Y.Doc mutation operations for MCP HTTP API
 *
 * All operations use 'mcp' as the transaction origin,
 * allowing users to undo AI-made changes.
 */

import * as Y from 'yjs';
import {
  generateSemanticId,
  builtInConstructSchemas,
} from '@carta/domain';
import type {
  CompilerNode,
  CompilerEdge,
  ConstructSchema,
  Deployable,
  ServerDocument,
  ConstructNodeData,
  ConnectionValue,
} from '@carta/domain';
import { CompilerEngine } from '@carta/compiler';

const MCP_ORIGIN = 'mcp';

/**
 * Safely get a value from either a Y.Map or plain object.
 * After certain Yjs operations, data structures may be plain objects
 * rather than Y.Map instances.
 */
function safeGet(value: Y.Map<unknown> | Record<string, unknown> | undefined, key: string): unknown {
  if (!value) return undefined;
  if (value instanceof Y.Map) {
    return value.get(key);
  }
  return (value as Record<string, unknown>)[key];
}

/**
 * Convert a Y.Map to a plain object (shallow)
 */
export function yMapToObject<T>(ymap: Y.Map<unknown>): T {
  const obj: Record<string, unknown> = {};
  ymap.forEach((value, key) => {
    obj[key] = value;
  });
  return obj as T;
}

/**
 * Convert a plain object to a Y.Map (shallow)
 */
export function objectToYMap(obj: Record<string, unknown>): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(obj)) {
    ymap.set(key, value);
  }
  return ymap;
}

/**
 * Deep convert Y structures to plain objects
 */
function deepYToPlain(value: unknown): unknown {
  if (value instanceof Y.Map) {
    const obj: Record<string, unknown> = {};
    value.forEach((v, k) => {
      obj[k] = deepYToPlain(v);
    });
    return obj;
  }
  if (value instanceof Y.Array) {
    return value.toArray().map(deepYToPlain);
  }
  return value;
}

/**
 * Deep convert plain objects to Y structures
 */
function deepPlainToY(value: unknown): unknown {
  if (Array.isArray(value)) {
    const yarr = new Y.Array();
    yarr.push(value.map(deepPlainToY));
    return yarr;
  }
  if (value !== null && typeof value === 'object') {
    const ymap = new Y.Map<unknown>();
    for (const [k, v] of Object.entries(value)) {
      ymap.set(k, deepPlainToY(v));
    }
    return ymap;
  }
  return value;
}

// ===== CONSTRUCT OPERATIONS =====

/**
 * List all constructs in a document
 */
export function listConstructs(ydoc: Y.Doc): CompilerNode[] {
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const nodes: CompilerNode[] = [];

  ynodes.forEach((ynode, id) => {
    const nodeObj = deepYToPlain(ynode) as {
      position: { x: number; y: number };
      data: ConstructNodeData;
      type?: string;
    };
    nodes.push({
      id,
      type: nodeObj.type || 'construct',
      position: nodeObj.position || { x: 0, y: 0 },
      data: nodeObj.data,
    });
  });

  return nodes;
}

/**
 * Get a construct by semantic ID
 */
export function getConstruct(ydoc: Y.Doc, semanticId: string): CompilerNode | null {
  const nodes = listConstructs(ydoc);
  return nodes.find((n) => n.data.semanticId === semanticId) || null;
}

/**
 * Create a new construct
 */
export function createConstruct(
  ydoc: Y.Doc,
  constructType: string,
  values: Record<string, unknown> = {},
  position = { x: 100, y: 100 }
): CompilerNode {
  const semanticId = generateSemanticId(constructType);
  const nodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const nodeData: ConstructNodeData = {
    constructType,
    semanticId,
    values,
    connections: [],
  };

  const node: CompilerNode = {
    id: nodeId,
    type: 'construct',
    position,
    data: nodeData,
  };

  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');

  ydoc.transact(() => {
    const ynode = new Y.Map<unknown>();
    ynode.set('type', node.type);
    ynode.set('position', deepPlainToY(position));
    ynode.set('data', deepPlainToY(nodeData));
    ynodes.set(nodeId, ynode);
  }, MCP_ORIGIN);

  return node;
}

/**
 * Update an existing construct
 */
export function updateConstruct(
  ydoc: Y.Doc,
  semanticId: string,
  updates: { values?: Record<string, unknown>; deployableId?: string | null; instanceColor?: string | null }
): CompilerNode | null {
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');

  // Find the node by semantic ID
  let foundId: string | null = null;
  let foundYnode: Y.Map<unknown> | null = null;

  ynodes.forEach((ynode, id) => {
    const data = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (data && safeGet(data, 'semanticId') === semanticId) {
      foundId = id;
      foundYnode = ynode;
    }
  });

  if (!foundId || !foundYnode) return null;

  ydoc.transact(() => {
    const ydata = foundYnode!.get('data') as Y.Map<unknown>;

    if (updates.values !== undefined) {
      // Merge values
      const existingValues = (ydata.get('values') as Y.Map<unknown>) || new Y.Map();
      const newValues = deepPlainToY(updates.values) as Y.Map<unknown>;

      // Update each value individually
      newValues.forEach((value, key) => {
        existingValues.set(key, value);
      });
      ydata.set('values', existingValues);
    }

    if (updates.deployableId !== undefined) {
      ydata.set('deployableId', updates.deployableId);
    }

    if (updates.instanceColor !== undefined) {
      ydata.set('instanceColor', updates.instanceColor);
    }
  }, MCP_ORIGIN);

  return getConstruct(ydoc, semanticId);
}

/**
 * Delete a construct and its connections
 */
export function deleteConstruct(ydoc: Y.Doc, semanticId: string): boolean {
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yedges = ydoc.getMap<Y.Map<unknown>>('edges');

  // Find the node by semantic ID
  let foundId: string | null = null;

  ynodes.forEach((ynode, id) => {
    const data = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (data && safeGet(data, 'semanticId') === semanticId) {
      foundId = id;
    }
  });

  if (!foundId) return false;

  ydoc.transact(() => {
    // Remove edges connected to this node
    const edgesToDelete: string[] = [];
    yedges.forEach((yedge, edgeId) => {
      if (yedge.get('source') === foundId || yedge.get('target') === foundId) {
        edgesToDelete.push(edgeId);
      }
    });
    for (const edgeId of edgesToDelete) {
      yedges.delete(edgeId);
    }

    // Remove connections referencing this node from other nodes
    ynodes.forEach((ynode) => {
      const ydata = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
      if (ydata) {
        const yconns = safeGet(ydata, 'connections') as Y.Array<unknown> | unknown[] | undefined;
        if (yconns && Array.isArray(yconns)) {
          // Plain array - filter out connections to deleted node
          const filtered = yconns.filter((conn) => {
            const c = conn as Record<string, unknown>;
            return c.targetSemanticId !== semanticId;
          });
          if (ydata instanceof Y.Map) {
            ydata.set('connections', deepPlainToY(filtered));
          }
        } else if (yconns instanceof Y.Array) {
          // Find indices to remove (in reverse to avoid shifting issues)
          const indicesToRemove: number[] = [];
          for (let i = 0; i < yconns.length; i++) {
            const conn = yconns.get(i) as Y.Map<unknown> | Record<string, unknown>;
            if (conn && safeGet(conn, 'targetSemanticId') === semanticId) {
              indicesToRemove.push(i);
            }
          }
          // Remove in reverse order
          for (let i = indicesToRemove.length - 1; i >= 0; i--) {
            yconns.delete(indicesToRemove[i]!, 1);
          }
        }
      }
    });

    // Delete the node
    ynodes.delete(foundId!);
  }, MCP_ORIGIN);

  return true;
}

// ===== CONNECTION OPERATIONS =====

/**
 * Connect two constructs via ports
 */
export function connect(
  ydoc: Y.Doc,
  sourceSemanticId: string,
  sourcePortId: string,
  targetSemanticId: string,
  targetPortId: string
): CompilerEdge | null {
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yedges = ydoc.getMap<Y.Map<unknown>>('edges');

  // Find source and target nodes
  let sourceNodeId: string | null = null;
  let targetNodeId: string | null = null;
  let sourceYdata: Y.Map<unknown> | null = null;

  ynodes.forEach((ynode, id) => {
    const ydata = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (ydata) {
      const sid = safeGet(ydata, 'semanticId');
      if (sid === sourceSemanticId) {
        sourceNodeId = id;
        sourceYdata = ydata as Y.Map<unknown>;
      }
      if (sid === targetSemanticId) {
        targetNodeId = id;
      }
    }
  });

  if (!sourceNodeId || !targetNodeId || !sourceYdata) return null;

  const edgeId = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  ydoc.transact(() => {
    // Create edge
    const yedge = new Y.Map<unknown>();
    yedge.set('source', sourceNodeId);
    yedge.set('target', targetNodeId);
    yedge.set('sourceHandle', sourcePortId);
    yedge.set('targetHandle', targetPortId);
    yedges.set(edgeId, yedge);

    // Add connection to source node
    let yconns = sourceYdata!.get('connections') as Y.Array<unknown> | undefined;
    if (!yconns) {
      yconns = new Y.Array();
      sourceYdata!.set('connections', yconns);
    }

    const connectionData: ConnectionValue = {
      portId: sourcePortId,
      targetSemanticId,
      targetPortId,
    };
    yconns.push([deepPlainToY(connectionData)]);
  }, MCP_ORIGIN);

  return {
    id: edgeId,
    source: sourceNodeId,
    target: targetNodeId,
    sourceHandle: sourcePortId,
    targetHandle: targetPortId,
  };
}

/**
 * Disconnect two constructs
 */
export function disconnect(
  ydoc: Y.Doc,
  sourceSemanticId: string,
  sourcePortId: string,
  targetSemanticId: string
): boolean {
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yedges = ydoc.getMap<Y.Map<unknown>>('edges');

  // Find source and target node IDs
  let sourceNodeId: string | null = null;
  let targetNodeId: string | null = null;
  let sourceYdata: Y.Map<unknown> | null = null;

  ynodes.forEach((ynode, id) => {
    const ydata = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (ydata) {
      const sid = safeGet(ydata, 'semanticId');
      if (sid === sourceSemanticId) {
        sourceNodeId = id;
        sourceYdata = ydata as Y.Map<unknown>;
      }
      if (sid === targetSemanticId) {
        targetNodeId = id;
      }
    }
  });

  if (!sourceNodeId || !sourceYdata) return false;

  ydoc.transact(() => {
    // Remove connection from source node
    const yconns = safeGet(sourceYdata!, 'connections') as Y.Array<unknown> | unknown[] | undefined;
    if (yconns instanceof Y.Array) {
      for (let i = yconns.length - 1; i >= 0; i--) {
        const conn = yconns.get(i) as Y.Map<unknown> | Record<string, unknown>;
        if (
          conn &&
          safeGet(conn, 'portId') === sourcePortId &&
          safeGet(conn, 'targetSemanticId') === targetSemanticId
        ) {
          yconns.delete(i, 1);
          break;
        }
      }
    } else if (Array.isArray(yconns)) {
      // Plain array - filter and replace
      const filtered = yconns.filter((conn) => {
        const c = conn as Record<string, unknown>;
        return !(c.portId === sourcePortId && c.targetSemanticId === targetSemanticId);
      });
      if (sourceYdata instanceof Y.Map) {
        sourceYdata.set('connections', deepPlainToY(filtered));
      }
    }

    // Remove corresponding edge
    if (targetNodeId) {
      const edgesToDelete: string[] = [];
      yedges.forEach((yedge, edgeId) => {
        if (
          yedge.get('source') === sourceNodeId &&
          yedge.get('target') === targetNodeId &&
          yedge.get('sourceHandle') === sourcePortId
        ) {
          edgesToDelete.push(edgeId);
        }
      });
      for (const edgeId of edgesToDelete) {
        yedges.delete(edgeId);
      }
    }
  }, MCP_ORIGIN);

  return true;
}

// ===== SCHEMA OPERATIONS =====

/**
 * List all schemas (built-in + custom)
 */
export function listSchemas(ydoc: Y.Doc): ConstructSchema[] {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const schemas = [...builtInConstructSchemas];

  // Add custom schemas from document
  yschemas.forEach((yschema) => {
    const schema = deepYToPlain(yschema) as ConstructSchema;
    // Only add if not already a built-in
    if (!schemas.some(s => s.type === schema.type)) {
      schemas.push(schema);
    }
  });

  return schemas;
}

/**
 * Get a schema by type
 */
export function getSchema(ydoc: Y.Doc, type: string): ConstructSchema | null {
  // Check built-in first
  const builtIn = builtInConstructSchemas.find((s) => s.type === type);
  if (builtIn) return builtIn;

  // Check custom schemas
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yschema = yschemas.get(type);
  if (yschema) {
    return deepYToPlain(yschema) as ConstructSchema;
  }

  return null;
}

/**
 * Apply smart defaults to a schema for better UX
 */
function applySchemaDefaults(schema: any): any {
  const processed = { ...schema };

  // Auto-detect primary fields and set displayTier
  const primaryFieldNames = ['name', 'title', 'label', 'summary', 'condition'];
  if (Array.isArray(processed.fields)) {
    processed.fields = processed.fields.map((field: any) => {
      if (primaryFieldNames.includes(field.name.toLowerCase()) && field.displayTier === undefined) {
        return { ...field, displayTier: 'minimal' };
      }
      return field;
    });
  }

  // Add default ports if none specified
  if (!processed.ports || processed.ports.length === 0) {
    processed.ports = [
      { id: 'flow-in', portType: 'flow-in', position: 'left', offset: 50, label: 'In' },
      { id: 'flow-out', portType: 'flow-out', position: 'right', offset: 50, label: 'Out' },
      { id: 'parent', portType: 'parent', position: 'bottom', offset: 50, label: 'Children' },
      { id: 'child', portType: 'child', position: 'top', offset: 50, label: 'Parent' },
    ] as any;
  }

  return processed;
}

/**
 * Create a custom schema
 */
export function createSchema(ydoc: Y.Doc, schema: ConstructSchema): ConstructSchema | null {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');

  // Check if already exists
  if (yschemas.has(schema.type)) return null;

  // Apply smart defaults
  const processedSchema = applySchemaDefaults(schema);

  ydoc.transact(() => {
    yschemas.set(processedSchema.type, deepPlainToY(processedSchema) as Y.Map<unknown>);
  }, MCP_ORIGIN);

  return processedSchema;
}

/**
 * Remove a custom schema
 */
export function removeSchema(ydoc: Y.Doc, type: string): boolean {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');

  if (!yschemas.has(type)) return false;

  ydoc.transact(() => {
    yschemas.delete(type);
  }, MCP_ORIGIN);

  return true;
}

// ===== DEPLOYABLE OPERATIONS =====

/**
 * List all deployables
 */
export function listDeployables(ydoc: Y.Doc): Deployable[] {
  const ydeployables = ydoc.getMap<Y.Map<unknown>>('deployables');
  const deployables: Deployable[] = [];

  ydeployables.forEach((ydeployable) => {
    deployables.push(deepYToPlain(ydeployable) as Deployable);
  });

  return deployables;
}

/**
 * Create a deployable
 */
export function createDeployable(
  ydoc: Y.Doc,
  name: string,
  description: string,
  color?: string
): Deployable {
  const ydeployables = ydoc.getMap<Y.Map<unknown>>('deployables');

  const deployable: Deployable = {
    id: `dep_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    name,
    description,
    color: color || generateColor(),
  };

  ydoc.transact(() => {
    ydeployables.set(deployable.id, deepPlainToY(deployable) as Y.Map<unknown>);
  }, MCP_ORIGIN);

  return deployable;
}

function generateColor(): string {
  const colors = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#84cc16',
    '#f97316',
    '#ec4899',
    '#6b7280',
  ];
  return colors[Math.floor(Math.random() * colors.length)] || '#3b82f6';
}

// ===== COMPILATION =====

/**
 * Compile document to AI-readable output
 */
export function compile(ydoc: Y.Doc): string {
  const nodes = listConstructs(ydoc);
  const schemas = listSchemas(ydoc);
  const deployables = listDeployables(ydoc);

  // Get edges
  const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
  const edges: CompilerEdge[] = [];
  yedges.forEach((yedge, id) => {
    edges.push({
      id,
      source: yedge.get('source') as string,
      target: yedge.get('target') as string,
      sourceHandle: yedge.get('sourceHandle') as string | undefined,
      targetHandle: yedge.get('targetHandle') as string | undefined,
    });
  });

  const compilerEngine = new CompilerEngine();
  return compilerEngine.compile(nodes, edges, { schemas, deployables });
}

// ===== DOCUMENT EXTRACTION =====

/**
 * Extract full CartaDocument from Y.Doc
 */
/** Current server document format version */
const SERVER_FORMAT_VERSION = 4;

export function extractDocument(ydoc: Y.Doc, roomId: string): ServerDocument {
  const ymeta = ydoc.getMap('meta');
  const nodes = listConstructs(ydoc);
  const schemas = listSchemas(ydoc);
  const deployables = listDeployables(ydoc);

  // Get edges
  const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
  const edges: CompilerEdge[] = [];
  yedges.forEach((yedge, id) => {
    edges.push({
      id,
      source: yedge.get('source') as string,
      target: yedge.get('target') as string,
      sourceHandle: yedge.get('sourceHandle') as string | undefined,
      targetHandle: yedge.get('targetHandle') as string | undefined,
    });
  });

  const now = new Date().toISOString();

  // Only include custom schemas (filter out built-ins)
  const builtInTypes = new Set(builtInConstructSchemas.map((s) => s.type));
  const customSchemas = schemas.filter((s) => !builtInTypes.has(s.type));

  return {
    id: roomId,
    title: (ymeta.get('title') as string) || 'Untitled Project',
    version: (ymeta.get('version') as number) || 3,
    formatVersion: SERVER_FORMAT_VERSION,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    deployables,
    customSchemas,
  };
}
