import { useCallback } from 'react';
import type { CartaNode } from '@carta/types';
import * as Y from 'yjs';
import type { DocumentAdapter } from '@carta/domain';
import { DEFAULT_ORGANIZER_LAYOUT, computeLayoutUnitSizes, computeLayoutUnitBounds, computeOrganizerFit, type LayoutItem, type WagonInfo, resolvePinConstraints, type PinLayoutNode, type NodeGeometry } from '@carta/domain';
import { listPinConstraints, updateOrganizer } from '@carta/document';
import { deOverlapNodes } from '../utils/deOverlapNodes.js';
import { compactNodes } from '../utils/compactNodes.js';
import { hierarchicalLayout } from '../utils/hierarchicalLayout.js';
import { getNodeDimensions } from '../utils/nodeDimensions.js';
import type { SpreadInput } from '../utils/spreadNodes.js';
import { computeOrthogonalRoutes, type NodeRect } from '../presentation/index.js';
import { canNestInOrganizer } from './useOrganizerOperations.js';
import { computeAlignment, computeDistribution } from '../utils/layoutGeometry.js';
import { computeGridPositions, transformDirectionalPositions, computeWagonSnapPositions, normalizePositionsToContentArea } from '../utils/layoutStrategies.js';

export const ORGANIZER_CONTENT_TOP = DEFAULT_ORGANIZER_LAYOUT.padding + DEFAULT_ORGANIZER_LAYOUT.headerHeight;

/**
 * Compute absolute position for a node by walking the parent chain.
 * Module-level helper extracted for use in attach/detach operations.
 */
export function getAbsolutePosition(node: CartaNode, allNodes: CartaNode[]): { x: number; y: number } {
  if (!node.parentId) return node.position;
  const parent = allNodes.find(n => n.id === node.parentId);
  if (!parent) return node.position;
  const parentAbs = getAbsolutePosition(parent, allNodes);
  return { x: parentAbs.x + node.position.x, y: parentAbs.y + node.position.y };
}

/**
 * Convert absolute position to position relative to a parent.
 */
export function toRelativePosition(
  absolutePos: { x: number; y: number },
  parentAbsolutePos: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: absolutePos.x - parentAbsolutePos.x,
    y: absolutePos.y - parentAbsolutePos.y,
  };
}


/**
 * Apply style patches (width/height) across all 3 layers.
 */
/**
 * Collect all top-level nodes (constructs and organizers) as SpreadInput items.
 * Organizer dimensions come from style.width/height. Construct dimensions come
 * from computeLayoutUnitSizes (which includes wagon bounding boxes).
 */
export function getTopLevelLayoutItems(
  rfNodes: CartaNode[],
  computeLayoutUnits: (nodeIds: string[]) => Map<string, { width: number; height: number }>
): SpreadInput[] {
  const topLevel = rfNodes.filter(n => !n.parentId);
  if (topLevel.length === 0) return [];

  // Compute layout unit sizes for constructs only (not organizers)
  const constructIds = topLevel.filter(n => n.type !== 'organizer').map(n => n.id);
  const unitSizes = computeLayoutUnits(constructIds);

  return topLevel.map(n => {
    if (n.type === 'organizer') {
      const dims = getNodeDimensions(n);
      return {
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        ...dims,
      };
    }
    const size = unitSizes.get(n.id) ?? getNodeDimensions(n);
    return {
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      ...size,
    };
  });
}

/**
 * Map edges to top-level nodes. Edges between children of the same organizer
 * are dropped (internal). Edges from an organizer's child to an external node
 * are mapped to the organizer's ID. Deduplicates.
 */
export function getTopLevelEdges(
  rfNodes: CartaNode[],
  rfEdges: Array<{ source: string; target: string }>,
  topLevelIds: Set<string>
): Array<{ source: string; target: string }> {
  // Build map: any node ID → its top-level ancestor ID
  const parentMap = new Map<string, string>();
  for (const n of rfNodes) {
    if (n.parentId) parentMap.set(n.id, n.parentId);
  }

  function resolveTopLevel(id: string): string | undefined {
    if (topLevelIds.has(id)) return id;
    const parent = parentMap.get(id);
    if (!parent) return undefined;
    return resolveTopLevel(parent);
  }

  const seen = new Set<string>();
  const edges: Array<{ source: string; target: string }> = [];

  for (const e of rfEdges) {
    const source = resolveTopLevel(e.source);
    const target = resolveTopLevel(e.target);
    if (!source || !target) continue;
    if (source === target) continue; // internal to same top-level node
    const key = `${source}->${target}`;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push({ source, target });
  }

  return edges;
}

/**
 * Collect all children of an organizer (constructs and child organizers) as SpreadInput items.
 * Child organizer dimensions come from style.width/height.
 * Construct dimensions use measured/explicit values (no wagon-tree expansion needed
 * since constructs inside organizers don't have wagons attached at this level).
 */
/**
 * Get wagon-expanded layout items for organizer children.
 * Returns items with expanded dimensions (for layout algorithms) and an offset
 * map for converting layout positions back to construct positions.
 */
