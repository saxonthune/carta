/**
 * Y.Doc mutation operations for Carta documents.
 *
 * Level-aware: construct/edge operations take a `levelId` parameter.
 * Schema operations are shared across levels.
 *
 * All operations use 'mcp' as the transaction origin,
 * allowing users to undo AI-made changes.
 */

import * as Y from 'yjs';
import {
  generateSemanticId,
  builtInConstructSchemas,
  toAbsolutePosition,
  toRelativePosition,
} from '@carta/domain';
import type {
  CompilerNode,
  CompilerEdge,
  ConstructSchema,
  ServerDocument,
  ConstructNodeData,
  ConnectionValue,
  OrganizerNodeData,
  OrganizerLayout,
} from '@carta/domain';
import { CompilerEngine } from '@carta/compiler';
import { yToPlain, deepPlainToY, safeGet } from './yjs-helpers.js';
import { generateNodeId, generateLevelId } from './id-generators.js';
import { MCP_ORIGIN, SERVER_FORMAT_VERSION } from './constants.js';

/**
 * Get or create a level-scoped Y.Map inside a container map.
 */
function getLevelMap(ydoc: Y.Doc, mapName: string, levelId: string): Y.Map<Y.Map<unknown>> {
  const container = ydoc.getMap<Y.Map<unknown>>(mapName);
  let levelMap = container.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
  if (!levelMap) {
    levelMap = new Y.Map();
    container.set(levelId, levelMap as unknown as Y.Map<unknown>);
  }
  return levelMap;
}

// ===== LEVEL OPERATIONS =====

export interface LevelInfo {
  id: string;
  name: string;
  description?: string;
  order: number;
}

/**
 * List all levels in a document
 */
export function listLevels(ydoc: Y.Doc): LevelInfo[] {
  const ylevels = ydoc.getMap<Y.Map<unknown>>('levels');
  const levels: LevelInfo[] = [];

  ylevels.forEach((ylevel, id) => {
    levels.push({
      id,
      name: (ylevel.get('name') as string) ?? 'Untitled',
      description: ylevel.get('description') as string | undefined,
      order: (ylevel.get('order') as number) ?? 0,
    });
  });

  levels.sort((a, b) => a.order - b.order);
  return levels;
}

/**
 * Get the active level ID for a document
 */
export function getActiveLevel(ydoc: Y.Doc): string {
  const ymeta = ydoc.getMap('meta');
  const active = ymeta.get('activeLevel') as string | undefined;
  if (active) return active;

  // Fallback: first level by order
  const levels = listLevels(ydoc);
  return levels[0]?.id ?? '';
}

/**
 * Set the active level for a document
 */
export function setActiveLevel(ydoc: Y.Doc, levelId: string): void {
  const ylevels = ydoc.getMap<Y.Map<unknown>>('levels');
  if (!ylevels.has(levelId)) {
    throw new Error(`Level not found: ${levelId}`);
  }

  ydoc.transact(() => {
    ydoc.getMap('meta').set('activeLevel', levelId);
  }, MCP_ORIGIN);
}

/**
 * Create a new level in a document
 */
export function createLevel(ydoc: Y.Doc, name: string, description?: string): LevelInfo {
  const levelId = generateLevelId();
  const ylevels = ydoc.getMap<Y.Map<unknown>>('levels');

  // Determine next order value
  let maxOrder = -1;
  ylevels.forEach((ylevel) => {
    const order = (ylevel.get('order') as number) ?? 0;
    if (order > maxOrder) maxOrder = order;
  });

  const order = maxOrder + 1;

  ydoc.transact(() => {
    const levelData = new Y.Map<unknown>();
    levelData.set('id', levelId);
    levelData.set('name', name);
    if (description) levelData.set('description', description);
    levelData.set('order', order);
    ylevels.set(levelId, levelData);
  }, MCP_ORIGIN);

  return { id: levelId, name, description, order };
}

/**
 * Update level metadata
 */
export function updateLevel(
  ydoc: Y.Doc,
  levelId: string,
  updates: { name?: string; description?: string; order?: number }
): LevelInfo | null {
  const ylevels = ydoc.getMap<Y.Map<unknown>>('levels');
  const ylevel = ylevels.get(levelId);
  if (!ylevel) return null;

  ydoc.transact(() => {
    if (updates.name !== undefined) ylevel.set('name', updates.name);
    if (updates.description !== undefined) ylevel.set('description', updates.description);
    if (updates.order !== undefined) ylevel.set('order', updates.order);
  }, MCP_ORIGIN);

  return {
    id: levelId,
    name: (ylevel.get('name') as string) ?? 'Untitled',
    description: ylevel.get('description') as string | undefined,
    order: (ylevel.get('order') as number) ?? 0,
  };
}

/**
 * Delete a level (must have more than one level)
 */
export function deleteLevel(ydoc: Y.Doc, levelId: string): boolean {
  const ylevels = ydoc.getMap<Y.Map<unknown>>('levels');
  if (!ylevels.has(levelId)) return false;
  if (ylevels.size <= 1) return false;

  ydoc.transact(() => {
    ylevels.delete(levelId);

    // Clean up level-scoped nodes and edges
    const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
    if (ynodes.has(levelId)) ynodes.delete(levelId);
    if (yedges.has(levelId)) yedges.delete(levelId);

    // If this was the active level, switch to the first remaining level
    const ymeta = ydoc.getMap('meta');
    if (ymeta.get('activeLevel') === levelId) {
      let firstId: string | undefined;
      let firstOrder = Infinity;
      ylevels.forEach((yl, id) => {
        const order = (yl.get('order') as number) ?? 0;
        if (order < firstOrder) { firstOrder = order; firstId = id; }
      });
      if (firstId) ymeta.set('activeLevel', firstId);
    }
  }, MCP_ORIGIN);

  return true;
}

// ===== CONSTRUCT OPERATIONS =====

/**
 * List all constructs in a document level
 */
