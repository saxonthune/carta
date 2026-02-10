/**
 * Y.Doc mutation operations for Carta documents.
 *
 * Page-aware: construct/edge operations take a `pageId` parameter.
 * Schema operations are shared across pages.
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
  computeFlowLayout,
  computeArrangeLayout,
  canConnect,
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
  FlowDirection,
  FlowLayoutInput,
  FlowLayoutEdge,
  ArrangeStrategy,
  ArrangeConstraint,
  ArrangeInput,
  ArrangeEdge,
} from '@carta/domain';
import { CompilerEngine } from '@carta/compiler';
import { yToPlain, deepPlainToY, safeGet } from './yjs-helpers.js';
import { generateNodeId, generatePageId } from './id-generators.js';
import { MCP_ORIGIN, SERVER_FORMAT_VERSION } from './constants.js';

/**
 * Ensure a node's data field is a Y.Map. After certain Yjs operations
 * (schema delete/recreate, file round-trips, partial sync), nested data
 * can degrade to a plain object. This converts it back in-place.
 */
function ensureYMap(ynode: Y.Map<unknown>, ydata: Y.Map<unknown> | Record<string, unknown>): Y.Map<unknown> {
  if (ydata instanceof Y.Map) return ydata;
  const plainData = (typeof ydata === 'object' && ydata !== null) ? ydata as Record<string, unknown> : {};
  const converted = deepPlainToY(plainData) as Y.Map<unknown>;
  ynode.set('data', converted);
  return converted;
}

/**
 * Get or create a page-scoped Y.Map inside a container map.
 */
function getPageMap(ydoc: Y.Doc, mapName: string, pageId: string): Y.Map<Y.Map<unknown>> {
  const container = ydoc.getMap<Y.Map<unknown>>(mapName);
  let pageMap = container.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
  if (!pageMap) {
    pageMap = new Y.Map();
    container.set(pageId, pageMap as unknown as Y.Map<unknown>);
  }
  return pageMap;
}

/**
 * Iterate over all nodes of a given constructType across all pages.
 * Callback receives (ydata: Y.Map<unknown>, nodeId: string, pageId: string).
 */
function forEachInstanceOfType(
  ydoc: Y.Doc,
  constructType: string,
  callback: (ydata: Y.Map<unknown>, nodeId: string, pageId: string) => void
): void {
  const ypages = ydoc.getMap<Y.Map<unknown>>('pages');
  const ynodesContainer = ydoc.getMap<Y.Map<unknown>>('nodes');
  ypages.forEach((_, pageId) => {
    const pageNodes = ynodesContainer.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
    if (!pageNodes) return;
    pageNodes.forEach((ynode, nodeId) => {
      const ydata = ynode.get('data') as Y.Map<unknown> | undefined;
      if (!ydata) return;
      if (safeGet(ydata, 'constructType') !== constructType) return;
      callback(ensureYMap(ynode, ydata), nodeId, pageId);
    });
  });
}

/**
 * Iterate over all edges across all pages.
 * Callback receives (yedge: Y.Map<unknown>, edgeId: string, pageId: string).
 * Return true from callback to delete the edge.
 */
function forEachEdge(
  ydoc: Y.Doc,
  callback: (yedge: Y.Map<unknown>, edgeId: string, pageId: string) => boolean | void
): number {
  const ypages = ydoc.getMap<Y.Map<unknown>>('pages');
  const yedgesContainer = ydoc.getMap<Y.Map<unknown>>('edges');
  let deletedCount = 0;
  ypages.forEach((_, pageId) => {
    const pageEdges = yedgesContainer.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
    if (!pageEdges) return;
    const toDelete: string[] = [];
    pageEdges.forEach((yedge, edgeId) => {
      const shouldDelete = callback(yedge, edgeId, pageId);
      if (shouldDelete) toDelete.push(edgeId);
    });
    for (const edgeId of toDelete) {
      pageEdges.delete(edgeId);
      deletedCount++;
    }
  });
  return deletedCount;
}

// ===== PAGE OPERATIONS =====

export interface PageInfo {
  id: string;
  name: string;
  description?: string;
  order: number;
}

export interface MigrationResult {
  dryRun?: boolean;
  schemaUpdated: boolean;
  instancesUpdated: number;
  edgesUpdated: number;
  edgesRemoved: number;
  warnings: string[];
}

/**
 * List all levels in a document
 */
export function listPages(ydoc: Y.Doc): PageInfo[] {
  const ypages = ydoc.getMap<Y.Map<unknown>>('pages');
  const pages: PageInfo[] = [];

  ypages.forEach((ypage, id) => {
    pages.push({
      id,
      name: (ypage.get('name') as string) ?? 'Untitled',
      description: ypage.get('description') as string | undefined,
      order: (ypage.get('order') as number) ?? 0,
    });
  });

  pages.sort((a, b) => a.order - b.order);
  return pages;
}

/**
 * Get the active page ID for a document
 */
export function getActivePage(ydoc: Y.Doc): string {
  const ymeta = ydoc.getMap('meta');
  const active = ymeta.get('activePage') as string | undefined;
  if (active) return active;

  // Fallback: first page by order
  const pages = listPages(ydoc);
  return pages[0]?.id ?? '';
}

/**
 * Set the active page for a document
 */
export function setActivePage(ydoc: Y.Doc, pageId: string): void {
  const ypages = ydoc.getMap<Y.Map<unknown>>('pages');
  if (!ypages.has(pageId)) {
    throw new Error(`Page not found: ${pageId}`);
  }

  ydoc.transact(() => {
    ydoc.getMap('meta').set('activePage', pageId);
  }, MCP_ORIGIN);
}

/**
 * Create a new page in a document
 */
export function createPage(ydoc: Y.Doc, name: string, description?: string): PageInfo {
  const pageId = generatePageId();
  const ypages = ydoc.getMap<Y.Map<unknown>>('pages');

  // Determine next order value
  let maxOrder = -1;
  ypages.forEach((ypage) => {
    const order = (ypage.get('order') as number) ?? 0;
    if (order > maxOrder) maxOrder = order;
  });

  const order = maxOrder + 1;

  ydoc.transact(() => {
    const pageData = new Y.Map<unknown>();
    pageData.set('id', pageId);
    pageData.set('name', name);
    if (description) pageData.set('description', description);
    pageData.set('order', order);
    ypages.set(pageId, pageData);
  }, MCP_ORIGIN);

  return { id: pageId, name, description, order };
}

/**
 * Update page metadata
 */
export function updatePage(
  ydoc: Y.Doc,
  pageId: string,
  updates: { name?: string; description?: string; order?: number }
): PageInfo | null {
  const ypages = ydoc.getMap<Y.Map<unknown>>('pages');
  const ypage = ypages.get(pageId);
  if (!ypage) return null;

  ydoc.transact(() => {
    if (updates.name !== undefined) ypage.set('name', updates.name);
    if (updates.description !== undefined) ypage.set('description', updates.description);
    if (updates.order !== undefined) ypage.set('order', updates.order);
  }, MCP_ORIGIN);

  return {
    id: pageId,
    name: (ypage.get('name') as string) ?? 'Untitled',
    description: ypage.get('description') as string | undefined,
    order: (ypage.get('order') as number) ?? 0,
  };
}

/**
 * Delete a page (must have more than one page)
 */
export function deletePage(ydoc: Y.Doc, pageId: string): boolean {
  const ypages = ydoc.getMap<Y.Map<unknown>>('pages');
  if (!ypages.has(pageId)) return false;
  if (ypages.size <= 1) return false;

  ydoc.transact(() => {
    ypages.delete(pageId);

    // Clean up page-scoped nodes and edges
    const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
    if (ynodes.has(pageId)) ynodes.delete(pageId);
    if (yedges.has(pageId)) yedges.delete(pageId);

    // If this was the active page, switch to the first remaining page
    const ymeta = ydoc.getMap('meta');
    if (ymeta.get('activePage') === pageId) {
      let firstId: string | undefined;
      let firstOrder = Infinity;
      ypages.forEach((yl, id) => {
        const order = (yl.get('order') as number) ?? 0;
        if (order < firstOrder) { firstOrder = order; firstId = id; }
      });
      if (firstId) ymeta.set('activePage', firstId);
    }
  }, MCP_ORIGIN);

  return true;
}