export function getChildLayoutUnits(
  rfNodes: CartaNode[],
  organizerId: string,
): { items: SpreadInput[]; offsets: Map<string, { x: number; y: number }> } {
  const directChildren = rfNodes.filter(n => n.parentId === organizerId);
  if (directChildren.length === 0) return { items: [], offsets: new Map() };

  // Build LayoutItem and WagonInfo arrays (same pattern as getChildVisualFootprints)
  const layoutItems: LayoutItem[] = directChildren.map(child => {
    const dims = getNodeDimensions(child);
    return {
      id: child.id,
      semanticId: (child.data as any)?.semanticId ?? child.id,
      x: child.position.x,
      y: child.position.y,
      ...dims,
    };
  });

  const wagonInfos: WagonInfo[] = rfNodes
    .filter(n => n.type === 'organizer' && n.parentId)
    .map(n => {
      return {
        id: n.id,
        parentId: n.parentId!,
        x: n.position.x,
        y: n.position.y,
        ...getNodeDimensions(n),
      };
    });

  const bounds = computeLayoutUnitBounds(layoutItems, wagonInfos);
  const offsets = new Map<string, { x: number; y: number }>();

  const items: SpreadInput[] = directChildren.map(child => {
    const childBounds = bounds.get(child.id);
    const dims = getNodeDimensions(child);
    if (!childBounds || (childBounds.offsetX === 0 && childBounds.offsetY === 0
        && childBounds.width === dims.width && childBounds.height === dims.height)) {
      offsets.set(child.id, { x: 0, y: 0 });
      return { id: child.id, x: child.position.x, y: child.position.y, ...dims };
    }
    offsets.set(child.id, { x: childBounds.offsetX, y: childBounds.offsetY });
    return {
      id: child.id,
      x: child.position.x + childBounds.offsetX,
      y: child.position.y + childBounds.offsetY,
      width: childBounds.width,
      height: childBounds.height,
    };
  });

  return { items, offsets };
}

/**
 * Convert layout positions (wagon-expanded space) back to construct positions.
 */
export function convertToConstructPositions(
  newPositions: Map<string, { x: number; y: number }>,
  offsets: Map<string, { x: number; y: number }>,
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  for (const [id, pos] of newPositions) {
    const offset = offsets.get(id) ?? { x: 0, y: 0 };
    result.set(id, { x: pos.x - offset.x, y: pos.y - offset.y });
  }
  return result;
}

/**
 * Get visual footprints of organizer children (including their wagon trees).
 * Returns NodeGeometry[] with expanded bounds that account for wagon organizers.
 * This is used for fitToChildren to properly encompass wagon organizers.
 */
export function getChildVisualFootprints(
  rfNodes: CartaNode[],
  organizerId: string,
): NodeGeometry[] {
  const directChildren = rfNodes.filter(n => n.parentId === organizerId);
  if (directChildren.length === 0) return [];

  // Build LayoutItem array for direct children
  const layoutItems: LayoutItem[] = directChildren.map(child => {
    const dims = getNodeDimensions(child);
    return {
      id: child.id,
      semanticId: (child.data as any)?.semanticId ?? child.id,
      x: child.position.x,
      y: child.position.y,
      ...dims,
    };
  });

  // Build WagonInfo array for all organizer wagons in the entire tree
  const wagonInfos: WagonInfo[] = rfNodes
    .filter(n => n.type === 'organizer' && n.parentId)
    .map(n => {
      const dims = getNodeDimensions(n);
      return {
        id: n.id,
        parentId: n.parentId!,
        x: n.position.x,
        y: n.position.y,
        ...dims,
      };
    });

  // Compute layout unit bounds (includes wagon offsets)
  const bounds = computeLayoutUnitBounds(layoutItems, wagonInfos);

  // Convert to NodeGeometry with expanded bounds
  return layoutItems.map(item => {
    const itemBounds = bounds.get(item.id);
    if (!itemBounds) {
      // No wagons, use original dimensions
      return {
        position: { x: item.x, y: item.y },
        width: item.width,
        height: item.height,
      };
    }
    // Apply wagon-expanded bounds
    return {
      position: {
        x: item.x + itemBounds.offsetX,
        y: item.y + itemBounds.offsetY,
      },
      width: itemBounds.width,
      height: itemBounds.height,
    };
  });
}

interface CanvasAccessor {
  getNodes: () => unknown[];
  setNodes: (updater: ((nodes: unknown[]) => unknown[]) | unknown[]) => void;
  getEdges: () => Array<{ id: string; source: string; target: string; data?: any }>;
}

interface UseLayoutActionsDeps {
  canvas: CanvasAccessor;
  setNodesLocal: React.Dispatch<React.SetStateAction<CartaNode[]>>;
  adapter: DocumentAdapter;
  selectedNodeIds: string[];
  ydoc: Y.Doc;
}

