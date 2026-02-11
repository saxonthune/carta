import { useCallback } from 'react';
import type { Node, ReactFlowInstance } from '@xyflow/react';
import type { DocumentAdapter } from '@carta/domain';
import { DEFAULT_ORGANIZER_LAYOUT } from '@carta/domain';
import { deOverlapNodes } from '../utils/deOverlapNodes.js';
import { hierarchicalLayout } from '../utils/hierarchicalLayout.js';

const ORGANIZER_CONTENT_TOP = DEFAULT_ORGANIZER_LAYOUT.padding + DEFAULT_ORGANIZER_LAYOUT.headerHeight;

interface UseOrganizerLayoutDeps {
  reactFlow: ReactFlowInstance;
  setNodesLocal: React.Dispatch<React.SetStateAction<Node[]>>;
  adapter: DocumentAdapter;
}

export interface UseOrganizerLayoutResult {
  spreadChildren: (organizerId: string) => void;
  flowLayoutChildren: (organizerId: string) => void;
  gridLayoutChildren: (organizerId: string) => void;
  fitToChildren: (organizerId: string) => void;
}

/**
 * Hook that encapsulates all organizer layout operations.
 * Each operation follows the 3-layer sync pattern: React Flow → local state → Yjs.
 */
export function useOrganizerLayout({
  reactFlow,
  setNodesLocal,
  adapter,
}: UseOrganizerLayoutDeps): UseOrganizerLayoutResult {
  /**
   * Apply position changes to nodes across all 3 layers.
   */
  const applyPositions = useCallback(
    (patches: Array<{ id: string; position: { x: number; y: number } }>) => {
      const patchMap = new Map(patches.map(p => [p.id, p.position]));
      const updater = (nds: Node[]) =>
        nds.map(n => {
          const pos = patchMap.get(n.id);
          return pos ? { ...n, position: pos } : n;
        });
      reactFlow.setNodes(updater);
      setNodesLocal(updater);
      if (patches.length > 0) {
        adapter.patchNodes?.(patches);
      }
    },
    [reactFlow, setNodesLocal, adapter]
  );

  /**
   * Apply size changes to an organizer node across all 3 layers.
   */
  const applyOrganizerSize = useCallback(
    (organizerId: string, width: number, height: number) => {
      const updater = (nds: Node[]) =>
        nds.map(n =>
          n.id === organizerId ? { ...n, style: { ...n.style, width, height } } : n
        );
      reactFlow.setNodes(updater);
      setNodesLocal(updater);
      adapter.patchNodes?.([{ id: organizerId, style: { width, height } }]);
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
      applyPositions(patches);

      // Bug fix: spread now auto-fits
      fitToChildren(organizerId);
    },
    [reactFlow, applyPositions, fitToChildren]
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
      applyPositions(patches);

      // Auto-resize to fit
      fitToChildren(organizerId);
    },
    [reactFlow, applyPositions, fitToChildren]
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
        applyPositions(patches);

        // Auto-resize to fit
        fitToChildren(organizerId);
      }
    },
    [reactFlow, applyPositions, fitToChildren]
  );

  return {
    spreadChildren,
    flowLayoutChildren,
    gridLayoutChildren,
    fitToChildren,
  };
}
