/**
 * Y.Doc mutation operations for MCP HTTP API
 *
 * All operations use 'mcp' as the transaction origin,
 * allowing users to undo AI-made changes.
 */

import * as Y from 'yjs';
import {
  generateSemanticId,
  createSchemaRegistry,
  createCompiler,
  builtInSchemas,
  CURRENT_FORMAT_VERSION,
} from '@carta/core';
import type {
  CartaNode,
  CartaEdge,
  ConstructSchema,
  Deployable,
  CartaDocument,
  ConstructInstance,
  ConnectionValue,
} from '@carta/core';

const MCP_ORIGIN = 'mcp';

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
export function listConstructs(ydoc: Y.Doc): CartaNode[] {
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const nodes: CartaNode[] = [];

  ynodes.forEach((ynode, id) => {
    const nodeObj = deepYToPlain(ynode) as {
      position: { x: number; y: number };
      data: ConstructInstance;
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
export function getConstruct(ydoc: Y.Doc, semanticId: string): CartaNode | null {
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
): CartaNode {
  const semanticId = generateSemanticId(constructType);
  const nodeId = `node_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const nodeData: ConstructInstance = {
    constructType,
    semanticId,
    values,
    connections: [],
  };

  const node: CartaNode = {
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
  updates: { values?: Record<string, unknown>; deployableId?: string | null }
): CartaNode | null {
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');

  // Find the node by semantic ID
  let foundId: string | null = null;
  let foundYnode: Y.Map<unknown> | null = null;

  ynodes.forEach((ynode, id) => {
    const data = ynode.get('data') as Y.Map<unknown> | undefined;
    if (data && data.get('semanticId') === semanticId) {
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
    const data = ynode.get('data') as Y.Map<unknown> | undefined;
    if (data && data.get('semanticId') === semanticId) {
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
      const ydata = ynode.get('data') as Y.Map<unknown> | undefined;
      if (ydata) {
        const yconns = ydata.get('connections') as Y.Array<Y.Map<unknown>> | undefined;
        if (yconns) {
          // Find indices to remove (in reverse to avoid shifting issues)
          const indicesToRemove: number[] = [];
          for (let i = 0; i < yconns.length; i++) {
            const conn = yconns.get(i) as Y.Map<unknown>;
            if (conn && conn.get('targetSemanticId') === semanticId) {
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
): CartaEdge | null {
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yedges = ydoc.getMap<Y.Map<unknown>>('edges');

  // Find source and target nodes
  let sourceNodeId: string | null = null;
  let targetNodeId: string | null = null;
  let sourceYdata: Y.Map<unknown> | null = null;

  ynodes.forEach((ynode, id) => {
    const ydata = ynode.get('data') as Y.Map<unknown> | undefined;
    if (ydata) {
      const sid = ydata.get('semanticId');
      if (sid === sourceSemanticId) {
        sourceNodeId = id;
        sourceYdata = ydata;
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
    const ydata = ynode.get('data') as Y.Map<unknown> | undefined;
    if (ydata) {
      const sid = ydata.get('semanticId');
      if (sid === sourceSemanticId) {
        sourceNodeId = id;
        sourceYdata = ydata;
      }
      if (sid === targetSemanticId) {
        targetNodeId = id;
      }
    }
  });

  if (!sourceNodeId || !sourceYdata) return false;

  ydoc.transact(() => {
    // Remove connection from source node
    const yconns = sourceYdata!.get('connections') as Y.Array<Y.Map<unknown>> | undefined;
    if (yconns) {
      for (let i = yconns.length - 1; i >= 0; i--) {
        const conn = yconns.get(i) as Y.Map<unknown>;
        if (
          conn &&
          conn.get('portId') === sourcePortId &&
          conn.get('targetSemanticId') === targetSemanticId
        ) {
          yconns.delete(i, 1);
          break;
        }
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
  const registry = createSchemaRegistry();

  // Add custom schemas from document
  yschemas.forEach((yschema) => {
    const schema = deepYToPlain(yschema) as ConstructSchema;
    registry.register(schema);
  });

  return registry.getAll();
}

/**
 * Get a schema by type
 */
export function getSchema(ydoc: Y.Doc, type: string): ConstructSchema | null {
  // Check built-in first
  const builtIn = builtInSchemas.find((s) => s.type === type);
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
 * Create a custom schema
 */
export function createSchema(ydoc: Y.Doc, schema: ConstructSchema): ConstructSchema | null {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');

  // Check if already exists
  if (yschemas.has(schema.type)) return null;

  ydoc.transact(() => {
    yschemas.set(schema.type, deepPlainToY(schema) as Y.Map<unknown>);
  }, MCP_ORIGIN);

  return schema;
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
  const edges: CartaEdge[] = [];
  yedges.forEach((yedge, id) => {
    edges.push({
      id,
      source: yedge.get('source') as string,
      target: yedge.get('target') as string,
      sourceHandle: yedge.get('sourceHandle') as string | undefined,
      targetHandle: yedge.get('targetHandle') as string | undefined,
    });
  });

  // Create schema registry
  const schemaRegistry = createSchemaRegistry();
  for (const schema of schemas) {
    // Only register if not already built-in
    const existing = schemaRegistry.get(schema.type);
    if (!existing) {
      schemaRegistry.register(schema);
    }
  }

  const deployableProvider = {
    getAll: () => deployables,
    get: (id: string) => deployables.find((d) => d.id === id),
  };

  const compiler = createCompiler({
    schemaRegistry,
    deployableProvider,
  });

  return compiler.compile(nodes, edges);
}

// ===== DOCUMENT EXTRACTION =====

/**
 * Extract full CartaDocument from Y.Doc
 */
export function extractDocument(ydoc: Y.Doc, roomId: string): CartaDocument {
  const ymeta = ydoc.getMap('meta');
  const nodes = listConstructs(ydoc);
  const schemas = listSchemas(ydoc);
  const deployables = listDeployables(ydoc);

  // Get edges
  const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
  const edges: CartaEdge[] = [];
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
  const builtInTypes = new Set(builtInSchemas.map((s) => s.type));
  const customSchemas = schemas.filter((s) => !builtInTypes.has(s.type));

  return {
    id: roomId,
    title: (ymeta.get('title') as string) || 'Untitled Project',
    version: (ymeta.get('version') as number) || 3,
    formatVersion: CURRENT_FORMAT_VERSION,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    deployables,
    customSchemas,
  };
}