// ===== CONSTRUCT OPERATIONS =====

/**
 * List all constructs in a document page
 */
export function listConstructs(
  ydoc: Y.Doc,
  pageId: string,
  options?: { constructType?: string }
): CompilerNode[] {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);
  const nodes: CompilerNode[] = [];

  pageNodes.forEach((ynode, id) => {
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
 * Get a construct by semantic ID within a page
 */
export function getConstruct(ydoc: Y.Doc, pageId: string, semanticId: string): CompilerNode | null {
  const nodes = listConstructs(ydoc, pageId);
  return nodes.find((n) => n.data.semanticId === semanticId) || null;
}

/**
 * Create a new construct in a page.
 * When parentId is provided, position is relative to the parent organizer.
 */
export function createConstruct(
  ydoc: Y.Doc,
  pageId: string,
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

  const pageNodes = getPageMap(ydoc, 'nodes', pageId);

  ydoc.transact(() => {
    const ynode = new Y.Map<unknown>();
    ynode.set('type', node.type);
    ynode.set('position', deepPlainToY(position));
    ynode.set('data', deepPlainToY(nodeData));
    if (parentId) ynode.set('parentId', parentId);
    pageNodes.set(nodeId, ynode as Y.Map<unknown>);
  }, MCP_ORIGIN);

  return node;
}

/**
 * Update an existing construct within a page
 */
export function updateConstruct(
  ydoc: Y.Doc,
  pageId: string,
  semanticId: string,
  updates: { values?: Record<string, unknown>; instanceColor?: string | null }
): CompilerNode | null {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);

  // Find the node by semantic ID
  let foundId: string | null = null;
  let foundYnode: Y.Map<unknown> | null = null;

  pageNodes.forEach((ynode, id) => {
    const data = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (data && safeGet(data, 'semanticId') === semanticId) {
      foundId = id;
      foundYnode = ynode;
    }
  });

  if (!foundId || !foundYnode) return null;

  ydoc.transact(() => {
    const rawData = foundYnode!.get('data') as Y.Map<unknown> | Record<string, unknown>;
    const ydata = ensureYMap(foundYnode!, rawData ?? {});

    if (updates.values !== undefined) {
      // Merge values
      const rawValues = ydata.get('values') as Y.Map<unknown> | Record<string, unknown> | undefined;
      let existingValues: Y.Map<unknown>;
      if (rawValues instanceof Y.Map) {
        existingValues = rawValues;
      } else {
        // values field was degraded to plain object, convert it
        existingValues = deepPlainToY(rawValues ?? {}) as Y.Map<unknown>;
        ydata.set('values', existingValues);
      }

      // Update each value individually
      for (const [key, value] of Object.entries(updates.values)) {
        existingValues.set(key, deepPlainToY(value));
      }
    }

    if (updates.instanceColor !== undefined) {
      ydata.set('instanceColor', updates.instanceColor);
    }
  }, MCP_ORIGIN);

  return getConstruct(ydoc, pageId, semanticId);
}

/**
 * Delete a construct and its connections within a page
 */
export function deleteConstruct(ydoc: Y.Doc, pageId: string, semanticId: string): boolean {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);
  const pageEdges = getPageMap(ydoc, 'edges', pageId);

  // Find the node by semantic ID
  let foundId: string | null = null;

  pageNodes.forEach((ynode, id) => {
    const data = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (data && safeGet(data, 'semanticId') === semanticId) {
      foundId = id;
    }
  });

  if (!foundId) return false;

  ydoc.transact(() => {
    // Find and delete attached wagons (organizers where attachedToSemanticId === this construct's semanticId)
    const wagonIds: string[] = [];
    pageNodes.forEach((ynode, id) => {
      const nodeObj = yToPlain(ynode) as Record<string, unknown>;
      if (nodeObj.type !== 'organizer') return;
      const data = nodeObj.data as OrganizerNodeData;
      if (data.attachedToSemanticId === semanticId) {
        wagonIds.push(id);
      }
    });

    for (const wagonId of wagonIds) {
      const wagonYnode = pageNodes.get(wagonId);
      if (!wagonYnode) continue;
      const wagonPos = yToPlain(wagonYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };

      // Detach wagon members: convert to absolute positions
      const memberIds: string[] = [];
      pageNodes.forEach((childYnode, childId) => {
        if (childId === wagonId) return;
        const parentId = childYnode.get('parentId') as string | undefined;
        if (parentId === wagonId) {
          memberIds.push(childId);
        }
      });

      for (const memberId of memberIds) {
        const memberYnode = pageNodes.get(memberId);
        if (!memberYnode) continue;
        const memberPos = yToPlain(memberYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
        const absolutePos = toAbsolutePosition(memberPos, wagonPos);
        memberYnode.set('position', deepPlainToY(absolutePos));
        memberYnode.delete('parentId');
      }

      // Remove edges connected to the wagon
      pageEdges.forEach((yedge, edgeId) => {
        if (yedge.get('source') === wagonId || yedge.get('target') === wagonId) {
          pageEdges.delete(edgeId);
        }
      });

      pageNodes.delete(wagonId);
    }

    // Remove edges connected to this node
    const edgesToDelete: string[] = [];
    pageEdges.forEach((yedge, edgeId) => {
      if (yedge.get('source') === foundId || yedge.get('target') === foundId) {
        edgesToDelete.push(edgeId);
      }
    });
    for (const edgeId of edgesToDelete) {
      pageEdges.delete(edgeId);
    }

    // Remove connections referencing this node from other nodes
    pageNodes.forEach((ynode) => {
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
    pageNodes.delete(foundId!);
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
  pageId: string,
  semanticId: string,
  targetParentId: string | null,
  position?: { x: number; y: number }
): CompilerNode | null {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);

  // Find the node by semantic ID
  let foundId: string | null = null;
  let foundYnode: Y.Map<unknown> | null = null;

  pageNodes.forEach((ynode, id) => {
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
    const targetOrg = pageNodes.get(targetParentId);
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
      const parentYnode = pageNodes.get(currentParentId);
      if (parentYnode) {
        const parentPos = yToPlain(parentYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
        newPos = toAbsolutePosition(currentPos, parentPos);
      } else {
        newPos = currentPos;
      }
    } else if (!currentParentId && targetParentId) {
      // Attaching: convert absolute → relative
      const parentYnode = pageNodes.get(targetParentId);
      if (parentYnode) {
        const parentPos = yToPlain(parentYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
        newPos = toRelativePosition(currentPos, parentPos);
      } else {
        newPos = currentPos;
      }
    } else if (currentParentId && targetParentId && currentParentId !== targetParentId) {
      // Moving between organizers: relative-to-old → absolute → relative-to-new
      const oldParent = pageNodes.get(currentParentId);
      const newParent = pageNodes.get(targetParentId);
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

  return getConstruct(ydoc, pageId, semanticId);
}

/**
 * Apply flow layout to constructs on a page.
 * Uses port topology to arrange nodes in layers.
 */
export function flowLayout(
  ydoc: Y.Doc,
  pageId: string,
  options: {
    direction: FlowDirection;
    sourcePort?: string;
    sinkPort?: string;
    layerGap?: number;
    nodeGap?: number;
    scope?: 'all' | string[];  // semantic IDs, default "all"
  }
): { updated: number; layers: Record<string, number> } {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);
  const pageEdges = getPageMap(ydoc, 'edges', pageId);

  // 1. Get all constructs (filter to top-level only, no organizer children)
  const allNodes = listConstructs(ydoc, pageId);
  const topLevelNodes = allNodes.filter(n => !n.parentId && n.type === 'construct');

  // 2. Filter by scope if requested
  let nodesToLayout = topLevelNodes;
  if (options.scope && Array.isArray(options.scope)) {
    const scopeSet = new Set(options.scope);
    nodesToLayout = topLevelNodes.filter(n => scopeSet.has(n.data.semanticId));
  }

  if (nodesToLayout.length === 0) {
    return { updated: 0, layers: {} };
  }

  // 3. Build FlowLayoutInput[] with default sizes
  const layoutInputs: FlowLayoutInput[] = nodesToLayout.map(n => ({
    id: n.id,
    semanticId: n.data.semanticId,
    x: n.position.x,
    y: n.position.y,
    width: 200,
    height: 100,
  }));

  // 4. Build FlowLayoutEdge[] from page edges
  const layoutEdges: FlowLayoutEdge[] = [];
  pageEdges.forEach((yedge) => {
    const source = yedge.get('source') as string;
    const target = yedge.get('target') as string;
    const sourceHandle = yedge.get('sourceHandle') as string | undefined;
    const targetHandle = yedge.get('targetHandle') as string | undefined;

    // Only include edges where both source and target are in our layout set
    const nodeIds = new Set(layoutInputs.map(n => n.id));
    if (nodeIds.has(source) && nodeIds.has(target)) {
      layoutEdges.push({
        sourceId: source,
        targetId: target,
        sourcePortId: sourceHandle ?? '',
        targetPortId: targetHandle ?? '',
      });
    }
  });

  // 5. Call computeFlowLayout
  const result = computeFlowLayout(layoutInputs, layoutEdges, {
    direction: options.direction,
    sourcePort: options.sourcePort,
    sinkPort: options.sinkPort,
    layerGap: options.layerGap,
    nodeGap: options.nodeGap,
  });

  // 6. Apply positions in a transaction
  ydoc.transact(() => {
    for (const [nodeId, pos] of result.positions) {
      const ynode = pageNodes.get(nodeId);
      if (ynode) {
        ynode.set('position', deepPlainToY({ x: pos.x, y: pos.y }));
      }
    }
  }, MCP_ORIGIN);

  // 7. Return results
  return {
    updated: result.positions.size,
    layers: Object.fromEntries(result.layers),
  };
}

/**
 * Arrange nodes using declarative constraints
 * @returns Number of nodes updated and constraints applied
 */
export function arrangeLayout(
  ydoc: Y.Doc,
  pageId: string,
  options: {
    strategy?: ArrangeStrategy;
    constraints: ArrangeConstraint[];
    scope?: 'all' | string[];  // semantic IDs
    nodeGap?: number;
    forceIterations?: number;
  }
): { updated: number; constraintsApplied: number } {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);

  // 1. Get all constructs (filter to top-level only, no organizer children)
  const allNodes = listConstructs(ydoc, pageId);
  const topLevelNodes = allNodes.filter(n => !n.parentId && n.type === 'construct');

  // 2. Filter by scope if requested
  let nodesToLayout = topLevelNodes;
  if (options.scope && Array.isArray(options.scope)) {
    const scopeSet = new Set(options.scope);
    nodesToLayout = topLevelNodes.filter(n => scopeSet.has(n.data.semanticId));
  }

  if (nodesToLayout.length === 0) {
    return { updated: 0, constraintsApplied: 0 };
  }

  // 3. Build ArrangeInput[] with default sizes
  const arrangeInputs: ArrangeInput[] = nodesToLayout.map(n => ({
    id: n.id,
    semanticId: n.data.semanticId,
    constructType: n.data.constructType,
    values: n.data.values ?? {},
    x: n.position.x,
    y: n.position.y,
    width: 200,
    height: 100,
  }));

  // 3b. Build ArrangeEdge[] from page edges (needed for flow constraint and force strategy)
  const pageEdges = getPageMap(ydoc, 'edges', pageId);
  const arrangeEdges: ArrangeEdge[] = [];
  const nodeIdSet = new Set(arrangeInputs.map(n => n.id));
  pageEdges.forEach((yedge) => {
    const source = yedge.get('source') as string;
    const target = yedge.get('target') as string;
    const sourceHandle = yedge.get('sourceHandle') as string | undefined;
    const targetHandle = yedge.get('targetHandle') as string | undefined;
    if (nodeIdSet.has(source) && nodeIdSet.has(target)) {
      arrangeEdges.push({
        sourceId: source,
        targetId: target,
        sourcePortId: sourceHandle ?? '',
        targetPortId: targetHandle ?? '',
      });
    }
  });

  // 4. Call computeArrangeLayout
  const result = computeArrangeLayout(arrangeInputs, {
    strategy: options.strategy ?? 'preserve',
    constraints: options.constraints,
    nodeGap: options.nodeGap,
    edges: arrangeEdges,
    forceIterations: options.forceIterations,
  });

  // 5. Apply positions in a transaction
  ydoc.transact(() => {
    for (const [nodeId, pos] of result.positions) {
      const ynode = pageNodes.get(nodeId);
      if (ynode) {
        ynode.set('position', deepPlainToY({ x: pos.x, y: pos.y }));
      }
    }
  }, MCP_ORIGIN);

  // 6. Return results
  return {
    updated: result.positions.size,
    constraintsApplied: result.constraintsApplied,
  };
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
 * List all organizers in a document page
 */
export function listOrganizers(ydoc: Y.Doc, pageId: string): OrganizerInfo[] {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);
  const organizers: OrganizerInfo[] = [];

  pageNodes.forEach((ynode, id) => {
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
 * Create an organizer node in a page
 */
export function createOrganizer(
  ydoc: Y.Doc,
  pageId: string,
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

  const pageNodes = getPageMap(ydoc, 'nodes', pageId);

  ydoc.transact(() => {
    const ynode = new Y.Map<unknown>();
    ynode.set('type', 'organizer');
    ynode.set('position', deepPlainToY(position));
    ynode.set('data', deepPlainToY(data));
    ynode.set('style', deepPlainToY({ width, height }));
    if (options.parentId) ynode.set('parentId', options.parentId);
    pageNodes.set(nodeId, ynode as Y.Map<unknown>);
  }, MCP_ORIGIN);

  return { id: nodeId, name: options.name, color, position, width, height, layout, collapsed: false, description: options.description, attachedToSemanticId: options.attachedToSemanticId };
}

/**
 * Update an organizer node
 */
export function updateOrganizer(
  ydoc: Y.Doc,
  pageId: string,
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
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);
  const ynode = pageNodes.get(organizerId);
  if (!ynode) return null;

  const nodeObj = yToPlain(ynode) as Record<string, unknown>;
  if (nodeObj.type !== 'organizer') return null;

  ydoc.transact(() => {
    const rawData = ynode.get('data') as Y.Map<unknown> | Record<string, unknown>;
    const ydataMap = ensureYMap(ynode, rawData ?? {});
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
  pageId: string,
  organizerId: string,
  deleteMembers = false
): boolean {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);
  const ynode = pageNodes.get(organizerId);
  if (!ynode) return false;

  const nodeObj = yToPlain(ynode) as Record<string, unknown>;
  if (nodeObj.type !== 'organizer') return false;

  const organizerPos = (nodeObj.position as { x: number; y: number }) || { x: 0, y: 0 };

  ydoc.transact(() => {
    // Find children
    const childIds: string[] = [];
    pageNodes.forEach((childYnode, childId) => {
      if (childId === organizerId) return;
      const parentId = childYnode.get('parentId') as string | undefined;
      if (parentId === organizerId) {
        childIds.push(childId);
      }
    });

    if (deleteMembers) {
      // Delete all children
      for (const childId of childIds) {
        pageNodes.delete(childId);
      }
    } else {
      // Detach: convert relative positions to absolute, remove parentId
      for (const childId of childIds) {
        const childYnode = pageNodes.get(childId);
        if (!childYnode) continue;

        const childPos = yToPlain(childYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
        const absolutePos = toAbsolutePosition(childPos, organizerPos);

        childYnode.set('position', deepPlainToY(absolutePos));
        childYnode.delete('parentId');
      }
    }

    // Delete the organizer itself
    pageNodes.delete(organizerId);
  }, MCP_ORIGIN);

  return true;
}

// ===== CONNECTION OPERATIONS =====

/**
 * Connect two constructs via ports within a page
 */
export function connect(
  ydoc: Y.Doc,
  pageId: string,
  sourceSemanticId: string,
  sourcePortId: string,
  targetSemanticId: string,
  targetPortId: string
): CompilerEdge | null {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);
  const pageEdges = getPageMap(ydoc, 'edges', pageId);

  // Find source and target nodes
  let sourceNodeId: string | null = null;
  let targetNodeId: string | null = null;
  let sourceYdata: Y.Map<unknown> | null = null;

  pageNodes.forEach((ynode, id) => {
    const ydata = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (ydata) {
      const sid = safeGet(ydata, 'semanticId');
      if (sid === sourceSemanticId) {
        sourceNodeId = id;
        sourceYdata = ensureYMap(ynode, ydata);
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
    pageEdges.set(edgeId, yedge as Y.Map<unknown>);

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
 * Disconnect two constructs within a page
 */
export function disconnect(
  ydoc: Y.Doc,
  pageId: string,
  sourceSemanticId: string,
  sourcePortId: string,
  targetSemanticId: string
): boolean {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);
  const pageEdges = getPageMap(ydoc, 'edges', pageId);

  // Find source and target node IDs
  let sourceNodeId: string | null = null;
  let targetNodeId: string | null = null;
  let sourceYdata: Y.Map<unknown> | null = null;

  pageNodes.forEach((ynode, id) => {
    const ydata = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (ydata) {
      const sid = safeGet(ydata, 'semanticId');
      if (sid === sourceSemanticId) {
        sourceNodeId = id;
        sourceYdata = ensureYMap(ynode, ydata);
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
      pageEdges.forEach((yedge, edgeId) => {
        if (
          yedge.get('source') === sourceNodeId &&
          yedge.get('target') === targetNodeId &&
          yedge.get('sourceHandle') === sourcePortId
        ) {
          edgesToDelete.push(edgeId);
        }
      });
      for (const edgeId of edgesToDelete) {
        pageEdges.delete(edgeId);
      }
    }
  }, MCP_ORIGIN);

  return true;
}

// ===== SCHEMA OPERATIONS (shared across pages) =====

/**
 * List all schemas (built-in + custom)
 */
export function listSchemas(ydoc: Y.Doc): ConstructSchema[] {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const schemas: ConstructSchema[] = [];

  yschemas.forEach((yschema) => {
    schemas.push(yToPlain(yschema) as ConstructSchema);
  });

  return schemas;
}

/**
 * Get a schema by type
 */
export function getSchema(ydoc: Y.Doc, type: string): ConstructSchema | null {
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

/**
 * Update non-breaking properties of an existing schema.
 * Rejects updates to `type` (rename), `fields` (structural), and `ports` (structural).
 * Uses full-replace semantics: read current → merge updates → write back.
 */
export function updateSchema(
  ydoc: Y.Doc,
  type: string,
  updates: Record<string, unknown>,
  origin: string = MCP_ORIGIN
): ConstructSchema | null {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yschema = yschemas.get(type);
  if (!yschema) return null;

  // Reject forbidden keys
  const forbidden = ['type', 'fields', 'ports'];
  const forbiddenFound = forbidden.filter(k => k in updates);
  if (forbiddenFound.length > 0) {
    throw new Error(`Cannot update forbidden keys: ${forbiddenFound.join(', ')}. Use migration operations.`);
  }

  // Read current, merge, write back
  const current = yToPlain(yschema) as Record<string, unknown>;

  // Handle field metadata updates: updates.fieldUpdates is Record<fieldName, {label?, description?, ...}>
  let mergedFields = current.fields;
  if ('fieldUpdates' in updates) {
    const fieldUpdates = updates.fieldUpdates as Record<string, Record<string, unknown>>;
    delete updates.fieldUpdates;
    const fields = (current.fields as Array<Record<string, unknown>>) || [];
    mergedFields = fields.map(f => {
      const fieldPatch = fieldUpdates[f.name as string];
      if (!fieldPatch) return f;
      // Only allow non-structural field properties
      const { name: _n, type: _t, options: _o, ...safeUpdates } = fieldPatch;
      return { ...f, ...safeUpdates };
    });
  }

  const merged = { ...current, ...updates, fields: mergedFields };

  ydoc.transact(() => {
    yschemas.set(type, deepPlainToY(merged) as Y.Map<unknown>);
  }, origin);

  return merged as unknown as ConstructSchema;
}

// ===== SCHEMA MIGRATION OPERATIONS =====

export function renameField(
  ydoc: Y.Doc,
  schemaType: string,
  oldName: string,
  newName: string,
  origin: string = MCP_ORIGIN
): MigrationResult {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yschema = yschemas.get(schemaType);
  if (!yschema) throw new Error(`Schema not found: ${schemaType}`);

  const current = yToPlain(yschema) as Record<string, unknown>;
  const fields = current.fields as Array<Record<string, unknown>>;

  // Validate: old field exists, new field doesn't
  const fieldIdx = fields.findIndex(f => f.name === oldName);
  if (fieldIdx === -1) throw new Error(`Field not found: ${oldName}`);
  if (fields.some(f => f.name === newName)) throw new Error(`Field already exists: ${newName}`);

  let instancesUpdated = 0;

  ydoc.transact(() => {
    // 1. Update schema field name
    const updatedFields = fields.map((f, i) => i === fieldIdx ? { ...f, name: newName } : f);
    const merged: Record<string, unknown> = { ...current, fields: updatedFields };

    // Update displayField if it references the old name
    if (merged.displayField === oldName) merged.displayField = newName;

    yschemas.set(schemaType, deepPlainToY(merged) as Y.Map<unknown>);

    // 2. Migrate instance values across all pages
    forEachInstanceOfType(ydoc, schemaType, (ydata) => {
      const yvalues = ydata.get('values') as Y.Map<unknown> | undefined;
      if (!yvalues || !yvalues.has(oldName)) return;
      const value = yvalues.get(oldName);
      yvalues.delete(oldName);
      yvalues.set(newName, value);
      instancesUpdated++;
    });
  }, origin);

  return { schemaUpdated: true, instancesUpdated, edgesUpdated: 0, edgesRemoved: 0, warnings: [] };
}

export function removeField(
  ydoc: Y.Doc,
  schemaType: string,
  fieldName: string,
  origin: string = MCP_ORIGIN
): MigrationResult {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yschema = yschemas.get(schemaType);
  if (!yschema) throw new Error(`Schema not found: ${schemaType}`);

  const current = yToPlain(yschema) as Record<string, unknown>;
  const fields = current.fields as Array<Record<string, unknown>>;

  const fieldIdx = fields.findIndex(f => f.name === fieldName);
  if (fieldIdx === -1) throw new Error(`Field not found: ${fieldName}`);

  let instancesUpdated = 0;

  ydoc.transact(() => {
    // 1. Remove field from schema
    const updatedFields = fields.filter((_, i) => i !== fieldIdx);
    const merged: Record<string, unknown> = { ...current, fields: updatedFields };
    if (merged.displayField === fieldName) delete merged.displayField;

    yschemas.set(schemaType, deepPlainToY(merged) as Y.Map<unknown>);

    // 2. Remove field values from all instances
    forEachInstanceOfType(ydoc, schemaType, (ydata) => {
      const yvalues = ydata.get('values') as Y.Map<unknown> | undefined;
      if (!yvalues || !yvalues.has(fieldName)) return;
      yvalues.delete(fieldName);
      instancesUpdated++;
    });
  }, origin);

  return { schemaUpdated: true, instancesUpdated, edgesUpdated: 0, edgesRemoved: 0, warnings: [] };
}

export function addField(
  ydoc: Y.Doc,
  schemaType: string,
  field: Record<string, unknown>,
  defaultValue?: unknown,
  origin: string = MCP_ORIGIN
): MigrationResult {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yschema = yschemas.get(schemaType);
  if (!yschema) throw new Error(`Schema not found: ${schemaType}`);

  const current = yToPlain(yschema) as Record<string, unknown>;
  const fields = current.fields as Array<Record<string, unknown>>;

  if (!field.name) throw new Error('Field must have a name');
  if (fields.some(f => f.name === field.name)) throw new Error(`Field already exists: ${field.name}`);

  let instancesUpdated = 0;

  ydoc.transact(() => {
    // 1. Add field to schema
    const updatedFields = [...fields, field];
    const merged = { ...current, fields: updatedFields };
    yschemas.set(schemaType, deepPlainToY(merged) as Y.Map<unknown>);

    // 2. If defaultValue provided, populate existing instances
    if (defaultValue !== undefined) {
      forEachInstanceOfType(ydoc, schemaType, (ydata) => {
        let yvalues = ydata.get('values') as Y.Map<unknown> | undefined;
        if (!yvalues) {
          yvalues = new Y.Map();
          ydata.set('values', yvalues);
        }
        yvalues.set(field.name as string, defaultValue);
        instancesUpdated++;
      });
    }
  }, origin);

  return { schemaUpdated: true, instancesUpdated, edgesUpdated: 0, edgesRemoved: 0, warnings: [] };
}

export function renamePort(
  ydoc: Y.Doc,
  schemaType: string,
  oldPortId: string,
  newPortId: string,
  origin: string = MCP_ORIGIN
): MigrationResult {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yschema = yschemas.get(schemaType);
  if (!yschema) throw new Error(`Schema not found: ${schemaType}`);

  const current = yToPlain(yschema) as Record<string, unknown>;
  const ports = current.ports as Array<Record<string, unknown>>;

  const portIdx = ports.findIndex(p => p.id === oldPortId);
  if (portIdx === -1) throw new Error(`Port not found: ${oldPortId}`);
  if (ports.some(p => p.id === newPortId)) throw new Error(`Port already exists: ${newPortId}`);

  let edgesUpdated = 0;

  ydoc.transact(() => {
    // 1. Update schema port id
    const updatedPorts = ports.map((p, i) => i === portIdx ? { ...p, id: newPortId } : p);
    const merged = { ...current, ports: updatedPorts };
    yschemas.set(schemaType, deepPlainToY(merged) as Y.Map<unknown>);

    // 2. Collect node IDs that are instances of this schema type (per page) and semanticIds
    const instanceNodeIds = new Map<string, Set<string>>(); // pageId → Set<nodeId>
    const instanceSemanticIds = new Set<string>();
    forEachInstanceOfType(ydoc, schemaType, (ydata, nodeId, pageId) => {
      if (!instanceNodeIds.has(pageId)) instanceNodeIds.set(pageId, new Set());
      instanceNodeIds.get(pageId)!.add(nodeId);
      instanceSemanticIds.add(safeGet(ydata, 'semanticId') as string);

      // 3. Also update connections array on this node
      const yconns = ydata.get('connections') as Y.Array<unknown> | undefined;
      if (yconns) {
        for (let i = 0; i < yconns.length; i++) {
          const conn = yconns.get(i) as Y.Map<unknown> | Record<string, unknown>;
          const portId = conn instanceof Y.Map ? conn.get('portId') : (conn as Record<string, unknown>).portId;
          if (portId === oldPortId) {
            if (conn instanceof Y.Map) {
              conn.set('portId', newPortId);
            }
          }
        }
      }
    });

    // 4. Update edges across all pages
    forEachEdge(ydoc, (yedge, _edgeId, pageId) => {
      const pageInstances = instanceNodeIds.get(pageId);
      if (!pageInstances) return;

      const source = yedge.get('source') as string;
      const target = yedge.get('target') as string;
      let updated = false;

      if (pageInstances.has(source) && yedge.get('sourceHandle') === oldPortId) {
        yedge.set('sourceHandle', newPortId);
        updated = true;
      }
      if (pageInstances.has(target) && yedge.get('targetHandle') === oldPortId) {
        yedge.set('targetHandle', newPortId);
        updated = true;
      }
      if (updated) edgesUpdated++;
    });

    // 5. Update connections on OTHER nodes that target instances of this type via targetPortId
    const ypages = ydoc.getMap<Y.Map<unknown>>('pages');
    const ynodesContainer = ydoc.getMap<Y.Map<unknown>>('nodes');
    ypages.forEach((_, pageId) => {
      const pageNodes = ynodesContainer.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
      if (!pageNodes) return;
      pageNodes.forEach((ynode) => {
        const ydata = ynode.get('data') as Y.Map<unknown> | undefined;
        if (!ydata) return;
        const yconns = ydata.get('connections') as Y.Array<unknown> | undefined;
        if (!yconns) return;
        for (let i = 0; i < yconns.length; i++) {
          const conn = yconns.get(i) as Y.Map<unknown> | Record<string, unknown>;
          if (conn instanceof Y.Map) {
            const targetSid = conn.get('targetSemanticId') as string;
            const targetPort = conn.get('targetPortId') as string;
            if (instanceSemanticIds.has(targetSid) && targetPort === oldPortId) {
              conn.set('targetPortId', newPortId);
            }
          }
        }
      });
    });
  }, origin);

  return { schemaUpdated: true, instancesUpdated: 0, edgesUpdated, edgesRemoved: 0, warnings: [] };
}

export function removePort(
  ydoc: Y.Doc,
  schemaType: string,
  portId: string,
  origin: string = MCP_ORIGIN
): MigrationResult {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yschema = yschemas.get(schemaType);
  if (!yschema) throw new Error(`Schema not found: ${schemaType}`);

  const current = yToPlain(yschema) as Record<string, unknown>;
  const ports = current.ports as Array<Record<string, unknown>>;

  const portIdx = ports.findIndex(p => p.id === portId);
  if (portIdx === -1) throw new Error(`Port not found: ${portId}`);

  let edgesRemoved = 0;

  ydoc.transact(() => {
    // 1. Remove port from schema
    const updatedPorts = ports.filter((_, i) => i !== portIdx);
    const merged = { ...current, ports: updatedPorts };
    yschemas.set(schemaType, deepPlainToY(merged) as Y.Map<unknown>);

    // 2. Collect instance node IDs and semanticIds
    const instanceNodeIds = new Map<string, Set<string>>(); // pageId → Set<nodeId>
    const instanceSemanticIds = new Set<string>();
    forEachInstanceOfType(ydoc, schemaType, (ydata, nodeId, pageId) => {
      if (!instanceNodeIds.has(pageId)) instanceNodeIds.set(pageId, new Set());
      instanceNodeIds.get(pageId)!.add(nodeId);
      instanceSemanticIds.add(safeGet(ydata, 'semanticId') as string);

      // Remove matching entries from this node's connections array
      const yconns = ydata.get('connections') as Y.Array<unknown> | undefined;
      if (yconns) {
        // Iterate in reverse to safely delete
        for (let i = yconns.length - 1; i >= 0; i--) {
          const conn = yconns.get(i) as Y.Map<unknown> | Record<string, unknown>;
          const connPortId = conn instanceof Y.Map ? conn.get('portId') : (conn as Record<string, unknown>).portId;
          if (connPortId === portId) yconns.delete(i, 1);
        }
      }
    });

    // 3. Delete edges that use this port on instances of this type
    edgesRemoved = forEachEdge(ydoc, (yedge, _edgeId, pageId) => {
      const pageInstances = instanceNodeIds.get(pageId);
      if (!pageInstances) return false;

      const source = yedge.get('source') as string;
      const target = yedge.get('target') as string;
      const sourceHandle = yedge.get('sourceHandle') as string;
      const targetHandle = yedge.get('targetHandle') as string;

      const sourceMatch = pageInstances.has(source) && sourceHandle === portId;
      const targetMatch = pageInstances.has(target) && targetHandle === portId;
      return sourceMatch || targetMatch;
    });

    // 4. Clean up connections on OTHER nodes that targeted the removed port
    const ypages = ydoc.getMap<Y.Map<unknown>>('pages');
    const ynodesContainer = ydoc.getMap<Y.Map<unknown>>('nodes');
    ypages.forEach((_, pageId) => {
      const pageNodes = ynodesContainer.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
      if (!pageNodes) return;
      pageNodes.forEach((ynode) => {
        const ydata = ynode.get('data') as Y.Map<unknown> | undefined;
        if (!ydata) return;
        const yconns = ydata.get('connections') as Y.Array<unknown> | undefined;
        if (!yconns) return;
        for (let i = yconns.length - 1; i >= 0; i--) {
          const conn = yconns.get(i) as Y.Map<unknown> | Record<string, unknown>;
          const targetSid = conn instanceof Y.Map ? conn.get('targetSemanticId') as string : (conn as Record<string, unknown>).targetSemanticId as string;
          const targetPort = conn instanceof Y.Map ? conn.get('targetPortId') as string : (conn as Record<string, unknown>).targetPortId as string;
          if (instanceSemanticIds.has(targetSid) && targetPort === portId) {
            yconns.delete(i, 1);
          }
        }
      });
    });
  }, origin);

  return { schemaUpdated: true, instancesUpdated: 0, edgesUpdated: 0, edgesRemoved, warnings: [] };
}

/**
 * Rename a schema type (tier 2).
 * Re-keys the schema, updates all instances, and updates suggestedTypes references in other schemas.
 */
export function renameSchemaType(
  ydoc: Y.Doc,
  oldType: string,
  newType: string,
  origin: string = MCP_ORIGIN
): MigrationResult {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yschema = yschemas.get(oldType);
  if (!yschema) throw new Error(`Schema not found: ${oldType}`);
  if (yschemas.has(newType)) throw new Error(`Schema already exists: ${newType}`);

  // Block renaming built-in schemas
  if (builtInConstructSchemas.some(s => s.type === oldType)) {
    throw new Error(`Cannot rename built-in schema: ${oldType}`);
  }

  let instancesUpdated = 0;

  ydoc.transact(() => {
    // 1. Re-key schema
    const current = yToPlain(yschema) as Record<string, unknown>;
    const updated = { ...current, type: newType };
    yschemas.delete(oldType);
    yschemas.set(newType, deepPlainToY(updated) as Y.Map<unknown>);

    // 2. Update constructType on all instances
    forEachInstanceOfType(ydoc, oldType, (ydata) => {
      ydata.set('constructType', newType);
      instancesUpdated++;
    });

    // 3. Update suggestedTypes references in ALL schemas' port configs
    yschemas.forEach((otherSchema, otherType) => {
      const otherPlain = yToPlain(otherSchema) as Record<string, unknown>;
      const ports = otherPlain.ports as Array<Record<string, unknown>> | undefined;
      if (!ports) return;

      let changed = false;
      const updatedPorts = ports.map(port => {
        const suggested = port.suggestedTypes as string[] | undefined;
        if (!suggested || !suggested.includes(oldType)) return port;
        changed = true;
        return {
          ...port,
          suggestedTypes: suggested.map(t => t === oldType ? newType : t)
        };
      });

      if (changed) {
        const mergedOther = { ...otherPlain, ports: updatedPorts };
        yschemas.set(otherType, deepPlainToY(mergedOther) as Y.Map<unknown>);
      }
    });
  }, origin);

  return { schemaUpdated: true, instancesUpdated, edgesUpdated: 0, edgesRemoved: 0, warnings: [] };
}

/**
 * Change a field's data type (tier 2).
 * Default behavior is dry-run (force=false) which previews data loss.
 * Set force=true to execute.
 */
export function changeFieldType(
  ydoc: Y.Doc,
  schemaType: string,
  fieldName: string,
  newType: string,
  options?: {
    force?: boolean;
    enumOptions?: string[];
  },
  origin: string = MCP_ORIGIN
): MigrationResult {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yschema = yschemas.get(schemaType);
  if (!yschema) throw new Error(`Schema not found: ${schemaType}`);

  const current = yToPlain(yschema) as Record<string, unknown>;
  const fields = current.fields as Array<Record<string, unknown>>;
  const fieldIdx = fields.findIndex(f => f.name === fieldName);
  if (fieldIdx === -1) throw new Error(`Field not found: ${fieldName}`);

  const oldType = fields[fieldIdx].type as string;
  if (oldType === newType) throw new Error(`Field is already type: ${newType}`);
  if (newType === 'enum' && (!options?.enumOptions || options.enumOptions.length === 0)) {
    throw new Error('enumOptions required when changing to enum type');
  }

  const dryRun = !options?.force;
  const warnings: string[] = [];
  let instancesUpdated = 0;

  // Coercion function
  const coerce = (value: unknown): { result: unknown; lossy: boolean } => {
    if (value === undefined || value === null) return { result: value, lossy: false };

    // string → number
    if (oldType === 'string' && newType === 'number') {
      const n = parseFloat(value as string);
      if (isNaN(n)) return { result: undefined, lossy: true };
      return { result: n, lossy: false };
    }
    // number → string
    if (oldType === 'number' && newType === 'string') {
      return { result: String(value), lossy: false };
    }
    // enum → string
    if (oldType === 'enum' && newType === 'string') {
      return { result: value, lossy: false };
    }
    // string → enum
    if (oldType === 'string' && newType === 'enum') {
      if (options?.enumOptions?.includes(value as string)) return { result: value, lossy: false };
      return { result: undefined, lossy: true };
    }
    // Same type (shouldn't happen, caught above)
    if (oldType === newType) return { result: value, lossy: false };
    // All other conversions: clear
    return { result: undefined, lossy: true };
  };

  // Preview pass: count lossy instances
  let lossyCount = 0;
  forEachInstanceOfType(ydoc, schemaType, (ydata) => {
    const yvalues = ydata.get('values') as Y.Map<unknown> | undefined;
    if (!yvalues || !yvalues.has(fieldName)) return;
    const { lossy } = coerce(yvalues.get(fieldName));
    if (lossy) lossyCount++;
  });

  if (lossyCount > 0) {
    warnings.push(`${lossyCount} instance(s) will lose data on field '${fieldName}' (unconvertible ${oldType} → ${newType})`);
  }

  if (dryRun) {
    // Count total affected instances
    let totalAffected = 0;
    forEachInstanceOfType(ydoc, schemaType, () => { totalAffected++; });
    return {
      dryRun: true,
      schemaUpdated: false,
      instancesUpdated: totalAffected,
      edgesUpdated: 0,
      edgesRemoved: 0,
      warnings,
    };
  }

  // Execute
  ydoc.transact(() => {
    // 1. Update schema field type
    const updatedField: Record<string, unknown> = { ...fields[fieldIdx], type: newType };
    // Clear old options if changing away from enum, set new options if changing to enum
    if (newType !== 'enum') {
      delete updatedField.options;
    } else if (options?.enumOptions) {
      updatedField.options = options.enumOptions;
    }
    const updatedFields = fields.map((f, i) => i === fieldIdx ? updatedField : f);
    const merged = { ...current, fields: updatedFields };
    yschemas.set(schemaType, deepPlainToY(merged) as Y.Map<unknown>);

    // 2. Coerce instance values
    forEachInstanceOfType(ydoc, schemaType, (ydata) => {
      const yvalues = ydata.get('values') as Y.Map<unknown> | undefined;
      if (!yvalues || !yvalues.has(fieldName)) return;
      const { result, lossy } = coerce(yvalues.get(fieldName));
      if (lossy || result === undefined) {
        yvalues.delete(fieldName);
      } else {
        yvalues.set(fieldName, result);
      }
      instancesUpdated++;
    });
  }, origin);

  return { schemaUpdated: true, instancesUpdated, edgesUpdated: 0, edgesRemoved: 0, warnings };
}

/**
 * Narrow enum field options (tier 2).
 * Remap values via valueMapping or clear orphaned values.
 */
export function narrowEnumOptions(
  ydoc: Y.Doc,
  schemaType: string,
  fieldName: string,
  newOptions: string[],
  valueMapping?: Record<string, string>,
  origin: string = MCP_ORIGIN
): MigrationResult {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yschema = yschemas.get(schemaType);
  if (!yschema) throw new Error(`Schema not found: ${schemaType}`);

  const current = yToPlain(yschema) as Record<string, unknown>;
  const fields = current.fields as Array<Record<string, unknown>>;
  const fieldIdx = fields.findIndex(f => f.name === fieldName);
  if (fieldIdx === -1) throw new Error(`Field not found: ${fieldName}`);
  if (fields[fieldIdx].type !== 'enum') throw new Error(`Field '${fieldName}' is not an enum`);
  if (newOptions.length === 0) throw new Error('newOptions must not be empty');

  let instancesUpdated = 0;
  const warnings: string[] = [];

  ydoc.transact(() => {
    // 1. Update schema enum options
    const updatedField = { ...fields[fieldIdx], options: newOptions };
    const updatedFields = fields.map((f, i) => i === fieldIdx ? updatedField : f);
    const merged = { ...current, fields: updatedFields };
    yschemas.set(schemaType, deepPlainToY(merged) as Y.Map<unknown>);

    // 2. Remap or clear orphaned instance values
    forEachInstanceOfType(ydoc, schemaType, (ydata) => {
      const yvalues = ydata.get('values') as Y.Map<unknown> | undefined;
      if (!yvalues || !yvalues.has(fieldName)) return;
      const oldValue = yvalues.get(fieldName) as string;

      // Check if value is still valid
      if (newOptions.includes(oldValue)) return;

      // Try value mapping
      const mapped = valueMapping?.[oldValue];
      if (mapped && newOptions.includes(mapped)) {
        yvalues.set(fieldName, mapped);
        instancesUpdated++;
        return;
      }

      // Clear orphaned value
      yvalues.delete(fieldName);
      instancesUpdated++;
      warnings.push(`Cleared orphaned enum value '${oldValue}' on instance`);
    });
  }, origin);

  return { schemaUpdated: true, instancesUpdated, edgesUpdated: 0, edgesRemoved: 0, warnings };
}

/**
 * Add a new port to a schema (tier 2).
 * Schema-only operation, no instance fixup needed.
 */
export function addPort(
  ydoc: Y.Doc,
  schemaType: string,
  portConfig: Record<string, unknown>,
  origin: string = MCP_ORIGIN
): MigrationResult {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yschema = yschemas.get(schemaType);
  if (!yschema) throw new Error(`Schema not found: ${schemaType}`);

  const current = yToPlain(yschema) as Record<string, unknown>;
  const ports = (current.ports as Array<Record<string, unknown>>) || [];

  if (!portConfig.id) throw new Error('Port must have an id');
  if (!portConfig.portType) throw new Error('Port must have a portType');
  if (ports.some(p => p.id === portConfig.id)) throw new Error(`Port already exists: ${portConfig.id}`);

  ydoc.transact(() => {
    const updatedPorts = [...ports, portConfig];
    const merged = { ...current, ports: updatedPorts };
    yschemas.set(schemaType, deepPlainToY(merged) as Y.Map<unknown>);
  }, origin);

  return { schemaUpdated: true, instancesUpdated: 0, edgesUpdated: 0, edgesRemoved: 0, warnings: [] };
}

/**
 * Change a port's type reference (tier 2).
 * Disconnects edges that become incompatible with the new port type.
 */
export function changePortType(
  ydoc: Y.Doc,
  schemaType: string,
  portId: string,
  newPortType: string,
  origin: string = MCP_ORIGIN
): MigrationResult {
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yschema = yschemas.get(schemaType);
  if (!yschema) throw new Error(`Schema not found: ${schemaType}`);

  const current = yToPlain(yschema) as Record<string, unknown>;
  const ports = current.ports as Array<Record<string, unknown>>;
  const portIdx = ports.findIndex(p => p.id === portId);
  if (portIdx === -1) throw new Error(`Port not found: ${portId}`);

  let edgesRemoved = 0;

  ydoc.transact(() => {
    // 1. Update schema port type
    const updatedPorts = ports.map((p, i) => i === portIdx ? { ...p, portType: newPortType } : p);
    const merged = { ...current, ports: updatedPorts };
    yschemas.set(schemaType, deepPlainToY(merged) as Y.Map<unknown>);

    // 2. Collect instance node IDs and semanticIds
    const instanceNodeIds = new Map<string, Set<string>>();
    const instanceSemanticIds = new Set<string>();
    forEachInstanceOfType(ydoc, schemaType, (ydata, nodeId, pageId) => {
      if (!instanceNodeIds.has(pageId)) instanceNodeIds.set(pageId, new Set());
      instanceNodeIds.get(pageId)!.add(nodeId);
      instanceSemanticIds.add(safeGet(ydata, 'semanticId') as string);
    });

    // Helper: resolve portType for a node's port handle
    const resolvePortType = (nodeId: string, handleId: string, pageId: string): string | null => {
      const ynodesContainer = ydoc.getMap<Y.Map<unknown>>('nodes');
      const pageNodes = ynodesContainer.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
      if (!pageNodes) return null;
      const ynode = pageNodes.get(nodeId);
      if (!ynode) return null;
      const ydata = ynode.get('data') as Y.Map<unknown> | undefined;
      if (!ydata) return null;
      const nodeType = safeGet(ydata, 'constructType') as string;
      // Look up schema for this node
      const nodeSchema = yToPlain(yschemas.get(nodeType) || new Y.Map()) as Record<string, unknown>;
      const nodePorts = (nodeSchema.ports as Array<Record<string, unknown>>) || [];
      const port = nodePorts.find(p => p.id === handleId);
      // If this is the port we just changed, use the NEW portType
      if (nodeType === schemaType && handleId === portId) return newPortType;
      return (port?.portType as string) || null;
    };

    // 3. Check each edge touching affected instances on the changed port and remove incompatible ones
    edgesRemoved = forEachEdge(ydoc, (yedge, _edgeId, pageId) => {
      const pageInstances = instanceNodeIds.get(pageId);
      if (!pageInstances) return false;

      const source = yedge.get('source') as string;
      const target = yedge.get('target') as string;
      const sourceHandle = yedge.get('sourceHandle') as string;
      const targetHandle = yedge.get('targetHandle') as string;

      const sourceIsAffected = pageInstances.has(source) && sourceHandle === portId;
      const targetIsAffected = pageInstances.has(target) && targetHandle === portId;
      if (!sourceIsAffected && !targetIsAffected) return false;

      // Resolve both port types
      const sourcePortType = resolvePortType(source, sourceHandle, pageId);
      const targetPortType = resolvePortType(target, targetHandle, pageId);
      if (!sourcePortType || !targetPortType) return true; // Can't resolve → remove

      // Check compatibility with new port type
      return !canConnect(sourcePortType, targetPortType);
    });

    // 4. Clean up orphaned connections after edge removal
    if (edgesRemoved > 0) {
      const yedgesContainer = ydoc.getMap<Y.Map<unknown>>('edges');
      const ypages = ydoc.getMap<Y.Map<unknown>>('pages');

      // Build set of surviving edges touching affected instances on the changed port
      const survivingConnections = new Set<string>(); // "sourceNodeId:portId:targetNodeId:targetPortId"
      ypages.forEach((_, pageId) => {
        const pageEdges = yedgesContainer.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
        if (!pageEdges) return;
        const pageInstances = instanceNodeIds.get(pageId);
        if (!pageInstances) return;
        pageEdges.forEach((yedge) => {
          const source = yedge.get('source') as string;
          const target = yedge.get('target') as string;
          const sh = yedge.get('sourceHandle') as string;
          const th = yedge.get('targetHandle') as string;
          if (pageInstances.has(source) && sh === portId) {
            survivingConnections.add(`${source}:${sh}:${target}:${th}`);
          }
        });
      });

      // Remove orphaned connection entries on affected instances
      forEachInstanceOfType(ydoc, schemaType, (ydata, nodeId, pageId) => {
        const yconns = ydata.get('connections') as Y.Array<unknown> | undefined;
        if (!yconns) return;

        const ynodesContainer = ydoc.getMap<Y.Map<unknown>>('nodes');
        const pageNodes = ynodesContainer.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
        if (!pageNodes) return;

        // Build semanticId → nodeId map for this page
        const sidToNodeId = new Map<string, string>();
        pageNodes.forEach((ynode, nid) => {
          const nd = ynode.get('data') as Y.Map<unknown> | undefined;
          if (nd) sidToNodeId.set(safeGet(nd, 'semanticId') as string, nid);
        });

        for (let i = yconns.length - 1; i >= 0; i--) {
          const conn = yconns.get(i) as Y.Map<unknown> | Record<string, unknown>;
          const cp = conn instanceof Y.Map ? conn.get('portId') as string : (conn as Record<string, unknown>).portId as string;
          if (cp !== portId) continue;
          const targetSid = conn instanceof Y.Map ? conn.get('targetSemanticId') as string : (conn as Record<string, unknown>).targetSemanticId as string;
          const targetPort = conn instanceof Y.Map ? conn.get('targetPortId') as string : (conn as Record<string, unknown>).targetPortId as string;
          const targetNodeId = sidToNodeId.get(targetSid);
          if (!targetNodeId) { yconns.delete(i, 1); continue; }
          const key = `${nodeId}:${portId}:${targetNodeId}:${targetPort}`;
          if (!survivingConnections.has(key)) {
            yconns.delete(i, 1);
          }
        }
      });

      // Also clean connections on OTHER nodes that targeted affected instances via this port
      const ynodesContainer = ydoc.getMap<Y.Map<unknown>>('nodes');
      ypages.forEach((_, pageId) => {
        const pageNodes = ynodesContainer.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
        if (!pageNodes) return;
        pageNodes.forEach((ynode) => {
          const ydata = ynode.get('data') as Y.Map<unknown> | undefined;
          if (!ydata) return;
          const yconns = ydata.get('connections') as Y.Array<unknown> | undefined;
          if (!yconns) return;
          for (let i = yconns.length - 1; i >= 0; i--) {
            const conn = yconns.get(i) as Y.Map<unknown> | Record<string, unknown>;
            const targetSid = conn instanceof Y.Map ? conn.get('targetSemanticId') as string : (conn as Record<string, unknown>).targetSemanticId as string;
            const targetPort = conn instanceof Y.Map ? conn.get('targetPortId') as string : (conn as Record<string, unknown>).targetPortId as string;
            if (instanceSemanticIds.has(targetSid) && targetPort === portId) {
              yconns.delete(i, 1);
            }
          }
        });
      });
    }
  }, origin);

  return { schemaUpdated: true, instancesUpdated: 0, edgesUpdated: 0, edgesRemoved, warnings: [] };
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
  pageId: string,
  specs: Array<{
    constructType: string;
    values?: Record<string, unknown>;
    x?: number;
    y?: number;
    parentId?: string;
  }>
): CompilerNode[] {
  const existingNodes = listConstructs(ydoc, pageId);
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);
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
      pageNodes.set(nodeId, ynode as Y.Map<unknown>);

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
  pageId: string,
  connections: Array<{
    sourceSemanticId: string;
    sourcePortId: string;
    targetSemanticId: string;
    targetPortId: string;
  }>
): Array<{ edge: CompilerEdge | null; error?: string }> {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);
  const pageEdges = getPageMap(ydoc, 'edges', pageId);

  // Build a lookup of semanticId → { nodeId, ydata }
  const nodeMap = new Map<string, { nodeId: string; ydata: Y.Map<unknown> }>();
  pageNodes.forEach((ynode, id) => {
    const ydata = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
    if (ydata) {
      const sid = safeGet(ydata, 'semanticId') as string | undefined;
      if (sid) nodeMap.set(sid, { nodeId: id, ydata: ensureYMap(ynode, ydata) });
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
      pageEdges.set(edgeId, yedge as Y.Map<unknown>);

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
  pageId: string,
  semanticIds: string[]
): Array<{ semanticId: string; deleted: boolean; error?: string }> {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);
  const pageEdges = getPageMap(ydoc, 'edges', pageId);

  // Build lookup: semanticId → nodeId
  const semanticToNodeId = new Map<string, string>();
  pageNodes.forEach((ynode, id) => {
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
    pageNodes.forEach((ynode, id) => {
      const nodeObj = yToPlain(ynode) as Record<string, unknown>;
      if (nodeObj.type !== 'organizer') return;
      const data = nodeObj.data as OrganizerNodeData;
      if (data.attachedToSemanticId && semanticIdSet.has(data.attachedToSemanticId)) {
        wagonIdsToDelete.add(id);
      }
    });

    // Detach wagon members before deleting wagons
    for (const wagonId of wagonIdsToDelete) {
      const wagonYnode = pageNodes.get(wagonId);
      if (!wagonYnode) continue;
      const wagonPos = yToPlain(wagonYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };

      pageNodes.forEach((childYnode, childId) => {
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
      pageEdges.forEach((yedge, edgeId) => {
        if (yedge.get('source') === wagonId || yedge.get('target') === wagonId) {
          pageEdges.delete(edgeId);
        }
      });

      pageNodes.delete(wagonId);
    }

    // 2. Delete edges connected to any target node
    const edgesToDelete: string[] = [];
    pageEdges.forEach((yedge, edgeId) => {
      const src = yedge.get('source') as string;
      const tgt = yedge.get('target') as string;
      if (targetNodeIds.has(src) || targetNodeIds.has(tgt)) {
        edgesToDelete.push(edgeId);
      }
    });
    for (const edgeId of edgesToDelete) {
      pageEdges.delete(edgeId);
    }

    // 3. Clean connection arrays in surviving nodes
    pageNodes.forEach((ynode, id) => {
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
      pageNodes.delete(nodeId);
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
  pageId: string,
  operations: BatchOperation[]
): BatchResult[] {
  const pageNodes = getPageMap(ydoc, 'nodes', pageId);
  const pageEdges = getPageMap(ydoc, 'edges', pageId);
  const results: BatchResult[] = [];
  const created = new Map<number, { semanticId: string; nodeId: string }>();

  ydoc.transact(() => {
    // Build a live lookup of semanticId → { nodeId, ydata }
    // We rebuild this before operations that need it, since creates modify it
    function buildNodeMap() {
      const map = new Map<string, { nodeId: string; ydata: Y.Map<unknown>; ynode: Y.Map<unknown> }>();
      pageNodes.forEach((ynode, id) => {
        const ydata = ynode.get('data') as Y.Map<unknown> | Record<string, unknown> | undefined;
        if (ydata) {
          const sid = safeGet(ydata, 'semanticId') as string | undefined;
          if (sid) map.set(sid, { nodeId: id, ydata: ensureYMap(ynode, ydata), ynode });
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
            pageNodes.set(nodeId, ynode as Y.Map<unknown>);

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
            pageNodes.forEach((ynode, id) => {
              const nodeObj = yToPlain(ynode) as Record<string, unknown>;
              if (nodeObj.type !== 'organizer') return;
              const data = nodeObj.data as OrganizerNodeData;
              if (data.attachedToSemanticId === sid) {
                // Detach wagon members
                pageNodes.forEach((childYnode, childId) => {
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
                pageEdges.forEach((yedge, edgeId) => {
                  if (yedge.get('source') === id || yedge.get('target') === id) {
                    pageEdges.delete(edgeId);
                  }
                });
                pageNodes.delete(id);
              }
            });

            // Remove edges
            const edgesToDel: string[] = [];
            pageEdges.forEach((yedge, edgeId) => {
              if (yedge.get('source') === entry.nodeId || yedge.get('target') === entry.nodeId) {
                edgesToDel.push(edgeId);
              }
            });
            for (const edgeId of edgesToDel) {
              pageEdges.delete(edgeId);
            }

            // Clean connections in surviving nodes
            pageNodes.forEach((ynode) => {
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

            pageNodes.delete(entry.nodeId);
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
            pageEdges.set(edgeId, yedge as Y.Map<unknown>);

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
              pageEdges.forEach((yedge, edgeId) => {
                if (
                  yedge.get('source') === source.nodeId &&
                  yedge.get('target') === target.nodeId &&
                  yedge.get('sourceHandle') === operation.sourcePortId
                ) {
                  edgesToDel.push(edgeId);
                }
              });
              for (const edgeId of edgesToDel) {
                pageEdges.delete(edgeId);
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
              const targetOrg = pageNodes.get(targetParentId);
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
              const parentYnode = pageNodes.get(currentParentId);
              if (parentYnode) {
                const parentPos = yToPlain(parentYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
                newPos = toAbsolutePosition(currentPos, parentPos);
              } else {
                newPos = currentPos;
              }
            } else if (!currentParentId && targetParentId) {
              const parentYnode = pageNodes.get(targetParentId);
              if (parentYnode) {
                const parentPos = yToPlain(parentYnode.get('position') as Y.Map<unknown>) as { x: number; y: number };
                newPos = toRelativePosition(currentPos, parentPos);
              } else {
                newPos = currentPos;
              }
            } else if (currentParentId && targetParentId && currentParentId !== targetParentId) {
              const oldParent = pageNodes.get(currentParentId);
              const newParent = pageNodes.get(targetParentId);
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
 * Compile a page's document to AI-readable output
 */
export function compile(ydoc: Y.Doc, pageId: string): string {
  const nodes = listConstructs(ydoc, pageId);
  const schemas = listSchemas(ydoc);

  // Get edges for page
  const pageEdges = getPageMap(ydoc, 'edges', pageId);
  const edges: CompilerEdge[] = [];
  pageEdges.forEach((yedge, id) => {
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
 * Extract full document from Y.Doc for a given page
 */
export function extractDocument(ydoc: Y.Doc, roomId: string, pageId: string): ServerDocument {
  const ymeta = ydoc.getMap('meta');
  const nodes = listConstructs(ydoc, pageId);
  const schemas = listSchemas(ydoc);

  // Get edges for page
  const pageEdges = getPageMap(ydoc, 'edges', pageId);
  const edges: CompilerEdge[] = [];
  pageEdges.forEach((yedge, id) => {
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
