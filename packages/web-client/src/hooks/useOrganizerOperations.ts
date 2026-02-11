import { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { useNodes } from './useNodes';
import {
  computeOrganizerBounds,
  toRelativePosition,
  toAbsolutePosition,
  DEFAULT_ORGANIZER_LAYOUT,
  computeLayoutUnitSizes,
  type NodeGeometry,
  type LayoutItem,
  type WagonInfo,
} from '@carta/domain';
import type { OrganizerNodeData } from '@carta/domain';
// Simple organizer color palette
const ORGANIZER_COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#6366f1', '#ec4899'];

export interface UseOrganizerOperationsResult {
  /** Create a new organizer from selected node IDs */
  createOrganizer: (selectedNodeIds: string[]) => string | null;
  /** Create an organizer attached to a specific construct (wagon) */
  createAttachedOrganizer: (constructNodeId: string, constructSemanticId: string) => string | null;
  /** Attach a node to an organizer (converts to relative position) */
  attachToOrganizer: (nodeId: string, organizerId: string) => void;
  /** Detach a node from its organizer (converts to absolute position) */
  detachFromOrganizer: (nodeId: string) => void;
  /** Toggle an organizer's collapsed state */
  toggleOrganizerCollapse: (organizerId: string) => void;
  /** Rename an organizer */
  renameOrganizer: (organizerId: string, name: string) => void;
  /** Update an organizer's color */
  updateOrganizerColor: (organizerId: string, color: string) => void;
  /** Delete an organizer (optionally delete members) */
  deleteOrganizer: (organizerId: string, deleteMembers?: boolean) => void;
}

/**
 * Compute the absolute canvas position of a node by walking its parentId chain.
 * For nodes without a parent, this returns node.position unchanged.
 */
function getAbsolutePosition(node: Node, allNodes: Node[]): { x: number; y: number } {
  if (!node.parentId) return node.position;
  const parent = allNodes.find(n => n.id === node.parentId);
  if (!parent) return node.position;
  const parentAbs = getAbsolutePosition(parent, allNodes);
  return { x: parentAbs.x + node.position.x, y: parentAbs.y + node.position.y };
}

/**
 * Validate whether a node can be nested inside an organizer.
 * - Constructs can always be added to organizers
 * - Organizers can only be added if they're wagon organizers whose construct is already a member
 * Exported for use in Map.tsx drag handlers.
 */
export function canNestInOrganizer(node: Node, targetOrganizer: Node, allNodes: Node[]): boolean {
  // Constructs can always be added to organizers
  if (node.type === 'construct') return true;

  // Organizers can only be added if they're wagon organizers
  // whose construct is already a member of the target organizer
  if (node.type === 'organizer') {
    const data = node.data as OrganizerNodeData;
    if (!data.attachedToSemanticId) return false; // non-wagon organizer — reject

    // Find the construct this wagon is attached to
    const ownerConstruct = allNodes.find(n =>
      n.type === 'construct' &&
      (n.data as { semanticId?: string }).semanticId === data.attachedToSemanticId
    );
    // Allow only if the construct is already in the target organizer
    return ownerConstruct?.parentId === targetOrganizer.id;
  }

  return true;
}

/**
 * Hook providing organizer operations.
 * Uses pure geometry functions from @carta/domain for testability.
 */
export function useOrganizerOperations(): UseOrganizerOperationsResult {
  const { nodes, setNodes } = useNodes();

  const createOrganizer = useCallback((selectedNodeIds: string[]): string | null => {
    if (selectedNodeIds.length < 2) return null;

    const organizerId = crypto.randomUUID();
    const color = ORGANIZER_COLORS[Math.floor(Math.random() * ORGANIZER_COLORS.length)];

    // Filter out non-wagon organizers from selection
    const selectedNodes = nodes.filter(n => {
      if (!selectedNodeIds.includes(n.id)) return false;
      // Allow constructs and wagon organizers only
      if (n.type === 'construct') return true;
      if (n.type === 'organizer') {
        const data = n.data as OrganizerNodeData;
        return !!data.attachedToSemanticId; // Only include wagon organizers
      }
      return true;
    });
    if (selectedNodes.length < 2) return null;

    // Build LayoutItem array for selected nodes
    const layoutItems: LayoutItem[] = selectedNodes.map(n => ({
      id: n.id,
      semanticId: (n.data as any)?.semanticId ?? n.id,
      x: n.position.x,
      y: n.position.y,
      width: n.measured?.width ?? n.width ?? 200,
      height: n.measured?.height ?? n.height ?? 100,
    }));

    // Build WagonInfo array for all organizer wagons
    const wagonInfos: WagonInfo[] = nodes
      .filter(n => n.type === 'organizer' && n.parentId)
      .map(n => ({
        id: n.id,
        parentId: n.parentId!,
        x: n.position.x,
        y: n.position.y,
        width: (n.style?.width as number) ?? n.measured?.width ?? n.width ?? 400,
        height: (n.style?.height as number) ?? n.measured?.height ?? n.height ?? 300,
      }));

    // Compute layout unit sizes using domain function
    const unitSizes = computeLayoutUnitSizes(layoutItems, wagonInfos);

    // Compute geometries including wagon trees for each selected node
    const nodeGeometries: NodeGeometry[] = selectedNodes.map(n => {
      const layoutUnit = unitSizes.get(n.id) ?? { width: 200, height: 100 };
      return {
        position: n.position,
        width: layoutUnit.width,
        height: layoutUnit.height,
        measured: n.measured,
      };
    });

    const bounds = computeOrganizerBounds(nodeGeometries, DEFAULT_ORGANIZER_LAYOUT);
    const organizerPosition = { x: bounds.x, y: bounds.y };

    const organizerNode: Node<OrganizerNodeData> = {
      id: organizerId,
      type: 'organizer',
      position: organizerPosition,
      width: bounds.width,
      height: bounds.height,
      style: { width: bounds.width, height: bounds.height },
      data: {
        isOrganizer: true,
        name: 'New Organizer',
        color,
        collapsed: false,
        layout: 'freeform',
      },
    };

    const updatedNodes = nodes.map(n => {
      if (selectedNodeIds.includes(n.id)) {
        const relativePos = toRelativePosition(n.position, organizerPosition);
        return {
          ...n,
          parentId: organizerId,
          position: relativePos,
        };
      }
      return n;
    });

    setNodes([organizerNode, ...updatedNodes]);
    return organizerId;
  }, [nodes, setNodes]);

  const createAttachedOrganizer = useCallback((constructNodeId: string, constructSemanticId: string): string | null => {
    const constructNode = nodes.find(n => n.id === constructNodeId);
    if (!constructNode) return null;

    const organizerId = crypto.randomUUID();
    const color = ORGANIZER_COLORS[Math.floor(Math.random() * ORGANIZER_COLORS.length)];
    const constructHeight = constructNode.measured?.height ?? constructNode.height ?? 150;

    const organizerNode: Node<OrganizerNodeData> = {
      id: organizerId,
      type: 'organizer',
      parentId: constructNodeId,
      position: { x: 0, y: constructHeight + 40 },
      width: 300,
      height: 200,
      style: { width: 300, height: 200 },
      data: {
        isOrganizer: true,
        name: 'Members',
        color,
        collapsed: false,
        layout: 'freeform',
        attachedToSemanticId: constructSemanticId,
      },
    };

    setNodes(nds => [organizerNode, ...nds]);
    return organizerId;
  }, [nodes, setNodes]);

  const attachToOrganizer = useCallback((nodeId: string, organizerId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    const organizer = nodes.find(n => n.id === organizerId);
    if (!node || !organizer) return;

    // Validate nesting rules
    if (!canNestInOrganizer(node, organizer, nodes)) return;

    const organizerAbsPos = getAbsolutePosition(organizer, nodes);
    const nodeAbsPos = node.parentId ? getAbsolutePosition(node, nodes) : node.position;
    const relativePosition = toRelativePosition(nodeAbsPos, organizerAbsPos);

    setNodes(nds => nds.map(n =>
      n.id === nodeId
        ? { ...n, parentId: organizerId, position: relativePosition }
        : n
    ));
  }, [nodes, setNodes]);

  const detachFromOrganizer = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId) return;

    const absolutePosition = getAbsolutePosition(node, nodes);

    setNodes(nds => nds.map(n =>
      n.id === nodeId
        ? { ...n, parentId: undefined, extent: undefined, position: absolutePosition }
        : n
    ));
  }, [nodes, setNodes]);

  const toggleOrganizerCollapse = useCallback((organizerId: string) => {
    setNodes(nds => nds.map(n => {
      if (n.id === organizerId && n.type === 'organizer') {
        const data = n.data as OrganizerNodeData;
        return { ...n, data: { ...data, collapsed: !data.collapsed } };
      }
      return n;
    }));
  }, [setNodes]);

  const renameOrganizer = useCallback((organizerId: string, name: string) => {
    setNodes(nds => nds.map(n => {
      if (n.id === organizerId && n.type === 'organizer') {
        const data = n.data as OrganizerNodeData;
        return { ...n, data: { ...data, name } };
      }
      return n;
    }));
  }, [setNodes]);

  const updateOrganizerColor = useCallback((organizerId: string, color: string) => {
    setNodes(nds => nds.map(n => {
      if (n.id === organizerId && n.type === 'organizer') {
        const data = n.data as OrganizerNodeData;
        return { ...n, data: { ...data, color } };
      }
      return n;
    }));
  }, [setNodes]);

  const deleteOrganizer = useCallback((organizerId: string, deleteMembers = false) => {
    const organizer = nodes.find(n => n.id === organizerId);
    if (!organizer) return;

    if (deleteMembers) {
      const idsToDelete = new Set<string>([organizerId]);
      const findDescendants = (parentId: string, depth = 0) => {
        if (depth > 20) return;
        for (const node of nodes) {
          if (node.parentId === parentId && !idsToDelete.has(node.id)) {
            idsToDelete.add(node.id);
            findDescendants(node.id, depth + 1);
          }
        }
      };
      findDescendants(organizerId);
      setNodes(nds => nds.filter(n => !idsToDelete.has(n.id)));
    } else {
      const organizerAbsPos = getAbsolutePosition(organizer, nodes);
      setNodes(nds => {
        return nds
          .filter(n => n.id !== organizerId)
          .map(n => {
            if (n.parentId === organizerId) {
              const absolutePosition = toAbsolutePosition(n.position, organizerAbsPos);
              return { ...n, parentId: undefined, extent: undefined, position: absolutePosition };
            }
            return n;
          });
      });
    }
  }, [nodes, setNodes]);

  return {
    createOrganizer,
    createAttachedOrganizer,
    attachToOrganizer,
    detachFromOrganizer,
    toggleOrganizerCollapse,
    renameOrganizer,
    updateOrganizerColor,
    deleteOrganizer,
  };
}
