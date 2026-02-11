import { useCallback } from 'react';
import type { Node, ReactFlowInstance } from '@xyflow/react';
import type { DocumentAdapter } from '@carta/domain';
import { DEFAULT_ORGANIZER_LAYOUT, computeLayoutUnitSizes, type LayoutItem, type WagonInfo } from '@carta/domain';
import { deOverlapNodes } from '../utils/deOverlapNodes.js';
import { compactNodes } from '../utils/compactNodes.js';
import { hierarchicalLayout } from '../utils/hierarchicalLayout.js';
import type { SpreadInput } from '../utils/spreadNodes.js';

const ORGANIZER_CONTENT_TOP = DEFAULT_ORGANIZER_LAYOUT.padding + DEFAULT_ORGANIZER_LAYOUT.headerHeight;

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
      return {
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: (n.style?.width as number) ?? n.measured?.width ?? n.width ?? 400,
        height: (n.style?.height as number) ?? n.measured?.height ?? n.height ?? 300,
      };
    }
    const size = unitSizes.get(n.id) ?? { width: 200, height: 100 };
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

interface UseLayoutActionsDeps {
  reactFlow: ReactFlowInstance;
  setNodesLocal: React.Dispatch<React.SetStateAction<Node[]>>;
  adapter: DocumentAdapter;
  selectedNodeIds: string[];
}

export interface UseLayoutActionsResult {
  // Organizer-scoped (existing)
  spreadChildren: (organizerId: string) => void;
  flowLayoutChildren: (organizerId: string) => void;
  gridLayoutChildren: (organizerId: string) => void;
  fitToChildren: (organizerId: string) => void;
  // Top-level (moved from Map.tsx)
  spreadSelected: () => void;
  spreadAll: () => void;
  compactAll: () => void;
  hierarchicalLayout: () => void;
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
          width: 200,
          height: 100,
        };
      }
      return {
        id: node.id,
        semanticId: (node.data as any)?.semanticId ?? node.id,
        x: node.position.x,
        y: node.position.y,
        width: node.measured?.width ?? node.width ?? 200,
        height: node.measured?.height ?? node.height ?? 100,
      };
    });

    // Build WagonInfo array for all organizer wagons
    const wagonInfos: WagonInfo[] = rfNodes
      .filter(n => n.type === 'organizer' && n.parentId)
      .map(n => ({
        id: n.id,
        parentId: n.parentId!,
        x: n.position.x,
        y: n.position.y,
        width: (n.style?.width as number) ?? n.measured?.width ?? n.width ?? 400,
        height: (n.style?.height as number) ?? n.measured?.height ?? n.height ?? 300,
      }));

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
   */
  const fitToChildren = useCallback(
    (organizerId: string) => {
      const rfNodes = reactFlow.getNodes();
      const children = rfNodes.filter(
        n => n.parentId === organizerId && n.type !== 'organizer'
      );
      if (children.length === 0) return;

      // Compute bounding box of all children
      const rights = children.map(
        child => child.position.x + (child.measured?.width ?? child.width ?? 200)
      );
      const bottoms = children.map(
        child => child.position.y + (child.measured?.height ?? child.height ?? 100)
      );
      const maxRight = Math.max(...rights);
      const maxBottom = Math.max(...bottoms);

      // Add padding (fix: use padding not padding*2 for right edge)
      const { padding, headerHeight } = DEFAULT_ORGANIZER_LAYOUT;
      const newWidth = Math.max(maxRight + padding, 200);
      const newHeight = Math.max(maxBottom + padding, headerHeight + padding * 2);

      applyOrganizerSize(organizerId, newWidth, newHeight);
    },
    [reactFlow, applyOrganizerSize]
  );

  /**
   * Spread children within organizer using de-overlap algorithm.
   */
  const spreadChildren = useCallback(
    (organizerId: string) => {
      const rfNodes = reactFlow.getNodes();
      const children = rfNodes.filter(
        n => n.parentId === organizerId && n.type !== 'organizer'
      );
      if (children.length < 2) return;

      const inputs = children.map(n => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.measured?.width ?? n.width ?? 200,
        height: n.measured?.height ?? n.height ?? 100,
      }));
      const newPositions = deOverlapNodes(inputs);

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

      // Bug fix: spread now auto-fits
      fitToChildren(organizerId);
    },
    [reactFlow, setNodesLocal, adapter, fitToChildren]
  );

  /**
   * Grid layout children within organizer.
   */
  const gridLayoutChildren = useCallback(
    (organizerId: string) => {
      const rfNodes = reactFlow.getNodes();
      const children = rfNodes.filter(
        n => n.parentId === organizerId && n.type !== 'organizer'
      );
      if (children.length < 2) return;

      const inputs = children.map(n => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.measured?.width ?? n.width ?? 200,
        height: n.measured?.height ?? n.height ?? 100,
      }));

      // Compute grid
      const cols = Math.ceil(Math.sqrt(children.length));
      const colWidth = Math.max(...inputs.map(n => n.width)) + 30;
      const rowHeight = Math.max(...inputs.map(n => n.height)) + 30;
      const padding = 20;

      // Assign positions
      const newPositions = new globalThis.Map<string, { x: number; y: number }>();
      inputs.forEach((input, idx) => {
        const x = (idx % cols) * colWidth + padding;
        const y = Math.floor(idx / cols) * rowHeight + ORGANIZER_CONTENT_TOP;
        newPositions.set(input.id, { x, y });
      });

      const patches = [...newPositions].map(([id, position]) => ({ id, position }));
      applyPositionPatches(patches, reactFlow, setNodesLocal, adapter);

      // Auto-resize to fit
      fitToChildren(organizerId);
    },
    [reactFlow, setNodesLocal, adapter, fitToChildren]
  );

  /**
   * Flow layout children within organizer using hierarchical algorithm.
   */
  const flowLayoutChildren = useCallback(
    (organizerId: string) => {
      const rfNodes = reactFlow.getNodes();
      const children = rfNodes.filter(
        n => n.parentId === organizerId && n.type !== 'organizer'
      );
      if (children.length < 2) return;

      const inputs = children.map(n => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.measured?.width ?? n.width ?? 200,
        height: n.measured?.height ?? n.height ?? 100,
      }));

      // Filter edges to only those between children
      const childIds = new Set(children.map(c => c.id));
      const rfEdges = reactFlow.getEdges();
      const scopedEdges = rfEdges.filter(
        e => childIds.has(e.source) && childIds.has(e.target)
      );

      // Apply hierarchical layout with smaller gaps for organizer context
      const rawPositions = hierarchicalLayout(inputs, scopedEdges, { gap: 30, layerGap: 60 });

      // Normalize positions to start from (padding, padding)
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

        // Auto-resize to fit
        fitToChildren(organizerId);
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

      const inputs = children.map(n => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.measured?.width ?? n.width ?? 200,
        height: n.measured?.height ?? n.height ?? 100,
      }));
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

  return {
    spreadChildren,
    flowLayoutChildren,
    gridLayoutChildren,
    fitToChildren,
    spreadSelected,
    spreadAll,
    compactAll,
    hierarchicalLayout: hierarchicalLayoutAction,
  };
}