export interface UseLayoutActionsResult {
  // Organizer-scoped (existing)
  spreadChildren: (organizerId: string) => void;
  flowLayoutChildren: (organizerId: string) => void;
  gridLayoutChildren: (organizerId: string, cols?: number) => void;
  fitToChildren: (organizerId: string) => void;
  // Organizer membership (ctrl+drag attach/detach)
  attachNodeToOrganizer: (nodeId: string, organizerId: string) => void;
  detachNodeFromOrganizer: (nodeId: string) => void;
  // Wagon positioning
  positionWagonNextToConstruct: (wagonId: string) => void;
  // Top-level (moved from Map.tsx)
  spreadSelected: () => void;
  spreadAll: () => void;
  compactAll: () => void;
  hierarchicalLayout: () => void;
  // Layout toolbar UX (new)
  alignNodes: (axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  distributeNodes: (axis: 'horizontal' | 'vertical') => void;
  flowLayout: (direction: 'LR' | 'RL' | 'TB' | 'BT') => void;
  routeEdges: () => void;
  clearRoutes: () => void;
  applyPinLayout: () => void;
  // Recursive layout and pin control
  recursiveLayout: (organizerId: string, strategy: 'spread' | 'grid' | 'flow') => void;
  toggleLayoutPin: (organizerId: string) => void;
}

/**
 * Hook that encapsulates all layout operations (both organizer-scoped and top-level).
 * Each operation follows the 3-layer sync pattern: React Flow → local state → Yjs.
 */
export function useLayoutActions({
  canvas,
  setNodesLocal,
  adapter,
  selectedNodeIds,
  ydoc,
}: UseLayoutActionsDeps): UseLayoutActionsResult {
  /**
   * Compute the layout unit size (construct + wagon tree bounding box) for nodes.
   * Uses the domain's computeLayoutUnitSizes function.
   */
  const computeLayoutUnits = useCallback((nodeIds: string[]): Map<string, { width: number; height: number }> => {
    const rfNodes = adapter.getNodes() as CartaNode[];

    // Build LayoutItem array for the specified nodes
    const layoutItems: LayoutItem[] = nodeIds.map(nodeId => {
      const node = rfNodes.find(n => n.id === nodeId);
      if (!node) {
        return {
          id: nodeId,
          semanticId: nodeId,
          x: 0,
          y: 0,
          ...getNodeDimensions({ type: 'construct' } as CartaNode),
        };
      }
      const dims = getNodeDimensions(node);
      return {
        id: node.id,
        semanticId: (node.data as any)?.semanticId ?? node.id,
        x: node.position.x,
        y: node.position.y,
        ...dims,
      };
    });

    // Build WagonInfo array for all organizer wagons
    const wagonInfos: WagonInfo[] = rfNodes
      .filter(n => n.type === 'organizer' && n.parentId)
      .map(n => {
        const dims = getNodeDimensions(n);
        return {
          id: n.id,
          parentId: n.parentId!,
          x: n.position.x,
          y: n.position.y,
          ...dims,
        };
      });

    return computeLayoutUnitSizes(layoutItems, wagonInfos);
  }, [adapter]);

  /**
   * Apply size changes to an organizer node.
   */
  const applyOrganizerSize = useCallback(
    (organizerId: string, width: number, height: number) => {
      adapter.patchNodes?.([{ id: organizerId, style: { width, height } }]);
    },
    [adapter]
  );

  /**
   * Fit organizer to its children's bounding box.
   * Handles children at negative relative positions by shifting organizer position and adjusting all children.
   * Accounts for wagon organizers attached to children when calculating the fit.
   */
  const fitToChildren = useCallback(
    (organizerId: string) => {
      const rfNodes = adapter.getNodes() as CartaNode[];

      // Get visual footprints (includes wagon-expanded bounds)
      const childGeometries = getChildVisualFootprints(rfNodes, organizerId);

      if (childGeometries.length === 0) return;

      // Compute fit using domain function
      const fit = computeOrganizerFit(childGeometries);

      const patches: Array<{ id: string; position: { x: number; y: number } }> = [];

      // Shift organizer position if children were at negative coords
      if (fit.positionDelta.x !== 0 || fit.positionDelta.y !== 0) {
        const orgNode = rfNodes.find(n => n.id === organizerId);
        if (orgNode) {
          patches.push({
            id: organizerId,
            position: {
              x: orgNode.position.x + fit.positionDelta.x,
              y: orgNode.position.y + fit.positionDelta.y,
            },
          });
        }

        // Shift all direct children by childPositionDelta
        // Only direct children get position patches; their wagon subtrees move with them via React Flow's parent chain
        if (fit.childPositionDelta.x !== 0 || fit.childPositionDelta.y !== 0) {
          const directChildren = rfNodes.filter(n => n.parentId === organizerId);
          for (const child of directChildren) {
            patches.push({
              id: child.id,
              position: {
                x: child.position.x + fit.childPositionDelta.x,
                y: child.position.y + fit.childPositionDelta.y,
              },
            });
          }
        }
      }

      if (patches.length > 0) {
        adapter.patchNodes?.(patches);
      }
      applyOrganizerSize(organizerId, fit.size.width, fit.size.height);
    },
    [adapter, applyOrganizerSize]
  );

  /**
   * Attach a node to an organizer during ctrl+drag.
   * Reads fresh RF state, validates nesting, computes relative position, applies 3-layer sync, and resizes organizer.
   */
  const attachNodeToOrganizer = useCallback(
    (nodeId: string, organizerId: string) => {
      const rfNodes = canvas.getNodes() as unknown as CartaNode[];
      const node = rfNodes.find(n => n.id === nodeId);
      const organizer = rfNodes.find(n => n.id === organizerId);
      if (!node || !organizer) return;
      if (!canNestInOrganizer(node, organizer, rfNodes)) return;

      // Compute absolute positions from fresh RF state
      const orgAbsPos = getAbsolutePosition(organizer, rfNodes);
      const nodeAbsPos = node.parentId ? getAbsolutePosition(node, rfNodes) : node.position;
      const relativePos = toRelativePosition(nodeAbsPos, orgAbsPos);

      // Apply to RF + local state (which syncs to Yjs via adapter.setNodes)
      const updater = (nds: CartaNode[]) =>
        nds.map(n =>
          n.id === nodeId ? { ...n, parentId: organizerId, position: relativePos } : n
        );
      canvas.setNodes(updater as any);
      setNodesLocal(updater);

      // Resize organizer to fit
      fitToChildren(organizerId);
    },
    [canvas, setNodesLocal, fitToChildren]
  );

  /**
   * Detach a node from its organizer during ctrl+drag.
   * Reads fresh RF state, computes absolute position, applies 3-layer sync, and resizes old organizer.
   */
  const detachNodeFromOrganizer = useCallback(
    (nodeId: string) => {
      const rfNodes = canvas.getNodes() as unknown as CartaNode[];
      const node = rfNodes.find(n => n.id === nodeId);
      if (!node?.parentId) return;

      const oldOrganizerId = node.parentId;
      const absolutePos = getAbsolutePosition(node, rfNodes);

      // Apply to RF + local state (which syncs to Yjs via adapter.setNodes)
      const updater = (nds: CartaNode[]) =>
        nds.map(n =>
          n.id === nodeId ? { ...n, parentId: undefined, extent: undefined, position: absolutePos } : n
        );
      canvas.setNodes(updater as any);
      setNodesLocal(updater);

      // Resize old organizer to fit remaining children
      fitToChildren(oldOrganizerId);
    },
    [canvas, setNodesLocal, fitToChildren]
  );

  /**
   * Position a wagon organizer next to its parent construct.
   * Places the wagon to the right of the construct with a 20px gap, aligned to the top.
   */
  const positionWagonNextToConstruct = useCallback(
    (wagonId: string) => {
      const rfNodes = adapter.getNodes() as CartaNode[];
      const wagon = rfNodes.find(n => n.id === wagonId);
      if (!wagon?.parentId) return;

      const parentConstruct = rfNodes.find(n => n.id === wagon.parentId);
      if (!parentConstruct) return;

      // Verify this is a wagon organizer (attached to a construct, not an organizer)
      if (wagon.type !== 'organizer') return;
      const wagonData = wagon.data as any;
      if (!wagonData.attachedToSemanticId) return;

      const constructDims = getNodeDimensions(parentConstruct);
      const gap = 10;

      // Position to the right of the construct, aligned to top
      const newPosition = {
        x: constructDims.width + gap,
        y: 0,
      };

      adapter.patchNodes?.([{ id: wagonId, position: newPosition }]);
    },
    [adapter]
  );

  /**
   * Snap all wagon organizers within an organizer to their parent constructs.
   * Must be called before layout actions so expanded bounds reflect normalized wagon positions.
   */
  const snapWagonsInOrganizer = useCallback(
    (organizerId: string): void => {
      const rfNodes = adapter.getNodes() as CartaNode[];
      const children = rfNodes.filter(n => n.parentId === organizerId);
      const snaps = computeWagonSnapPositions(
        children as any, rfNodes as any,
        (node) => getNodeDimensions(node as CartaNode).width,
        10,
      );
      if (snaps.length > 0) {
        adapter.patchNodes?.(snaps);
      }
    },
    [adapter]
  );

  /**
   * Spread children within organizer using de-overlap algorithm.
   */
  const spreadChildren = useCallback(
    (organizerId: string) => {
      snapWagonsInOrganizer(organizerId);
      const rfNodes = canvas.getNodes() as unknown as CartaNode[];
      const { items, offsets } = getChildLayoutUnits(rfNodes, organizerId);
      if (items.length < 2) return;

      const newPositions = deOverlapNodes(items);

      // Ensure all positions are below the organizer header
      const allPositions = [...newPositions.values()];
      const minY = Math.min(...allPositions.map(p => p.y));
      if (minY < ORGANIZER_CONTENT_TOP) {
        const shiftY = ORGANIZER_CONTENT_TOP - minY;
        for (const pos of newPositions.values()) {
          pos.y += shiftY;
        }
      }

      // Convert back to construct positions
      const constructPositions = convertToConstructPositions(newPositions, offsets);

      const patches = [...constructPositions].map(([id, position]) => ({ id, position }));
      adapter.patchNodes?.(patches);

      fitToChildren(organizerId);
    },
    [adapter, fitToChildren, snapWagonsInOrganizer]
  );

  /**
   * Grid layout children within organizer.
   * @param cols - Optional number of columns (defaults to auto-computed sqrt)
   */
  const gridLayoutChildren = useCallback(
    (organizerId: string, cols?: number) => {
      // Step 1: Snap wagons
      snapWagonsInOrganizer(organizerId);

      // Step 2: Read nodes
      const rfNodes = canvas.getNodes() as unknown as CartaNode[];
      const { items, offsets } = getChildLayoutUnits(rfNodes, organizerId);
      if (items.length < 2) return;

      // Step 3: Compute grid
      const effectiveCols = cols ?? Math.ceil(Math.sqrt(items.length));
      const newPositions = computeGridPositions(items, effectiveCols, ORGANIZER_CONTENT_TOP, 20);

      // Step 4: Convert back to construct positions
      const constructPositions = convertToConstructPositions(newPositions, offsets);

      const patches = [...constructPositions].map(([id, position]) => ({ id, position }));
      adapter.patchNodes?.(patches);

      // Step 5: Fit to children
      fitToChildren(organizerId);
    },
    [adapter, fitToChildren, snapWagonsInOrganizer]
  );

  /**
   * Flow layout children within organizer using hierarchical algorithm.
   */
  const flowLayoutChildren = useCallback(
    (organizerId: string) => {
      snapWagonsInOrganizer(organizerId);
      const rfNodes = canvas.getNodes() as unknown as CartaNode[];
      const { items, offsets } = getChildLayoutUnits(rfNodes, organizerId);
      if (items.length < 2) return;

      // Filter edges: between direct children, collapsing wagon-internal edges
      const childIds = new Set(items.map(c => c.id));
      const rfEdges = canvas.getEdges() as Array<{ id: string; source: string; target: string }>;

      // Build map: nodes inside child wagons → wagon ID
      const toChild = new Map<string, string>();
      for (const n of rfNodes) {
        if (n.parentId && childIds.has(n.parentId)) {
          toChild.set(n.id, n.parentId);
        }
      }

      const seen = new Set<string>();
      const scopedEdges: Array<{ source: string; target: string }> = [];
      for (const e of rfEdges) {
        const source = toChild.get(e.source) ?? e.source;
        const target = toChild.get(e.target) ?? e.target;
        if (!childIds.has(source) || !childIds.has(target)) continue;
        if (source === target) continue;
        const key = `${source}->${target}`;
        if (seen.has(key)) continue;
        seen.add(key);
        scopedEdges.push({ source, target });
      }

      const rawPositions = hierarchicalLayout(items, scopedEdges, { gap: 30, layerGap: 60 });

      // Normalize positions to start from (padding, headerTop)
      if (rawPositions.size > 0) {
        const newPositions = normalizePositionsToContentArea(rawPositions, ORGANIZER_CONTENT_TOP, 20);

        // Convert back to construct positions
        const constructPositions = convertToConstructPositions(newPositions, offsets);

        const patches = [...constructPositions].map(([id, position]) => ({ id, position }));
        adapter.patchNodes?.(patches);

        fitToChildren(organizerId);
      }
    },
    [adapter, fitToChildren, snapWagonsInOrganizer]
  );

  /**
   * Spread selected nodes into a non-overlapping grid.
   * Top-level layout action (moved from Map.tsx).
   */
  const spreadSelected = useCallback(() => {
    const rfNodes = adapter.getNodes() as CartaNode[];
    const selected = rfNodes.filter(n => selectedNodeIds.includes(n.id));
    if (selected.length < 2) return;

    // Compute layout unit sizes for selected nodes
    const unitSizes = computeLayoutUnits(selectedNodeIds);

    const inputs = selected.map(n => {
      const size = unitSizes.get(n.id) ?? { width: 200, height: 100 };
      return {
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        ...size,
      };
    });
    const newPositions = deOverlapNodes(inputs);

    const patches = [...newPositions].map(([id, position]) => ({ id, position }));
    adapter.patchNodes?.(patches);
  }, [adapter, selectedNodeIds, computeLayoutUnits]);

  /**
   * Spread all nodes on current level (within each organizer independently).
   * Top-level layout action (moved from Map.tsx).
   */
  const spreadAll = useCallback(() => {
    const rfNodes = adapter.getNodes() as CartaNode[];

    // --- Top-level group (constructs + organizers) ---
    const topLevelItems = getTopLevelLayoutItems(rfNodes, computeLayoutUnits);
    const allNewPositions = new globalThis.Map<string, { x: number; y: number }>();

    if (topLevelItems.length >= 2) {
      const positions = deOverlapNodes(topLevelItems);
      for (const [id, pos] of positions) {
        allNewPositions.set(id, pos);
      }
    }

    // --- Organizer-scoped groups (constructs inside each organizer) ---
    const organizerIds = rfNodes
      .filter(n => n.type === 'organizer' && !n.parentId)
      .map(n => n.id);

    for (const orgId of organizerIds) {
      const children = rfNodes.filter(
        n => n.parentId === orgId && n.type !== 'organizer'
      );
      if (children.length < 2) continue;

      const inputs = children.map(n => {
        const dims = getNodeDimensions(n);
        return {
          id: n.id,
          x: n.position.x,
          y: n.position.y,
          ...dims,
        };
      });
      const positions = deOverlapNodes(inputs);
      for (const [id, pos] of positions) {
        allNewPositions.set(id, pos);
      }
    }

    if (allNewPositions.size === 0) return;
    const patches = [...allNewPositions].map(([id, position]) => ({ id, position }));
    adapter.patchNodes?.(patches);
  }, [adapter, computeLayoutUnits]);

  /**
   * Compact all top-level nodes (remove whitespace, preserve spatial order).
   * Top-level layout action (moved from Map.tsx).
   */
  const compactAll = useCallback(() => {
    const topLevelItems = getTopLevelLayoutItems(adapter.getNodes() as CartaNode[], computeLayoutUnits);
    if (topLevelItems.length < 2) return;

    const compacted = compactNodes(topLevelItems);
    if (compacted.size === 0) return;

    // Chain de-overlap as safety net
    const compactedItems = topLevelItems.map(n => ({
      ...n,
      ...compacted.get(n.id)!,
    }));
    const final = deOverlapNodes(compactedItems);

    const patches = [...final].map(([id, position]) => ({ id, position }));
    adapter.patchNodes?.(patches);
  }, [adapter, computeLayoutUnits]);

  /**
   * Hierarchical layout (top-to-bottom by edge flow).
   * Top-level layout action (moved from Map.tsx).
   */
  const hierarchicalLayoutAction = useCallback(() => {
    const rfNodes = adapter.getNodes() as CartaNode[];
    const rfEdges = canvas.getEdges() as Array<{ id: string; source: string; target: string; data?: any }>;

    const topLevelItems = getTopLevelLayoutItems(rfNodes, computeLayoutUnits);
    if (topLevelItems.length < 2) return;

    const topLevelIds = new Set(topLevelItems.map(n => n.id));
    const edges = getTopLevelEdges(rfNodes, rfEdges, topLevelIds);

    const positioned = hierarchicalLayout(topLevelItems, edges);
    if (positioned.size === 0) return;

    // Chain de-overlap to guarantee no overlaps
    const positionedItems = topLevelItems.map(n => ({
      ...n,
      ...positioned.get(n.id)!,
    }));
    const final = deOverlapNodes(positionedItems);

    const patches = [...final].map(([id, position]) => ({ id, position }));
    adapter.patchNodes?.(patches);
  }, [adapter, canvas, computeLayoutUnits]);

  /**
   * Align selected nodes along a specified axis.
   * Requires at least 2 selected nodes.
   */
  const alignNodes = useCallback((axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const rfNodes = adapter.getNodes() as CartaNode[];
    const selected = rfNodes.filter(n => selectedNodeIds.includes(n.id));
    if (selected.length < 2) return;

    const unitSizes = computeLayoutUnits(selectedNodeIds);
    const nodes = selected.map(n => {
      const size = unitSizes.get(n.id) ?? getNodeDimensions(n);
      return {
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: size.width,
        height: size.height,
      };
    });

    const newPositions = computeAlignment(nodes, axis);
    const patches = [...newPositions].map(([id, position]) => ({ id, position }));
    adapter.patchNodes?.(patches);
  }, [adapter, selectedNodeIds, computeLayoutUnits]);

  /**
   * Distribute selected nodes evenly along a specified axis.
   * Requires at least 3 selected nodes.
   */
  const distributeNodes = useCallback((axis: 'horizontal' | 'vertical') => {
    const rfNodes = adapter.getNodes() as CartaNode[];
    const selected = rfNodes.filter(n => selectedNodeIds.includes(n.id));
    if (selected.length < 3) return;

    const unitSizes = computeLayoutUnits(selectedNodeIds);
    const nodes = selected.map(n => {
      const size = unitSizes.get(n.id) ?? getNodeDimensions(n);
      return {
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: size.width,
        height: size.height,
      };
    });

    const newPositions = computeDistribution(nodes, axis);
    const patches = [...newPositions].map(([id, position]) => ({ id, position }));
    adapter.patchNodes?.(patches);
  }, [adapter, selectedNodeIds, computeLayoutUnits]);

  /**
   * Flow layout with directional control.
   * Transforms the top-to-bottom hierarchical layout to LR/RL/TB/BT.
   */
  const flowLayout = useCallback((direction: 'LR' | 'RL' | 'TB' | 'BT') => {
    const rfNodes = adapter.getNodes() as CartaNode[];
    const rfEdges = canvas.getEdges() as Array<{ id: string; source: string; target: string; data?: any }>;

    const topLevelItems = getTopLevelLayoutItems(rfNodes, computeLayoutUnits);
    if (topLevelItems.length < 2) return;

    const topLevelIds = new Set(topLevelItems.map(n => n.id));
    const edges = getTopLevelEdges(rfNodes, rfEdges, topLevelIds);

    const rawPositioned = hierarchicalLayout(topLevelItems, edges);
    if (rawPositioned.size === 0) return;

    // Transform coordinates based on direction
    // hierarchicalLayout produces TB layout (y increases down layers)
    const itemDims = new Map(topLevelItems.map(n => [n.id, { width: n.width, height: n.height }]));
    const transformed = transformDirectionalPositions(rawPositioned, direction, itemDims);

    // Chain de-overlap to guarantee no overlaps
    const positionedItems = topLevelItems.map(n => ({
      ...n,
      ...transformed.get(n.id)!,
    }));
    const final = deOverlapNodes(positionedItems);

    const patches = [...final].map(([id, position]) => ({ id, position }));
    adapter.patchNodes?.(patches);
  }, [adapter, canvas, computeLayoutUnits]);

  /**
   * Route edges around obstacles using orthogonal routing.
   * Computes waypoints for edges and applies them to React Flow's edge data.
   * Waypoints are persisted to Yjs.
   */
  const routeEdges = useCallback(() => {
    const rfNodes = canvas.getNodes() as unknown as CartaNode[];
    const rfEdges = canvas.getEdges() as Array<{ id: string; source: string; target: string; data?: any }>;

    // Build obstacle rects from all top-level nodes (constructs + organizers)
    const topLevel = rfNodes.filter(n => !n.parentId);
    const obstacles: NodeRect[] = topLevel.map(n => {
      const dims = getNodeDimensions(n);
      return {
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: dims.width,
        height: dims.height,
      };
    });

    // Build edge inputs: map each edge to source/target rects
    // Resolve child-of-organizer edges to their organizer's rect
    const topLevelIds = new Set(topLevel.map(n => n.id));
    const parentMap = new Map<string, string>();
    for (const n of rfNodes) {
      if (n.parentId) parentMap.set(n.id, n.parentId);
    }
    function resolveTopLevel(id: string): string | undefined {
      if (topLevelIds.has(id)) return id;
      const parent = parentMap.get(id);
      return parent ? resolveTopLevel(parent) : undefined;
    }

    const obstacleMap = new Map(obstacles.map(o => [o.id, o]));
    const edgeInputs: Array<{ id: string; sourceRect: NodeRect; targetRect: NodeRect }> = [];

    // Helper to calculate rect overlap percentage
    const calculateOverlap = (rect1: NodeRect, rect2: NodeRect): number => {
      const x1 = Math.max(rect1.x, rect2.x);
      const y1 = Math.max(rect1.y, rect2.y);
      const x2 = Math.min(rect1.x + rect1.width, rect2.x + rect2.width);
      const y2 = Math.min(rect1.y + rect1.height, rect2.y + rect2.height);

      if (x2 <= x1 || y2 <= y1) return 0; // No overlap

      const overlapArea = (x2 - x1) * (y2 - y1);
      const area1 = rect1.width * rect1.height;
      const area2 = rect2.width * rect2.height;
      const minArea = Math.min(area1, area2);

      return minArea > 0 ? overlapArea / minArea : 0;
    };

    for (const edge of rfEdges) {
      const sourceId = resolveTopLevel(edge.source);
      const targetId = resolveTopLevel(edge.target);
      if (!sourceId || !targetId || sourceId === targetId) continue;
      const sourceRect = obstacleMap.get(sourceId);
      const targetRect = obstacleMap.get(targetId);
      if (!sourceRect || !targetRect) continue;

      // Skip edges where source and target rects overlap significantly (would produce degenerate routes)
      const overlap = calculateOverlap(sourceRect, targetRect);
      if (overlap > 0.5) continue;

      edgeInputs.push({ id: edge.id, sourceRect, targetRect });
    }

    // Compute routes
    const routes = computeOrthogonalRoutes(edgeInputs, obstacles);

    // Persist waypoints to Yjs (sync effect will propagate to React Flow)
    // Only patch edges that exist in Yjs (skip synthetic display-layer edges)
    const edgePatches: Array<{ id: string; data: Record<string, unknown> }> = [];
    const allEdgeIds = new Set(rfEdges.map(e => e.id));
    for (const edgeId of allEdgeIds) {
      // Skip synthetic edges that don't exist in Yjs
      if (edgeId.startsWith('agg-') || edgeId.startsWith('wagon-')) continue;
      const route = routes.get(edgeId);
      if (route && route.waypoints.length >= 2) {
        edgePatches.push({ id: edgeId, data: { waypoints: route.waypoints } });
      } else {
        edgePatches.push({ id: edgeId, data: { waypoints: null } });
      }
    }
    adapter.patchEdgeData?.(edgePatches);
  }, [canvas, adapter]);

  /**
   * Clear all edge routes (waypoints) from Yjs (sync effect will propagate to React Flow).
   */
  const clearRoutes = useCallback(() => {
    const rfEdges = canvas.getEdges() as Array<{ id: string; source: string; target: string; data?: any }>;
    const patches = rfEdges
      .filter(e => e.data?.waypoints && !e.id.startsWith('agg-') && !e.id.startsWith('wagon-'))
      .map(e => ({ id: e.id, data: { waypoints: null } }));
    if (patches.length > 0) {
      adapter.patchEdgeData?.(patches);
    }
  }, [canvas, adapter]);

  /**
   * Apply pin constraint layout.
   * Reads constraints from Yjs, resolves positions via resolvePinConstraints,
   * applies constrained positions, then de-overlaps free-standing nodes.
   */
  const applyPinLayout = useCallback(() => {
    const pageId = adapter.getActivePage();
    if (!pageId) return;

    const constraints = listPinConstraints(ydoc, pageId);
    if (constraints.length === 0) return;

    const rfNodes = adapter.getNodes() as CartaNode[];

    // Gather top-level organizers AND top-level wagon organizers
    const organizers = rfNodes.filter(n => {
      if (n.type !== 'organizer') return false;
      if (!n.parentId) return true; // regular top-level organizer
      // Wagon: has attachedToSemanticId and parent construct is top-level
      const data = n.data as any;
      if (!data.attachedToSemanticId) return false;
      const parent = rfNodes.find(p => p.id === n.parentId);
      return parent ? !parent.parentId : false;
    });

    const layoutNodes: PinLayoutNode[] = organizers.map(n => {
      const dims = getNodeDimensions(n);
      let x = n.position.x;
      let y = n.position.y;
      // Convert wagon relative positions to absolute
      if (n.parentId) {
        const parent = rfNodes.find(p => p.id === n.parentId);
        if (parent) {
          x += parent.position.x;
          y += parent.position.y;
        }
      }
      return { id: n.id, ...dims, x, y };
    });

    // Resolve pin constraints
    const result = resolvePinConstraints(layoutNodes, constraints);

    // Convert wagon positions back to relative before applying patches
    const patches = [...result.positions].map(([id, position]) => {
      const node = rfNodes.find(n => n.id === id);
      if (node?.parentId) {
        const parent = rfNodes.find(p => p.id === node.parentId);
        if (parent) {
          return { id, position: { x: position.x - parent.position.x, y: position.y - parent.position.y } };
        }
      }
      return { id, position };
    });

    // Apply constrained positions
    adapter.patchNodes?.(patches);

    // De-overlap free-standing nodes against newly positioned organizers
    const constrainedIds = new Set(result.positions.keys());
    const allTopLevel = getTopLevelLayoutItems(adapter.getNodes() as CartaNode[], computeLayoutUnits);

    // Merge constrained positions into items for de-overlap
    const updatedItems = allTopLevel.map(item => {
      const newPos = result.positions.get(item.id);
      return newPos ? { ...item, ...newPos } : item;
    });

    const deOverlapped = deOverlapNodes(updatedItems);

    // Only apply patches for non-constrained nodes
    const freePatches = [...deOverlapped]
      .filter(([id]) => !constrainedIds.has(id))
      .map(([id, position]) => ({ id, position }));
    if (freePatches.length > 0) {
      adapter.patchNodes?.(freePatches);
    }

    if (result.warnings.length > 0) {
      console.warn('Pin layout warnings:', result.warnings);
    }
  }, [adapter, ydoc, computeLayoutUnits]);

  /**
   * Recursively layout an organizer tree bottom-up.
   * Applies the given strategy to each unpinned organizer, deepest first.
   */
  const recursiveLayout = useCallback(
    (organizerId: string, strategy: 'spread' | 'grid' | 'flow') => {
      const rfNodes = adapter.getNodes() as CartaNode[];

      // Find all descendant organizers (breadth-first collection, then reverse for bottom-up)
      const queue: string[] = [organizerId];
      const organizers: string[] = []; // will process in reverse (bottom-up)

      while (queue.length > 0) {
        const current = queue.shift()!;
        organizers.push(current);

        // Find child organizers (wagons whose parent is a direct child of current organizer)
        const directChildren = rfNodes.filter(n => n.parentId === current);
        for (const child of directChildren) {
          // Find wagon organizers attached to this child
          const wagons = rfNodes.filter(n =>
            n.type === 'organizer' && n.parentId === child.id
          );
          for (const wagon of wagons) {
            queue.push(wagon.id);
          }
          // Also check if child itself is an organizer (nested non-wagon organizer case)
          if (child.type === 'organizer') {
            queue.push(child.id);
          }
        }
      }

      // Process bottom-up (reverse order)
      for (let i = organizers.length - 1; i >= 0; i--) {
        const orgId = organizers[i];
        const orgNode = (adapter.getNodes() as CartaNode[]).find(n => n.id === orgId);
        if (!orgNode) continue;

        // Check if pinned — skip layout + fit but allow recursion (already done above)
        const data = orgNode.data as any;
        if (data.layoutPinned) continue;

        // Apply strategy (each action snaps wagons internally via snapWagonsInOrganizer)
        const children = (adapter.getNodes() as CartaNode[]).filter(n => n.parentId === orgId);
        if (children.length < 2 && strategy !== 'spread') continue;
        if (children.length < 1) continue;

        switch (strategy) {
          case 'spread': spreadChildren(orgId); break;
          case 'grid': gridLayoutChildren(orgId); break;
          case 'flow': flowLayoutChildren(orgId); break;
        }
        // fitToChildren is called at the end of each layout action already
      }
    },
    [adapter, spreadChildren, gridLayoutChildren, flowLayoutChildren]
  );

  /**
   * Toggle layout pin on an organizer.
   */
  const toggleLayoutPin = useCallback(
    (organizerId: string) => {
      const rfNodes = adapter.getNodes() as CartaNode[];
      const orgNode = rfNodes.find(n => n.id === organizerId);
      if (!orgNode) return;

      const data = orgNode.data as any;
      const newPinned = !data.layoutPinned;

      // Update React Flow + local state
      const updater = (nds: CartaNode[]) =>
        nds.map(n =>
          n.id === organizerId
            ? { ...n, data: { ...n.data, layoutPinned: newPinned } }
            : n
        );
      canvas.setNodes(updater as any);
      setNodesLocal(updater);

      // Persist to Yjs via document operations
      const pageId = adapter.getActivePage();
      if (pageId && ydoc) {
        updateOrganizer(ydoc, pageId, organizerId, { layoutPinned: newPinned });
      }
    },
    [canvas, setNodesLocal, adapter, ydoc]
  );

  return {
    spreadChildren,
    flowLayoutChildren,
    gridLayoutChildren,
    fitToChildren,
    attachNodeToOrganizer,
    detachNodeFromOrganizer,
    positionWagonNextToConstruct,
    spreadSelected,
    spreadAll,
    compactAll,
    hierarchicalLayout: hierarchicalLayoutAction,
    alignNodes,
    distributeNodes,
    flowLayout,
    routeEdges,
    clearRoutes,
    applyPinLayout,
    recursiveLayout,
    toggleLayoutPin,
  };
}
