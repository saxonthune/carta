import { useCallback } from 'react';
import type { Node, ReactFlowInstance } from '@xyflow/react';
import * as Y from 'yjs';
import type { DocumentAdapter } from '@carta/domain';
import { DEFAULT_ORGANIZER_LAYOUT, computeLayoutUnitSizes, computeOrganizerFit, type LayoutItem, type WagonInfo, resolvePinConstraints, type PinLayoutNode, type NodeGeometry } from '@carta/domain';
import { listPinConstraints } from '@carta/document';
import { deOverlapNodes } from '../utils/deOverlapNodes.js';
import { compactNodes } from '../utils/compactNodes.js';
import { hierarchicalLayout } from '../utils/hierarchicalLayout.js';
import { getNodeDimensions } from '../utils/nodeDimensions.js';
import type { SpreadInput } from '../utils/spreadNodes.js';
import { computeOrthogonalRoutes, type NodeRect } from '../presentation/index.js';
import { canNestInOrganizer } from './useOrganizerOperations.js';

const ORGANIZER_CONTENT_TOP = DEFAULT_ORGANIZER_LAYOUT.padding + DEFAULT_ORGANIZER_LAYOUT.headerHeight;

/**
 * Compute absolute position for a node by walking the parent chain.
 * Module-level helper extracted for use in attach/detach operations.
 */
function getAbsolutePosition(node: Node, allNodes: Node[]): { x: number; y: number } {
  if (!node.parentId) return node.position;
  const parent = allNodes.find(n => n.id === node.parentId);
  if (!parent) return node.position;
  const parentAbs = getAbsolutePosition(parent, allNodes);
  return { x: parentAbs.x + node.position.x, y: parentAbs.y + node.position.y };
}

/**
 * Convert absolute position to position relative to a parent.
 */
function toRelativePosition(
  absolutePos: { x: number; y: number },
  parentAbsolutePos: { x: number; y: number }
): { x: number; y: number } {
  return {
    x: absolutePos.x - parentAbsolutePos.x,
    y: absolutePos.y - parentAbsolutePos.y,
  };
}

/**
 * Apply position patches across React Flow, local state, and Yjs.
 * Module-level helper to consolidate the 3-layer sync pattern.
 */
function applyPositionPatches(
  patches: Array<{ id: string; position: { x: number; y: number } }>,
  reactFlow: ReactFlowInstance,
  setNodesLocal: React.Dispatch<React.SetStateAction<Node[]>>,
  adapter: DocumentAdapter,
): void {
  const patchMap = new Map(patches.map(p => [p.id, p.position]));
  const updater = (nds: Node[]) =>
    nds.map(n => {
      const pos = patchMap.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });
  reactFlow.setNodes(updater);
  setNodesLocal(updater);
  if (patches.length > 0) adapter.patchNodes?.(patches);
}

/**
 * Apply style patches (width/height) across all 3 layers.
 */
function applyStylePatches(
  patches: Array<{ id: string; style: Record<string, unknown> }>,
  reactFlow: ReactFlowInstance,
  setNodesLocal: React.Dispatch<React.SetStateAction<Node[]>>,
  adapter: DocumentAdapter,
): void {
  const patchMap = new Map(patches.map(p => [p.id, p.style]));
  const updater = (nds: Node[]) =>
    nds.map(n => {
      const style = patchMap.get(n.id);
      return style ? { ...n, style: { ...n.style, ...style } } : n;
    });
  reactFlow.setNodes(updater);
  setNodesLocal(updater);
  if (patches.length > 0) adapter.patchNodes?.(patches);
}

/**
 * Collect all top-level nodes (constructs and organizers) as SpreadInput items.
 * Organizer dimensions come from style.width/height. Construct dimensions come
 * from computeLayoutUnitSizes (which includes wagon bounding boxes).
 */