export function listConstructs(
  ydoc: Y.Doc,
  levelId: string,
  options?: { constructType?: string }
): CompilerNode[] {
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
  const nodes: CompilerNode[] = [];

  levelNodes.forEach((ynode, id) => {
    const nodeObj = yToPlain(ynode) as {
      position: { x: number; y: number };
      data: ConstructNodeData;
      type?: string;
      parentId?: string;
    };

    // Filter by constructType if requested
    if (options?.constructType && nodeObj.data?.constructType !== options.constructType) return;

    nodes.push({
      id,
      type: nodeObj.type || 'construct',
      position: nodeObj.position || { x: 0, y: 0 },
      data: nodeObj.data,
      parentId: nodeObj.parentId,
    });
  });

  return nodes;
}

/**
 * Get a construct by semantic ID within a level
 */
export function getConstruct(ydoc: Y.Doc, levelId: string, semanticId: string): CompilerNode | null {
  const nodes = listConstructs(ydoc, levelId);
  return nodes.find((n) => n.data.semanticId === semanticId) || null;
}

/**
 * Create a new construct in a level.
 * When parentId is provided, position is relative to the parent organizer.
 */
export function createConstruct(
  ydoc: Y.Doc,
  levelId: string,
  constructType: string,
  values: Record<string, unknown> = {},
  position = { x: 100, y: 100 },
  parentId?: string
): CompilerNode {
  const semanticId = generateSemanticId(constructType);
  const nodeId = generateNodeId();

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
    parentId,
  };

  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);

  ydoc.transact(() => {
    const ynode = new Y.Map<unknown>();
    ynode.set('type', node.type);
    ynode.set('position', deepPlainToY(position));
    ynode.set('data', deepPlainToY(nodeData));
    if (parentId) ynode.set('parentId', parentId);
    levelNodes.set(nodeId, ynode as Y.Map<unknown>);
  }, MCP_ORIGIN);

  return node;
}

/**
 * Update an existing construct within a level
 */
export function updateConstruct(
  ydoc: Y.Doc,
  levelId: string,
  semanticId: string,
  updates: { values?: Record<string, unknown>; instanceColor?: string | null }
): CompilerNode | null {
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);

  // Find the node by semantic ID
  let foundId: string | null = null;
  let foundYnode: Y.Map<unknown> | null = null;

  levelNodes.forEach((ynode, id) => {
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

    if (updates.instanceColor !== undefined) {
      ydata.set('instanceColor', updates.instanceColor);
    }
  }, MCP_ORIGIN);

  return getConstruct(ydoc, levelId, semanticId);
}

/**
 * Delete a construct and its connections within a level
 */