function getTopLevelLayoutItems(
  rfNodes: Node[],
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
function getTopLevelEdges(
  rfNodes: Node[],
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
function getChildLayoutItems(
  rfNodes: Node[],
  organizerId: string
): SpreadInput[] {
  const children = rfNodes.filter(n => n.parentId === organizerId);
  return children.map(n => {
    const dims = getNodeDimensions(n);
    return {
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      ...dims,
    };
  });
}

interface UseLayoutActionsDeps {
  reactFlow: ReactFlowInstance;
  setNodesLocal: React.Dispatch<React.SetStateAction<Node[]>>;
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
}

/**
 * Hook that encapsulates all layout operations (both organizer-scoped and top-level).
 * Each operation follows the 3-layer sync pattern: React Flow → local state → Yjs.
 */
export function useLayoutActions({
  reactFlow,
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
    const rfNodes = reactFlow.getNodes();

    // Build LayoutItem array for the specified nodes
    const layoutItems: LayoutItem[] = nodeIds.map(nodeId => {
      const node = rfNodes.find(n => n.id === nodeId);
      if (!node) {
        return {
          id: nodeId,
          semanticId: nodeId,
          x: 0,
          y: 0,
          ...getNodeDimensions({ type: 'construct' } as Node),
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
  }, [reactFlow]);

  /**
   * Apply size changes to an organizer node across all 3 layers.
   */
  const applyOrganizerSize = useCallback(
    (organizerId: string, width: number, height: number) => {
      applyStylePatches(
        [{ id: organizerId, style: { width, height } }],
        reactFlow,
        setNodesLocal,
        adapter
      );
    },
    [reactFlow, setNodesLocal, adapter]
  );

  /**
   * Fit organizer to its children's bounding box.
   * Handles children at negative relative positions by shifting organizer position and adjusting all children.
   * @param knownChildPositions - Optional map of known positions (to avoid reading stale React Flow state)
   */
  const fitToChildren = useCallback(
    (organizerId: string, knownChildPositions?: Map<string, { x: number; y: number }>) => {
      const rfNodes = reactFlow.getNodes();

      // Build children array, using known positions if provided
      let children: SpreadInput[];
      if (knownChildPositions) {
        // Use known positions (avoids stale React Flow state)
        const childNodes = rfNodes.filter(n => n.parentId === organizerId);
        children = childNodes.map(n => {
          const pos = knownChildPositions.get(n.id) ?? n.position;
          const dims = getNodeDimensions(n);
          return { id: n.id, x: pos.x, y: pos.y, ...dims };
        });
      } else {
        children = getChildLayoutItems(rfNodes, organizerId);
      }

      if (children.length === 0) return;

      // Convert SpreadInput format to NodeGeometry format
      const childGeometries: NodeGeometry[] = children.map(c => ({
        position: { x: c.x, y: c.y },
        width: c.width,
        height: c.height,
      }));

      // Compute fit using domain function
      const fit = computeOrganizerFit(childGeometries);

      console.debug('[organizer:layout:fit]', { organizerId, childCount: children.length, fit });

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

        // Shift all children by childPositionDelta
        if (fit.childPositionDelta.x !== 0 || fit.childPositionDelta.y !== 0) {
          for (const child of children) {
            patches.push({
              id: child.id,
              position: {
                x: child.x + fit.childPositionDelta.x,
                y: child.y + fit.childPositionDelta.y,
              },
            });
          }
        }
      }

      if (patches.length > 0) {
        applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);
      }
      applyOrganizerSize(organizerId, fit.size.width, fit.size.height);
    },
    [reactFlow, setNodesLocal, adapter, applyOrganizerSize]
  );

  /**
   * Attach a node to an organizer during ctrl+drag.
   * Reads fresh RF state, validates nesting, computes relative position, applies 3-layer sync, and resizes organizer.
   */
  const attachNodeToOrganizer = useCallback(
    (nodeId: string, organizerId: string) => {
      const rfNodes = reactFlow.getNodes();
      const node = rfNodes.find(n => n.id === nodeId);
      const organizer = rfNodes.find(n => n.id === organizerId);
      if (!node || !organizer) return;
      if (!canNestInOrganizer(node, organizer, rfNodes)) return;

      // Compute absolute positions from fresh RF state
      const orgAbsPos = getAbsolutePosition(organizer, rfNodes);
      const nodeAbsPos = node.parentId ? getAbsolutePosition(node, rfNodes) : node.position;
      const relativePos = toRelativePosition(nodeAbsPos, orgAbsPos);

      console.debug('[organizer:attach]', {
        nodeId,
        organizerId,
        nodeAbsBefore: nodeAbsPos,
        orgAbsPos,
        relativePos,
      });

      // Apply to RF + local state (which syncs to Yjs via adapter.setNodes)
      const updater = (nds: Node[]) =>
        nds.map(n =>
          n.id === nodeId ? { ...n, parentId: organizerId, position: relativePos } : n
        );
      reactFlow.setNodes(updater);
      setNodesLocal(updater);

      // Resize organizer to fit
      const knownPositions = new Map([[nodeId, relativePos]]);
      fitToChildren(organizerId, knownPositions);
    },
    [reactFlow, setNodesLocal, fitToChildren]
  );

  /**
   * Detach a node from its organizer during ctrl+drag.
   * Reads fresh RF state, computes absolute position, applies 3-layer sync, and resizes old organizer.
   */
  const detachNodeFromOrganizer = useCallback(
    (nodeId: string) => {
      const rfNodes = reactFlow.getNodes();
      const node = rfNodes.find(n => n.id === nodeId);
      if (!node?.parentId) return;

      const oldOrganizerId = node.parentId;
      const absolutePos = getAbsolutePosition(node, rfNodes);

      console.debug('[organizer:detach]', {
        nodeId,
        oldOrganizerId,
        relPosBefore: node.position,
        absolutePos,
      });

      // Apply to RF + local state (which syncs to Yjs via adapter.setNodes)
      const updater = (nds: Node[]) =>
        nds.map(n =>
          n.id === nodeId ? { ...n, parentId: undefined, extent: undefined, position: absolutePos } : n
        );
      reactFlow.setNodes(updater);
      setNodesLocal(updater);

      // Resize old organizer
      fitToChildren(oldOrganizerId);
    },
    [reactFlow, setNodesLocal, fitToChildren]
  );

  /**
   * Spread children within organizer using de-overlap algorithm.
   */
  const spreadChildren = useCallback(
    (organizerId: string) => {
      const rfNodes = reactFlow.getNodes();
      const children = getChildLayoutItems(rfNodes, organizerId);
      if (children.length < 2) return;

      console.debug('[organizer:layout:spread]', { organizerId, childCount: children.length });

      const newPositions = deOverlapNodes(children);

      // Ensure all positions are below the organizer header
      const allPositions = [...newPositions.values()];
      const minY = Math.min(...allPositions.map(p => p.y));
      if (minY < ORGANIZER_CONTENT_TOP) {
        const shiftY = ORGANIZER_CONTENT_TOP - minY;
        for (const pos of newPositions.values()) {
          pos.y += shiftY;
        }
      }

      const patches = [...newPositions].map(([id, position]) => ({ id, position }));
      applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);

      const knownPositions = new Map(patches.map(p => [p.id, p.position]));
      fitToChildren(organizerId, knownPositions);
    },
    [reactFlow, setNodesLocal, adapter, fitToChildren]
  );

  /**
   * Grid layout children within organizer.
   * @param cols - Optional number of columns (defaults to auto-computed sqrt)
   */
  const gridLayoutChildren = useCallback(
    (organizerId: string, cols?: number) => {
      const rfNodes = reactFlow.getNodes();
      const children = getChildLayoutItems(rfNodes, organizerId);
      if (children.length < 2) return;

      // Compute grid
      const effectiveCols = cols ?? Math.ceil(Math.sqrt(children.length));

      console.debug('[organizer:layout:grid]', { organizerId, childCount: children.length, cols: effectiveCols });
      const colWidth = Math.max(...children.map(n => n.width)) + 30;
      const rowHeight = Math.max(...children.map(n => n.height)) + 30;
      const padding = 20;

      const newPositions = new globalThis.Map<string, { x: number; y: number }>();
      children.forEach((child, idx) => {
        const x = (idx % effectiveCols) * colWidth + padding;
        const y = Math.floor(idx / effectiveCols) * rowHeight + ORGANIZER_CONTENT_TOP;
        newPositions.set(child.id, { x, y });
      });

      const patches = [...newPositions].map(([id, position]) => ({ id, position }));
      applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);

      const knownPositions = new Map(patches.map(p => [p.id, p.position]));
      fitToChildren(organizerId, knownPositions);
    },
    [reactFlow, setNodesLocal, adapter, fitToChildren]
  );

  /**
   * Flow layout children within organizer using hierarchical algorithm.
   */
  const flowLayoutChildren = useCallback(
    (organizerId: string) => {
      const rfNodes = reactFlow.getNodes();
      const children = getChildLayoutItems(rfNodes, organizerId);
      if (children.length < 2) return;

      // Filter edges: between direct children, collapsing wagon-internal edges
      const childIds = new Set(children.map(c => c.id));
      const rfEdges = reactFlow.getEdges();

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

      console.debug('[organizer:layout:flow]', { organizerId, childCount: children.length, edgeCount: scopedEdges.length });

      const rawPositions = hierarchicalLayout(children, scopedEdges, { gap: 30, layerGap: 60 });

      // Normalize positions to start from (padding, headerTop)
      const padding = 20;
      const positions = [...rawPositions.values()];
      if (positions.length > 0) {
        const minX = Math.min(...positions.map(p => p.x));
        const minY = Math.min(...positions.map(p => p.y));

        const newPositions = new globalThis.Map<string, { x: number; y: number }>();
        for (const [id, pos] of rawPositions) {
          newPositions.set(id, {
            x: pos.x - minX + padding,
            y: pos.y - minY + ORGANIZER_CONTENT_TOP,
          });
        }

        const patches = [...newPositions].map(([id, position]) => ({ id, position }));
        applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);

        const knownPositions = new Map(patches.map(p => [p.id, p.position]));
        fitToChildren(organizerId, knownPositions);
      }
    },
    [reactFlow, setNodesLocal, adapter, fitToChildren]
  );

  /**
   * Spread selected nodes into a non-overlapping grid.
   * Top-level layout action (moved from Map.tsx).
   */
  const spreadSelected = useCallback(() => {
    const rfNodes = reactFlow.getNodes();
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
    applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);
  }, [reactFlow, selectedNodeIds, setNodesLocal, adapter, computeLayoutUnits]);

  /**
   * Spread all nodes on current level (within each organizer independently).
   * Top-level layout action (moved from Map.tsx).
   */
  const spreadAll = useCallback(() => {
    const rfNodes = reactFlow.getNodes();

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
    applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);
  }, [reactFlow, setNodesLocal, adapter, computeLayoutUnits]);

  /**
   * Compact all top-level nodes (remove whitespace, preserve spatial order).
   * Top-level layout action (moved from Map.tsx).
   */
  const compactAll = useCallback(() => {
    const topLevelItems = getTopLevelLayoutItems(reactFlow.getNodes(), computeLayoutUnits);
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
    applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);
  }, [reactFlow, setNodesLocal, adapter, computeLayoutUnits]);

  /**
   * Hierarchical layout (top-to-bottom by edge flow).
   * Top-level layout action (moved from Map.tsx).
   */
  const hierarchicalLayoutAction = useCallback(() => {
    const rfNodes = reactFlow.getNodes();
    const rfEdges = reactFlow.getEdges();

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
    applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);
  }, [reactFlow, setNodesLocal, adapter, computeLayoutUnits]);

  /**
   * Align selected nodes along a specified axis.
   * Requires at least 2 selected nodes.
   */
  const alignNodes = useCallback((axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    const rfNodes = reactFlow.getNodes();
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

    const newPositions = new Map<string, { x: number; y: number }>();

    switch (axis) {
      case 'left': {
        const minX = Math.min(...nodes.map(n => n.x));
        for (const n of nodes) {
          newPositions.set(n.id, { x: minX, y: n.y });
        }
        break;
      }
      case 'center': {
        const avgCenterX = nodes.reduce((sum, n) => sum + (n.x + n.width / 2), 0) / nodes.length;
        for (const n of nodes) {
          newPositions.set(n.id, { x: avgCenterX - n.width / 2, y: n.y });
        }
        break;
      }
      case 'right': {
        const maxRight = Math.max(...nodes.map(n => n.x + n.width));
        for (const n of nodes) {
          newPositions.set(n.id, { x: maxRight - n.width, y: n.y });
        }
        break;
      }
      case 'top': {
        const minY = Math.min(...nodes.map(n => n.y));
        for (const n of nodes) {
          newPositions.set(n.id, { x: n.x, y: minY });
        }
        break;
      }
      case 'middle': {
        const avgCenterY = nodes.reduce((sum, n) => sum + (n.y + n.height / 2), 0) / nodes.length;
        for (const n of nodes) {
          newPositions.set(n.id, { x: n.x, y: avgCenterY - n.height / 2 });
        }
        break;
      }
      case 'bottom': {
        const maxBottom = Math.max(...nodes.map(n => n.y + n.height));
        for (const n of nodes) {
          newPositions.set(n.id, { x: n.x, y: maxBottom - n.height });
        }
        break;
      }
    }

    const patches = [...newPositions].map(([id, position]) => ({ id, position }));
    applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);
  }, [reactFlow, selectedNodeIds, setNodesLocal, adapter, computeLayoutUnits]);

  /**
   * Distribute selected nodes evenly along a specified axis.
   * Requires at least 3 selected nodes.
   */
  const distributeNodes = useCallback((axis: 'horizontal' | 'vertical') => {
    const rfNodes = reactFlow.getNodes();
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

    if (axis === 'horizontal') {
      // Sort by x position
      nodes.sort((a, b) => a.x - b.x);

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const span = (last.x + last.width) - first.x;
      const totalWidth = nodes.reduce((sum, n) => sum + n.width, 0);
      const gap = (span - totalWidth) / (nodes.length - 1);

      let currentX = first.x;
      const newPositions = new Map<string, { x: number; y: number }>();
      for (const n of nodes) {
        newPositions.set(n.id, { x: currentX, y: n.y });
        currentX += n.width + gap;
      }

      const patches = [...newPositions].map(([id, position]) => ({ id, position }));
      applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);
    } else {
      // Sort by y position
      nodes.sort((a, b) => a.y - b.y);

      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const span = (last.y + last.height) - first.y;
      const totalHeight = nodes.reduce((sum, n) => sum + n.height, 0);
      const gap = (span - totalHeight) / (nodes.length - 1);

      let currentY = first.y;
      const newPositions = new Map<string, { x: number; y: number }>();
      for (const n of nodes) {
        newPositions.set(n.id, { x: n.x, y: currentY });
        currentY += n.height + gap;
      }

      const patches = [...newPositions].map(([id, position]) => ({ id, position }));
      applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);
    }
  }, [reactFlow, selectedNodeIds, setNodesLocal, adapter, computeLayoutUnits]);

  /**
   * Flow layout with directional control.
   * Transforms the top-to-bottom hierarchical layout to LR/RL/TB/BT.
   */
  const flowLayout = useCallback((direction: 'LR' | 'RL' | 'TB' | 'BT') => {
    const rfNodes = reactFlow.getNodes();
    const rfEdges = reactFlow.getEdges();

    const topLevelItems = getTopLevelLayoutItems(rfNodes, computeLayoutUnits);
    if (topLevelItems.length < 2) return;

    const topLevelIds = new Set(topLevelItems.map(n => n.id));
    const edges = getTopLevelEdges(rfNodes, rfEdges, topLevelIds);

    const rawPositioned = hierarchicalLayout(topLevelItems, edges);
    if (rawPositioned.size === 0) return;

    // Transform coordinates based on direction
    // hierarchicalLayout produces TB layout (y increases down layers)
    const transformed = new Map<string, { x: number; y: number }>();

    if (direction === 'TB') {
      // Already TB, use as-is
      for (const [id, pos] of rawPositioned) {
        transformed.set(id, pos);
      }
    } else if (direction === 'BT') {
      // Mirror y positions
      const positions = [...rawPositioned.values()];
      const maxY = Math.max(...positions.map(p => p.y));
      for (const [id, pos] of rawPositioned) {
        const node = topLevelItems.find(n => n.id === id)!;
        transformed.set(id, { x: pos.x, y: maxY - pos.y - node.height });
      }
    } else if (direction === 'LR') {
      // Swap x and y
      for (const [id, pos] of rawPositioned) {
        transformed.set(id, { x: pos.y, y: pos.x });
      }
    } else if (direction === 'RL') {
      // Swap x and y, then mirror x
      const positions = [...rawPositioned.values()];
      const maxY = Math.max(...positions.map(p => p.y));
      for (const [id, pos] of rawPositioned) {
        const node = topLevelItems.find(n => n.id === id)!;
        transformed.set(id, { x: maxY - pos.y - node.height, y: pos.x });
      }
    }

    // Chain de-overlap to guarantee no overlaps
    const positionedItems = topLevelItems.map(n => ({
      ...n,
      ...transformed.get(n.id)!,
    }));
    const final = deOverlapNodes(positionedItems);

    const patches = [...final].map(([id, position]) => ({ id, position }));
    applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);
  }, [reactFlow, setNodesLocal, adapter, computeLayoutUnits]);

  /**
   * Route edges around obstacles using orthogonal routing.
   * Computes waypoints for edges and applies them to React Flow's edge data.
   * Waypoints are persisted to Yjs.
   */
  const routeEdges = useCallback(() => {
    const rfNodes = reactFlow.getNodes();
    const rfEdges = reactFlow.getEdges();

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

    for (const edge of rfEdges) {
      const sourceId = resolveTopLevel(edge.source);
      const targetId = resolveTopLevel(edge.target);
      if (!sourceId || !targetId || sourceId === targetId) continue;
      const sourceRect = obstacleMap.get(sourceId);
      const targetRect = obstacleMap.get(targetId);
      if (!sourceRect || !targetRect) continue;
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
  }, [reactFlow, adapter]);

  /**
   * Clear all edge routes (waypoints) from Yjs (sync effect will propagate to React Flow).
   */
  const clearRoutes = useCallback(() => {
    const rfEdges = reactFlow.getEdges();
    const patches = rfEdges
      .filter(e => e.data?.waypoints && !e.id.startsWith('agg-') && !e.id.startsWith('wagon-'))
      .map(e => ({ id: e.id, data: { waypoints: null } }));
    if (patches.length > 0) {
      adapter.patchEdgeData?.(patches);
    }
  }, [reactFlow, adapter]);

  /**
   * Apply pin constraint layout.
   * Reads constraints from Yjs, resolves positions via resolvePinConstraints,
   * applies constrained positions via 3-layer sync, then de-overlaps free-standing nodes.
   */
  const applyPinLayout = useCallback(() => {
    const pageId = adapter.getActivePage();
    if (!pageId) return;

    const constraints = listPinConstraints(ydoc, pageId);
    if (constraints.length === 0) return;

    const rfNodes = reactFlow.getNodes();

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

    // Apply constrained positions (3-layer sync)
    applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);

    // De-overlap free-standing nodes against newly positioned organizers
    const constrainedIds = new Set(result.positions.keys());
    const allTopLevel = getTopLevelLayoutItems(reactFlow.getNodes(), computeLayoutUnits);

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
      applyPositionPatches(freePatches, reactFlow, setNodesLocal, adapter);
    }

    if (result.warnings.length > 0) {
      console.warn('Pin layout warnings:', result.warnings);
    }
  }, [reactFlow, setNodesLocal, adapter, ydoc, computeLayoutUnits]);

  return {
    spreadChildren,
    flowLayoutChildren,
    gridLayoutChildren,
    fitToChildren,
    attachNodeToOrganizer,
    detachNodeFromOrganizer,
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
  };
}