export function deleteConstruct(ydoc: Y.Doc, levelId: string, semanticId: string): boolean {
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
  const levelEdges = getLevelMap(ydoc, 'edges', levelId);

  // Find the node by semantic ID
  let foundId: string | null = null;

  levelNodes.forEach((ynode, id) => {
    const data = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (data && safeGet(data, 'semanticId') === semanticId) {
      foundId = id;
    }
  });

  if (!foundId) return false;

  ydoc.transact(() => {
    // Find and delete attached wagons (organizers where attachedToSemanticId === this construct's semanticId)
    const wagonIds: string[] = [];
    levelNodes.forEach((ynode, id) => {
      const nodeObj = yToPlain(ynode) as Record<string, unknown>;
      if (nodeObj.type !== 'organizer') return;
      const data = nodeObj.data as OrganizerNodeData;
      if (data.attachedToSemanticId === semanticId) {
        wagonIds.push(id);
      }
    });

    for (const wagonId of wagonIds) {
      const wagonYnode = levelNodes.get(wagonId);
      if (!wagonYnode) continue;
      const wagonPos = yToPlain(wagonYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };

      // Detach wagon members: convert to absolute positions
      const memberIds: string[] = [];
      levelNodes.forEach((childYnode, childId) => {
        if (childId === wagonId) return;
        const parentId = childYnode.get('parentId') as string | undefined;
        if (parentId === wagonId) {
          memberIds.push(childId);
        }
      });

      for (const memberId of memberIds) {
        const memberYnode = levelNodes.get(memberId);
        if (!memberYnode) continue;
        const memberPos = yToPlain(memberYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
        const absolutePos = toAbsolutePosition(memberPos, wagonPos);
        memberYnode.set('position', deepPlainToY(absolutePos));
        memberYnode.delete('parentId');
      }

      // Remove edges connected to the wagon
      levelEdges.forEach((yedge, edgeId) => {
        if (yedge.get('source') === wagonId || yedge.get('target') === wagonId) {
          levelEdges.delete(edgeId);
        }
      });

      levelNodes.delete(wagonId);
    }

    // Remove edges connected to this node
    const edgesToDelete: string[] = [];
    levelEdges.forEach((yedge, edgeId) => {
      if (yedge.get('source') === foundId || yedge.get('target') === foundId) {
        edgesToDelete.push(edgeId);
      }
    });
    for (const edgeId of edgesToDelete) {
      levelEdges.delete(edgeId);
    }

    // Remove connections referencing this node from other nodes
    levelNodes.forEach((ynode) => {
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
    levelNodes.delete(foundId!);
  }, MCP_ORIGIN);

  return true;
}

/**
 * Move a construct into/out of an organizer, auto-converting between absolute and relative positions.
 * - parentId=null: detach from current organizer (relative → absolute)
 * - parentId="org_id": attach to organizer (absolute → relative)
 * - position overrides are applied after conversion
 */
export function moveConstruct(
  ydoc: Y.Doc,
  levelId: string,
  semanticId: string,
  targetParentId: string | null,
  position?: { x: number; y: number }
): CompilerNode | null {
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);

  // Find the node by semantic ID
  let foundId: string | null = null;
  let foundYnode: Y.Map<unknown> | null = null;

  levelNodes.forEach((ynode, id) => {
    const data = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (data && safeGet(data, 'semanticId') === semanticId) {
      foundId = id;
      foundYnode = ynode;
    }
  });

  if (!foundId || !foundYnode) return null;

  const currentParentId = (foundYnode as Y.Map<unknown>).get('parentId') as string | undefined;

  // Validate target organizer exists if attaching
  if (targetParentId !== null) {
    const targetOrg = levelNodes.get(targetParentId);
    if (!targetOrg) return null;
    const orgObj = yToPlain(targetOrg) as Record<string, unknown>;
    if (orgObj.type !== 'organizer') return null;
  }

  ydoc.transact(() => {
    const ynode = foundYnode!;
    const currentPos = yToPlain(ynode.get('position') as Y.Map<unknown>) as { x: number; y: number };

    let newPos: { x: number; y: number };

    if (position) {
      // Explicit position provided — use it directly
      newPos = position;
    } else if (currentParentId && !targetParentId) {
      // Detaching: convert relative → absolute
      const parentYnode = levelNodes.get(currentParentId);
      if (parentYnode) {
        const parentPos = yToPlain(parentYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
        newPos = toAbsolutePosition(currentPos, parentPos);
      } else {
        newPos = currentPos;
      }
    } else if (!currentParentId && targetParentId) {
      // Attaching: convert absolute → relative
      const parentYnode = levelNodes.get(targetParentId);
      if (parentYnode) {
        const parentPos = yToPlain(parentYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
        newPos = toRelativePosition(currentPos, parentPos);
      } else {
        newPos = currentPos;
      }
    } else if (currentParentId && targetParentId && currentParentId !== targetParentId) {
      // Moving between organizers: relative-to-old → absolute → relative-to-new
      const oldParent = levelNodes.get(currentParentId);
      const newParent = levelNodes.get(targetParentId);
      if (oldParent && newParent) {
        const oldParentPos = yToPlain(oldParent.get('position') as Y.Map<unknown>) as { x: number; y: number };
        const newParentPos = yToPlain(newParent.get('position') as Y.Map<unknown>) as { x: number; y: number };
        const absPos = toAbsolutePosition(currentPos, oldParentPos);
        newPos = toRelativePosition(absPos, newParentPos);
      } else {
        newPos = currentPos;
      }
    } else {
      // Same parent (or both null) — keep position
      newPos = currentPos;
    }

    ynode.set('position', deepPlainToY(newPos));

    if (targetParentId) {
      ynode.set('parentId', targetParentId);
    } else {
      ynode.delete('parentId');
    }
  }, MCP_ORIGIN);

  return getConstruct(ydoc, levelId, semanticId);
}

// ===== ORGANIZER OPERATIONS =====

export interface OrganizerInfo {
  id: string;
  name: string;
  color: string;
  position: { x: number; y: number };
  width: number;
  height: number;
  layout: OrganizerLayout;
  collapsed: boolean;
  description?: string;
  attachedToSemanticId?: string;
}

/**
 * List all organizers in a document level
 */
export function listOrganizers(ydoc: Y.Doc, levelId: string): OrganizerInfo[] {
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
  const organizers: OrganizerInfo[] = [];

  levelNodes.forEach((ynode, id) => {
    const nodeObj = yToPlain(ynode) as Record<string, unknown>;
    if (nodeObj.type !== 'organizer') return;

    const data = nodeObj.data as OrganizerNodeData;
    const style = nodeObj.style as Record<string, unknown> | undefined;
    const position = (nodeObj.position as { x: number; y: number }) || { x: 0, y: 0 };

    organizers.push({
      id,
      name: data.name ?? '',
      color: data.color ?? '#6b7280',
      position,
      width: (style?.width as number) ?? 400,
      height: (style?.height as number) ?? 300,
      layout: data.layout ?? 'freeform',
      collapsed: data.collapsed ?? false,
      description: data.description,
      attachedToSemanticId: data.attachedToSemanticId as string | undefined,
    });
  });

  return organizers;
}

const ORGANIZER_PALETTE = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626'];

/**
 * Create an organizer node in a level
 */
export function createOrganizer(
  ydoc: Y.Doc,
  levelId: string,
  options: {
    name: string;
    color?: string;
    position?: { x: number; y: number };
    width?: number;
    height?: number;
    layout?: OrganizerLayout;
    description?: string;
    attachedToSemanticId?: string;
    parentId?: string;
  }
): OrganizerInfo {
  const nodeId = generateNodeId();
  const color = options.color || ORGANIZER_PALETTE[Math.floor(Math.random() * ORGANIZER_PALETTE.length)]!;
  const position = options.position || { x: 100, y: 100 };
  const width = options.width || 400;
  const height = options.height || 300;
  const layout: OrganizerLayout = options.layout || 'freeform';

  const data: OrganizerNodeData = {
    isOrganizer: true,
    name: options.name,
    color,
    collapsed: false,
    layout,
    description: options.description,
    attachedToSemanticId: options.attachedToSemanticId,
  };

  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);

  ydoc.transact(() => {
    const ynode = new Y.Map<unknown>();
    ynode.set('type', 'organizer');
    ynode.set('position', deepPlainToY(position));
    ynode.set('data', deepPlainToY(data));
    ynode.set('style', deepPlainToY({ width, height }));
    if (options.parentId) ynode.set('parentId', options.parentId);
    levelNodes.set(nodeId, ynode as Y.Map<unknown>);
  }, MCP_ORIGIN);

  return { id: nodeId, name: options.name, color, position, width, height, layout, collapsed: false, description: options.description, attachedToSemanticId: options.attachedToSemanticId };
}

/**
 * Update an organizer node
 */
export function updateOrganizer(
  ydoc: Y.Doc,
  levelId: string,
  organizerId: string,
  updates: {
    name?: string;
    color?: string;
    collapsed?: boolean;
    layout?: OrganizerLayout;
    description?: string;
    attachedToSemanticId?: string;
  }
): OrganizerInfo | null {
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
  const ynode = levelNodes.get(organizerId);
  if (!ynode) return null;

  const nodeObj = yToPlain(ynode) as Record<string, unknown>;
  if (nodeObj.type !== 'organizer') return null;

  ydoc.transact(() => {
    let ydata = ynode.get('data');
    // If data is a plain object (can happen after certain Yjs operations), convert it
    if (!(ydata instanceof Y.Map)) {
      const plainData = (ydata && typeof ydata === 'object') ? ydata as Record<string, unknown> : {};
      ydata = deepPlainToY(plainData) as Y.Map<unknown>;
      ynode.set('data', ydata);
    }
    const ydataMap = ydata as Y.Map<unknown>;
    if (updates.name !== undefined) ydataMap.set('name', updates.name);
    if (updates.color !== undefined) ydataMap.set('color', updates.color);
    if (updates.collapsed !== undefined) ydataMap.set('collapsed', updates.collapsed);
    if (updates.layout !== undefined) ydataMap.set('layout', updates.layout);
    if (updates.description !== undefined) ydataMap.set('description', updates.description);
    if (updates.attachedToSemanticId !== undefined) ydataMap.set('attachedToSemanticId', updates.attachedToSemanticId);
  }, MCP_ORIGIN);

  // Re-read to return updated state
  const updated = yToPlain(ynode) as Record<string, unknown>;
  const data = updated.data as OrganizerNodeData;
  const style = updated.style as Record<string, unknown> | undefined;
  const position = (updated.position as { x: number; y: number }) || { x: 0, y: 0 };

  return {
    id: organizerId,
    name: data.name ?? '',
    color: data.color ?? '#6b7280',
    position,
    width: (style?.width as number) ?? 400,
    height: (style?.height as number) ?? 300,
    layout: data.layout ?? 'freeform',
    collapsed: data.collapsed ?? false,
    description: data.description,
    attachedToSemanticId: data.attachedToSemanticId as string | undefined,
  };
}

/**
 * Delete an organizer node.
 * When deleteMembers is false (default), child nodes are detached and converted to absolute positions.
 * When deleteMembers is true, child nodes are also deleted.
 */
export function deleteOrganizer(
  ydoc: Y.Doc,
  levelId: string,
  organizerId: string,
  deleteMembers = false
): boolean {
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
  const ynode = levelNodes.get(organizerId);
  if (!ynode) return false;

  const nodeObj = yToPlain(ynode) as Record<string, unknown>;
  if (nodeObj.type !== 'organizer') return false;

  const organizerPos = (nodeObj.position as { x: number; y: number }) || { x: 0, y: 0 };

  ydoc.transact(() => {
    // Find children
    const childIds: string[] = [];
    levelNodes.forEach((childYnode, childId) => {
      if (childId === organizerId) return;
      const parentId = childYnode.get('parentId') as string | undefined;
      if (parentId === organizerId) {
        childIds.push(childId);
      }
    });

    if (deleteMembers) {
      // Delete all children
      for (const childId of childIds) {
        levelNodes.delete(childId);
      }
    } else {
      // Detach: convert relative positions to absolute, remove parentId
      for (const childId of childIds) {
        const childYnode = levelNodes.get(childId);
        if (!childYnode) continue;

        const childPos = yToPlain(childYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
        const absolutePos = toAbsolutePosition(childPos, organizerPos);

        childYnode.set('position', deepPlainToY(absolutePos));
        childYnode.delete('parentId');
      }
    }

    // Delete the organizer itself
    levelNodes.delete(organizerId);
  }, MCP_ORIGIN);

  return true;
}

// ===== CONNECTION OPERATIONS =====

/**
 * Connect two constructs via ports within a level
 */
export function connect(
  ydoc: Y.Doc,
  levelId: string,
  sourceSemanticId: string,
  sourcePortId: string,
  targetSemanticId: string,
  targetPortId: string
): CompilerEdge | null {
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
  const levelEdges = getLevelMap(ydoc, 'edges', levelId);

  // Find source and target nodes
  let sourceNodeId: string | null = null;
  let targetNodeId: string | null = null;
  let sourceYdata: Y.Map<unknown> | null = null;

  levelNodes.forEach((ynode, id) => {
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
    levelEdges.set(edgeId, yedge as Y.Map<unknown>);

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
 * Disconnect two constructs within a level
 */
export function disconnect(
  ydoc: Y.Doc,
  levelId: string,
  sourceSemanticId: string,
  sourcePortId: string,
  targetSemanticId: string
): boolean {
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
  const levelEdges = getLevelMap(ydoc, 'edges', levelId);

  // Find source and target node IDs
  let sourceNodeId: string | null = null;
  let targetNodeId: string | null = null;
  let sourceYdata: Y.Map<unknown> | null = null;

  levelNodes.forEach((ynode, id) => {
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
      levelEdges.forEach((yedge, edgeId) => {
        if (
          yedge.get('source') === sourceNodeId &&
          yedge.get('target') === targetNodeId &&
          yedge.get('sourceHandle') === sourcePortId
        ) {
          edgesToDelete.push(edgeId);
        }
      });
      for (const edgeId of edgesToDelete) {
        levelEdges.delete(edgeId);
      }
    }
  }, MCP_ORIGIN);

  return true;
}

// ===== SCHEMA OPERATIONS (shared across levels) =====

/**
 * List all schemas (built-in + custom)
 */
export function listSchemas(ydoc: Y.Doc): ConstructSchema[] {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const schemas = [...builtInConstructSchemas];

  // Add custom schemas from document
  yschemas.forEach((yschema) => {
    const schema = yToPlain(yschema) as ConstructSchema;
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
    return yToPlain(yschema) as ConstructSchema;
  }

  return null;
}

/**
 * Apply smart defaults to a schema for better UX
 */
function applySchemaDefaults(schema: Record<string, unknown>): Record<string, unknown> {
  const processed = { ...schema };

  // Auto-detect primary fields and set displayTier
  const primaryFieldNames = ['name', 'title', 'label', 'summary', 'condition'];
  if (Array.isArray(processed.fields)) {
    processed.fields = (processed.fields as Array<Record<string, unknown>>).map((field) => {
      if (primaryFieldNames.includes((field.name as string).toLowerCase()) && field.displayTier === undefined) {
        return { ...field, displayTier: 'minimal' };
      }
      return field;
    });
  }

  // Add default ports if none specified
  if (!processed.ports || (processed.ports as unknown[]).length === 0) {
    processed.ports = [
      { id: 'flow-in', portType: 'flow-in', label: 'In' },
      { id: 'flow-out', portType: 'flow-out', label: 'Out' },
      { id: 'parent', portType: 'parent', label: 'Children' },
      { id: 'child', portType: 'child', label: 'Parent' },
    ];
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
  const processedSchema = applySchemaDefaults(schema as unknown as Record<string, unknown>);

  ydoc.transact(() => {
    yschemas.set(processedSchema.type as string, deepPlainToY(processedSchema) as Y.Map<unknown>);
  }, MCP_ORIGIN);

  return processedSchema as unknown as ConstructSchema;
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

// ===== AUTO-LAYOUT =====

/**
 * Compute a non-overlapping position for a new node by finding the bounding box
 * of existing nodes and placing to the right.
 */
export function computeAutoPosition(
  existingNodes: CompilerNode[],
  index: number,
  columnsPerRow = 4,
  spacingX = 250,
  spacingY = 200
): { x: number; y: number } {
  let maxX = -Infinity;
  let minY = Infinity;

  for (const node of existingNodes) {
    if (node.position.x > maxX) maxX = node.position.x;
    if (node.position.y < minY) minY = node.position.y;
  }

  // If no existing nodes, start at origin area
  if (maxX === -Infinity) {
    maxX = -spacingX; // so first column starts at 0
    minY = 100;
  }

  const startX = maxX + spacingX;
  const startY = minY;

  const col = index % columnsPerRow;
  const row = Math.floor(index / columnsPerRow);

  return { x: startX + col * spacingX, y: startY + row * spacingY };
}

// ===== BULK OPERATIONS =====

/**
 * Create multiple constructs in a single Yjs transaction (all-or-nothing).
 * Specs without explicit x/y are auto-placed in a grid layout.
 */
export function createConstructsBulk(
  ydoc: Y.Doc,
  levelId: string,
  specs: Array<{
    constructType: string;
    values?: Record<string, unknown>;
    x?: number;
    y?: number;
    parentId?: string;
  }>
): CompilerNode[] {
  const existingNodes = listConstructs(ydoc, levelId);
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
  const results: CompilerNode[] = [];

  // Count auto-placed nodes for grid indexing
  let autoIndex = 0;

  ydoc.transact(() => {
    for (const spec of specs) {
      const semanticId = generateSemanticId(spec.constructType);
      const nodeId = generateNodeId();

      let position: { x: number; y: number };
      if (spec.x != null && spec.y != null) {
        position = { x: spec.x, y: spec.y };
      } else {
        position = computeAutoPosition(existingNodes, autoIndex);
        autoIndex++;
      }

      const nodeData: ConstructNodeData = {
        constructType: spec.constructType,
        semanticId,
        values: spec.values ?? {},
        connections: [],
      };

      const node: CompilerNode = {
        id: nodeId,
        type: 'construct',
        position,
        data: nodeData,
        parentId: spec.parentId,
      };

      const ynode = new Y.Map<unknown>();
      ynode.set('type', node.type);
      ynode.set('position', deepPlainToY(position));
      ynode.set('data', deepPlainToY(nodeData));
      if (spec.parentId) ynode.set('parentId', spec.parentId);
      levelNodes.set(nodeId, ynode as Y.Map<unknown>);

      results.push(node);
      // Add to existingNodes so subsequent auto-placed nodes see this one
      existingNodes.push(node);
    }
  }, MCP_ORIGIN);

  return results;
}

/**
 * Connect multiple construct pairs in a single Yjs transaction.
 * Best-effort: individual failures are recorded, not aborted.
 */
export function connectBulk(
  ydoc: Y.Doc,
  levelId: string,
  connections: Array<{
    sourceSemanticId: string;
    sourcePortId: string;
    targetSemanticId: string;
    targetPortId: string;
  }>
): Array<{ edge: CompilerEdge | null; error?: string }> {
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
  const levelEdges = getLevelMap(ydoc, 'edges', levelId);

  // Build a lookup of semanticId → { nodeId, ydata }
  const nodeMap = new Map<string, { nodeId: string; ydata: Y.Map<unknown> }>();
  levelNodes.forEach((ynode, id) => {
    const ydata = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (ydata) {
      const sid = safeGet(ydata, 'semanticId') as string | undefined;
      if (sid) nodeMap.set(sid, { nodeId: id, ydata: ydata as Y.Map<unknown> });
    }
  });

  const results: Array<{ edge: CompilerEdge | null; error?: string }> = [];

  ydoc.transact(() => {
    for (const conn of connections) {
      const source = nodeMap.get(conn.sourceSemanticId);
      const target = nodeMap.get(conn.targetSemanticId);

      if (!source || !target) {
        results.push({
          edge: null,
          error: !source
            ? `Source not found: ${conn.sourceSemanticId}`
            : `Target not found: ${conn.targetSemanticId}`,
        });
        continue;
      }

      const edgeId = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const yedge = new Y.Map<unknown>();
      yedge.set('source', source.nodeId);
      yedge.set('target', target.nodeId);
      yedge.set('sourceHandle', conn.sourcePortId);
      yedge.set('targetHandle', conn.targetPortId);
      levelEdges.set(edgeId, yedge as Y.Map<unknown>);

      // Add connection to source node
      let yconns = source.ydata.get('connections') as Y.Array<unknown> | undefined;
      if (!yconns) {
        yconns = new Y.Array();
        source.ydata.set('connections', yconns);
      }

      const connectionData: ConnectionValue = {
        portId: conn.sourcePortId,
        targetSemanticId: conn.targetSemanticId,
        targetPortId: conn.targetPortId,
      };
      yconns.push([deepPlainToY(connectionData)]);

      results.push({
        edge: {
          id: edgeId,
          source: source.nodeId,
          target: target.nodeId,
          sourceHandle: conn.sourcePortId,
          targetHandle: conn.targetPortId,
        },
      });
    }
  }, MCP_ORIGIN);

  return results;
}

/**
 * Delete multiple constructs in a single Yjs transaction.
 * Best-effort: individual failures are recorded, not aborted.
 * Handles wagon detachment, edge cleanup, and connection array cleanup.
 */
export function deleteConstructsBulk(
  ydoc: Y.Doc,
  levelId: string,
  semanticIds: string[]
): Array<{ semanticId: string; deleted: boolean; error?: string }> {
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
  const levelEdges = getLevelMap(ydoc, 'edges', levelId);

  // Build lookup: semanticId → nodeId
  const semanticToNodeId = new Map<string, string>();
  levelNodes.forEach((ynode, id) => {
    const data = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (data) {
      const sid = safeGet(data, 'semanticId') as string | undefined;
      if (sid) semanticToNodeId.set(sid, id);
    }
  });

  // Resolve which nodeIds to delete
  const targetNodeIds = new Set<string>();
  const results: Array<{ semanticId: string; deleted: boolean; error?: string }> = [];
  const semanticIdSet = new Set(semanticIds);

  for (const sid of semanticIds) {
    const nodeId = semanticToNodeId.get(sid);
    if (nodeId) {
      targetNodeIds.add(nodeId);
    }
  }

  ydoc.transact(() => {
    // 1. Find and handle attached wagons for all target nodes
    const wagonIdsToDelete = new Set<string>();
    levelNodes.forEach((ynode, id) => {
      const nodeObj = yToPlain(ynode) as Record<string, unknown>;
      if (nodeObj.type !== 'organizer') return;
      const data = nodeObj.data as OrganizerNodeData;
      if (data.attachedToSemanticId && semanticIdSet.has(data.attachedToSemanticId)) {
        wagonIdsToDelete.add(id);
      }
    });

    // Detach wagon members before deleting wagons
    for (const wagonId of wagonIdsToDelete) {
      const wagonYnode = levelNodes.get(wagonId);
      if (!wagonYnode) continue;
      const wagonPos = yToPlain(wagonYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };

      levelNodes.forEach((childYnode, childId) => {
        if (childId === wagonId) return;
        const parentId = childYnode.get('parentId') as string | undefined;
        if (parentId === wagonId && !targetNodeIds.has(childId)) {
          const memberPos = yToPlain(childYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
          const absolutePos = toAbsolutePosition(memberPos, wagonPos);
          childYnode.set('position', deepPlainToY(absolutePos));
          childYnode.delete('parentId');
        }
      });

      // Remove edges connected to wagon
      levelEdges.forEach((yedge, edgeId) => {
        if (yedge.get('source') === wagonId || yedge.get('target') === wagonId) {
          levelEdges.delete(edgeId);
        }
      });

      levelNodes.delete(wagonId);
    }

    // 2. Delete edges connected to any target node
    const edgesToDelete: string[] = [];
    levelEdges.forEach((yedge, edgeId) => {
      const src = yedge.get('source') as string;
      const tgt = yedge.get('target') as string;
      if (targetNodeIds.has(src) || targetNodeIds.has(tgt)) {
        edgesToDelete.push(edgeId);
      }
    });
    for (const edgeId of edgesToDelete) {
      levelEdges.delete(edgeId);
    }

    // 3. Clean connection arrays in surviving nodes
    levelNodes.forEach((ynode, id) => {
      if (targetNodeIds.has(id)) return;
      const ydata = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
      if (!ydata) return;

      const yconns = safeGet(ydata, 'connections') as Y.Array<unknown> | unknown[] | undefined;
      if (yconns instanceof Y.Array) {
        const indicesToRemove: number[] = [];
        for (let i = 0; i < yconns.length; i++) {
          const conn = yconns.get(i) as Y.Map<unknown> | Record<string, unknown>;
          if (conn && semanticIdSet.has(safeGet(conn, 'targetSemanticId') as string)) {
            indicesToRemove.push(i);
          }
        }
        for (let i = indicesToRemove.length - 1; i >= 0; i--) {
          yconns.delete(indicesToRemove[i]!, 1);
        }
      } else if (Array.isArray(yconns)) {
        const filtered = yconns.filter((conn) => {
          const c = conn as Record<string, unknown>;
          return !semanticIdSet.has(c.targetSemanticId as string);
        });
        if (ydata instanceof Y.Map) {
          ydata.set('connections', deepPlainToY(filtered));
        }
      }
    });

    // 4. Delete the target nodes
    for (const sid of semanticIds) {
      const nodeId = semanticToNodeId.get(sid);
      if (!nodeId) {
        results.push({ semanticId: sid, deleted: false, error: `Construct not found: ${sid}` });
        continue;
      }
      levelNodes.delete(nodeId);
      results.push({ semanticId: sid, deleted: true });
    }
  }, MCP_ORIGIN);

  return results;
}

// ===== BATCH MUTATE =====

export type BatchOperation =
  | { op: 'create'; constructType: string; values?: Record<string, unknown>; x?: number; y?: number; parentId?: string }
  | { op: 'update'; semanticId: string; values?: Record<string, unknown>; instanceColor?: string | null }
  | { op: 'delete'; semanticId: string }
  | { op: 'connect'; sourceSemanticId: string; sourcePortId: string; targetSemanticId: string; targetPortId: string }
  | { op: 'disconnect'; sourceSemanticId: string; sourcePortId: string; targetSemanticId: string }
  | { op: 'move'; semanticId: string; parentId: string | null; x?: number; y?: number };

export interface BatchResult {
  index: number;
  op: string;
  success: boolean;
  error?: string;
  semanticId?: string;
}

/**
 * Resolve `@N` placeholders in a string value.
 * `@N` references the semanticId from the Nth operation's result.
 */
function resolvePlaceholder(value: string | undefined | null, created: Map<number, { semanticId: string; nodeId: string }>): string | undefined | null {
  if (!value || !value.startsWith('@')) return value;
  const idx = parseInt(value.slice(1), 10);
  if (isNaN(idx)) return value;
  const entry = created.get(idx);
  return entry ? entry.semanticId : value;
}

/**
 * Execute heterogeneous operations in a single Yjs transaction.
 * Operations execute in array order. Best-effort: failures don't abort remaining ops.
 *
 * `@N` syntax in semanticId/parentId fields references the Nth operation's result.
 * E.g., create at index 0, then connect using `"@0"` as sourceSemanticId.
 */
export function batchMutate(
  ydoc: Y.Doc,
  levelId: string,
  operations: BatchOperation[]
): BatchResult[] {
  const levelNodes = getLevelMap(ydoc, 'nodes', levelId);
  const levelEdges = getLevelMap(ydoc, 'edges', levelId);
  const results: BatchResult[] = [];
  const created = new Map<number, { semanticId: string; nodeId: string }>();

  ydoc.transact(() => {
    // Build a live lookup of semanticId → { nodeId, ydata }
    // We rebuild this before operations that need it, since creates modify it
    function buildNodeMap() {
      const map = new Map<string, { nodeId: string; ydata: Y.Map<unknown>; ynode: Y.Map<unknown> }>();
      levelNodes.forEach((ynode, id) => {
        const ydata = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
        if (ydata) {
          const sid = safeGet(ydata, 'semanticId') as string | undefined;
          if (sid) map.set(sid, { nodeId: id, ydata: ydata as Y.Map<unknown>, ynode });
        }
      });
      return map;
    }

    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i]!;
      try {
        switch (operation.op) {
          case 'create': {
            const parentId = resolvePlaceholder(operation.parentId, created) ?? undefined;
            const semanticId = generateSemanticId(operation.constructType);
            const nodeId = generateNodeId();
            const position = { x: operation.x ?? 100, y: operation.y ?? 100 };

            const nodeData: ConstructNodeData = {
              constructType: operation.constructType,
              semanticId,
              values: operation.values ?? {},
              connections: [],
            };

            const ynode = new Y.Map<unknown>();
            ynode.set('type', 'construct');
            ynode.set('position', deepPlainToY(position));
            ynode.set('data', deepPlainToY(nodeData));
            if (parentId) ynode.set('parentId', parentId);
            levelNodes.set(nodeId, ynode as Y.Map<unknown>);

            created.set(i, { semanticId, nodeId });
            results.push({ index: i, op: 'create', success: true, semanticId });
            break;
          }

          case 'update': {
            const sid = resolvePlaceholder(operation.semanticId, created)!;
            const nodeMap = buildNodeMap();
            const entry = nodeMap.get(sid);
            if (!entry) {
              results.push({ index: i, op: 'update', success: false, error: `Construct not found: ${sid}` });
              break;
            }

            if (operation.values !== undefined) {
              const existingValues = (entry.ydata.get('values') as Y.Map<unknown>) || new Y.Map();
              const newValues = deepPlainToY(operation.values) as Y.Map<unknown>;
              newValues.forEach((value, key) => {
                existingValues.set(key, value);
              });
              entry.ydata.set('values', existingValues);
            }

            if (operation.instanceColor !== undefined) {
              entry.ydata.set('instanceColor', operation.instanceColor);
            }

            results.push({ index: i, op: 'update', success: true, semanticId: sid });
            break;
          }

          case 'delete': {
            const sid = resolvePlaceholder(operation.semanticId, created)!;
            const nodeMap = buildNodeMap();
            const entry = nodeMap.get(sid);
            if (!entry) {
              results.push({ index: i, op: 'delete', success: false, error: `Construct not found: ${sid}` });
              break;
            }

            // Delete attached wagons
            levelNodes.forEach((ynode, id) => {
              const nodeObj = yToPlain(ynode) as Record<string, unknown>;
              if (nodeObj.type !== 'organizer') return;
              const data = nodeObj.data as OrganizerNodeData;
              if (data.attachedToSemanticId === sid) {
                // Detach wagon members
                levelNodes.forEach((childYnode, childId) => {
                  if (childId === id) return;
                  const pid = childYnode.get('parentId') as string | undefined;
                  if (pid === id) {
                    const wagonPos = yToPlain(ynode.get('position') as Y.Map<unknown>) as { x: number; y: number };
                    const memberPos = yToPlain(childYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
                    childYnode.set('position', deepPlainToY(toAbsolutePosition(memberPos, wagonPos)));
                    childYnode.delete('parentId');
                  }
                });
                // Remove wagon edges
                levelEdges.forEach((yedge, edgeId) => {
                  if (yedge.get('source') === id || yedge.get('target') === id) {
                    levelEdges.delete(edgeId);
                  }
                });
                levelNodes.delete(id);
              }
            });

            // Remove edges
            const edgesToDel: string[] = [];
            levelEdges.forEach((yedge, edgeId) => {
              if (yedge.get('source') === entry.nodeId || yedge.get('target') === entry.nodeId) {
                edgesToDel.push(edgeId);
              }
            });
            for (const edgeId of edgesToDel) {
              levelEdges.delete(edgeId);
            }

            // Clean connections in surviving nodes
            levelNodes.forEach((ynode) => {
              const ydata = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
              if (!ydata) return;
              const yconns = safeGet(ydata, 'connections') as Y.Array<unknown> | unknown[] | undefined;
              if (yconns instanceof Y.Array) {
                const indicesToRemove: number[] = [];
                for (let j = 0; j < yconns.length; j++) {
                  const conn = yconns.get(j) as Y.Map<unknown> | Record<string, unknown>;
                  if (conn && safeGet(conn, 'targetSemanticId') === sid) {
                    indicesToRemove.push(j);
                  }
                }
                for (let j = indicesToRemove.length - 1; j >= 0; j--) {
                  yconns.delete(indicesToRemove[j]!, 1);
                }
              } else if (Array.isArray(yconns)) {
                const filtered = yconns.filter((conn) => {
                  const c = conn as Record<string, unknown>;
                  return c.targetSemanticId !== sid;
                });
                if (ydata instanceof Y.Map) {
                  ydata.set('connections', deepPlainToY(filtered));
                }
              }
            });

            levelNodes.delete(entry.nodeId);
            results.push({ index: i, op: 'delete', success: true, semanticId: sid });
            break;
          }

          case 'connect': {
            const srcSid = resolvePlaceholder(operation.sourceSemanticId, created)!;
            const tgtSid = resolvePlaceholder(operation.targetSemanticId, created)!;
            const nodeMap = buildNodeMap();
            const source = nodeMap.get(srcSid);
            const target = nodeMap.get(tgtSid);

            if (!source || !target) {
              results.push({
                index: i,
                op: 'connect',
                success: false,
                error: !source ? `Source not found: ${srcSid}` : `Target not found: ${tgtSid}`,
              });
              break;
            }

            const edgeId = `edge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const yedge = new Y.Map<unknown>();
            yedge.set('source', source.nodeId);
            yedge.set('target', target.nodeId);
            yedge.set('sourceHandle', operation.sourcePortId);
            yedge.set('targetHandle', operation.targetPortId);
            levelEdges.set(edgeId, yedge as Y.Map<unknown>);

            let yconns = source.ydata.get('connections') as Y.Array<unknown> | undefined;
            if (!yconns) {
              yconns = new Y.Array();
              source.ydata.set('connections', yconns);
            }
            const connectionData: ConnectionValue = {
              portId: operation.sourcePortId,
              targetSemanticId: tgtSid,
              targetPortId: operation.targetPortId,
            };
            yconns.push([deepPlainToY(connectionData)]);

            results.push({ index: i, op: 'connect', success: true });
            break;
          }

          case 'disconnect': {
            const srcSid = resolvePlaceholder(operation.sourceSemanticId, created)!;
            const tgtSid = resolvePlaceholder(operation.targetSemanticId, created)!;
            const nodeMap = buildNodeMap();
            const source = nodeMap.get(srcSid);
            const target = nodeMap.get(tgtSid);

            if (!source) {
              results.push({ index: i, op: 'disconnect', success: false, error: `Source not found: ${srcSid}` });
              break;
            }

            // Remove from connections array
            const yconns = safeGet(source.ydata, 'connections') as Y.Array<unknown> | unknown[] | undefined;
            if (yconns instanceof Y.Array) {
              for (let j = yconns.length - 1; j >= 0; j--) {
                const conn = yconns.get(j) as Y.Map<unknown> | Record<string, unknown>;
                if (
                  conn &&
                  safeGet(conn, 'portId') === operation.sourcePortId &&
                  safeGet(conn, 'targetSemanticId') === tgtSid
                ) {
                  yconns.delete(j, 1);
                  break;
                }
              }
            } else if (Array.isArray(yconns)) {
              const filtered = yconns.filter((conn) => {
                const c = conn as Record<string, unknown>;
                return !(c.portId === operation.sourcePortId && c.targetSemanticId === tgtSid);
              });
              if (source.ydata instanceof Y.Map) {
                source.ydata.set('connections', deepPlainToY(filtered));
              }
            }

            // Remove edge
            if (target) {
              const edgesToDel: string[] = [];
              levelEdges.forEach((yedge, edgeId) => {
                if (
                  yedge.get('source') === source.nodeId &&
                  yedge.get('target') === target.nodeId &&
                  yedge.get('sourceHandle') === operation.sourcePortId
                ) {
                  edgesToDel.push(edgeId);
                }
              });
              for (const edgeId of edgesToDel) {
                levelEdges.delete(edgeId);
              }
            }

            results.push({ index: i, op: 'disconnect', success: true });
            break;
          }

          case 'move': {
            const sid = resolvePlaceholder(operation.semanticId, created)!;
            const targetParentId = resolvePlaceholder(operation.parentId, created) ?? null;
            const nodeMap = buildNodeMap();
            const entry = nodeMap.get(sid);

            if (!entry) {
              results.push({ index: i, op: 'move', success: false, error: `Construct not found: ${sid}` });
              break;
            }

            // Validate target organizer
            if (targetParentId !== null) {
              const targetOrg = levelNodes.get(targetParentId);
              if (!targetOrg) {
                results.push({ index: i, op: 'move', success: false, error: `Organizer not found: ${targetParentId}` });
                break;
              }
            }

            const currentParentId = entry.ynode.get('parentId') as string | undefined;
            const currentPos = yToPlain(entry.ynode.get('position') as Y.Map<unknown>) as { x: number; y: number };
            let newPos: { x: number; y: number };

            if (operation.x != null && operation.y != null) {
              newPos = { x: operation.x, y: operation.y };
            } else if (currentParentId && !targetParentId) {
              const parentYnode = levelNodes.get(currentParentId);
              if (parentYnode) {
                const parentPos = yToPlain(parentYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
                newPos = toAbsolutePosition(currentPos, parentPos);
              } else {
                newPos = currentPos;
              }
            } else if (!currentParentId && targetParentId) {
              const parentYnode = levelNodes.get(targetParentId);
              if (parentYnode) {
                const parentPos = yToPlain(parentYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
                newPos = toRelativePosition(currentPos, parentPos);
              } else {
                newPos = currentPos;
              }
            } else if (currentParentId && targetParentId && currentParentId !== targetParentId) {
              const oldParent = levelNodes.get(currentParentId);
              const newParent = levelNodes.get(targetParentId);
              if (oldParent && newParent) {
                const oldParentPos = yToPlain(oldParent.get('position') as Y.Map<unknown>) as { x: number; y: number };
                const newParentPos = yToPlain(newParent.get('position') as Y.Map<unknown>) as { x: number; y: number };
                const absPos = toAbsolutePosition(currentPos, oldParentPos);
                newPos = toRelativePosition(absPos, newParentPos);
              } else {
                newPos = currentPos;
              }
            } else {
              newPos = currentPos;
            }

            entry.ynode.set('position', deepPlainToY(newPos));
            if (targetParentId) {
              entry.ynode.set('parentId', targetParentId);
            } else {
              entry.ynode.delete('parentId');
            }

            results.push({ index: i, op: 'move', success: true, semanticId: sid });
            break;
          }

          default:
            results.push({ index: i, op: (operation as { op: string }).op, success: false, error: `Unknown operation: ${(operation as { op: string }).op}` });
        }
      } catch (err) {
        results.push({ index: i, op: operation.op, success: false, error: String(err) });
      }
    }
  }, MCP_ORIGIN);

  return results;
}

// ===== COMPILATION =====

/**
 * Compile a level's document to AI-readable output
 */
export function compile(ydoc: Y.Doc, levelId: string): string {
  const nodes = listConstructs(ydoc, levelId);
  const schemas = listSchemas(ydoc);

  // Get edges for level
  const levelEdges = getLevelMap(ydoc, 'edges', levelId);
  const edges: CompilerEdge[] = [];
  levelEdges.forEach((yedge, id) => {
    edges.push({
      id,
      source: yedge.get('source') as string,
      target: yedge.get('target') as string,
      sourceHandle: yedge.get('sourceHandle') as string | undefined,
      targetHandle: yedge.get('targetHandle') as string | undefined,
    });
  });

  const compilerEngine = new CompilerEngine();
  return compilerEngine.compile(nodes, edges, { schemas });
}

// ===== DOCUMENT EXTRACTION =====

/**
 * Extract full document from Y.Doc for a given level
 */
export function extractDocument(ydoc: Y.Doc, roomId: string, levelId: string): ServerDocument {
  const ymeta = ydoc.getMap('meta');
  const nodes = listConstructs(ydoc, levelId);
  const schemas = listSchemas(ydoc);

  // Get edges for level
  const levelEdges = getLevelMap(ydoc, 'edges', levelId);
  const edges: CompilerEdge[] = [];
  levelEdges.forEach((yedge, id) => {
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
    folder: (ymeta.get('folder') as string) || '/',
    version: (ymeta.get('version') as number) || 3,
    formatVersion: SERVER_FORMAT_VERSION,
    createdAt: now,
    updatedAt: now,
    nodes,
    edges,
    customSchemas,
  };
}
