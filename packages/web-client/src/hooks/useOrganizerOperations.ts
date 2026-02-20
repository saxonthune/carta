import { useCallback } from 'react';
import type { CartaNode } from '@carta/types';
import { useNodes } from './useNodes';
import {
  toRelativePosition,
} from '@carta/domain';
import type { OrganizerNodeData } from '@carta/domain';
import {
  getAbsolutePosition,
  canNestInOrganizer,
  computeNewOrganizerBounds,
  computeDetachedNodes,
  collectDescendantIds,
} from '../utils/organizerLogic';
// Simple organizer color palette
const ORGANIZER_COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#6366f1', '#ec4899'];

export interface UseOrganizerOperationsResult {
  /** Create a new organizer from selected node IDs */
  createOrganizer: (selectedNodeIds: string[]) => string | null;
  /** Create an organizer attached to a specific construct (wagon) */
  createAttachedOrganizer: (constructCartaNodeId: string, constructSemanticId: string, inheritColor?: string) => string | null;
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

// Re-export canNestInOrganizer for backwards compatibility
// (Map.tsx and MapV2.tsx may import it from this hook file)
export { canNestInOrganizer } from '../utils/organizerLogic';

/**
 * Hook providing organizer operations.
 * Uses pure geometry functions from @carta/domain for testability.
 */
export function useOrganizerOperations(): UseOrganizerOperationsResult {
  const { nodes, setNodes } = useNodes();

  const createOrganizer = useCallback((selectedNodeIds: string[]): string | null => {
    if (selectedNodeIds.length < 1) return null;

    const organizerId = crypto.randomUUID();
    const color = ORGANIZER_COLORS[Math.floor(Math.random() * ORGANIZER_COLORS.length)];

    // Filter out non-wagon organizers from selection
    const selectedCartaNodes = nodes.filter(n => {
      if (!selectedNodeIds.includes(n.id)) return false;
      // Allow constructs and wagon organizers only
      if (n.type === 'construct') return true;
      if (n.type === 'organizer') {
        const data = n.data as OrganizerNodeData;
        return !!data.attachedToSemanticId; // Only include wagon organizers
      }
      return true;
    });
    if (selectedCartaNodes.length < 1) return null;

    const bounds = computeNewOrganizerBounds(selectedCartaNodes, nodes);
    const organizerPosition = { x: bounds.x, y: bounds.y };

    const organizerCartaNode: CartaNode<OrganizerNodeData> = {
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

    const updatedCartaNodes = nodes.map(n => {
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

    setNodes([organizerCartaNode, ...updatedCartaNodes]);
    return organizerId;
  }, [nodes, setNodes]);

  const createAttachedOrganizer = useCallback((constructCartaNodeId: string, constructSemanticId: string, inheritColor?: string): string | null => {
    const constructCartaNode = nodes.find(n => n.id === constructCartaNodeId);
    if (!constructCartaNode) return null;

    const organizerId = crypto.randomUUID();
    const color = inheritColor || ORGANIZER_COLORS[Math.floor(Math.random() * ORGANIZER_COLORS.length)];
    const constructHeight = constructCartaNode.measured?.height ?? constructCartaNode.height ?? 150;

    const organizerCartaNode: CartaNode<OrganizerNodeData> = {
      id: organizerId,
      type: 'organizer',
      parentId: constructCartaNodeId,
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

    setNodes(nds => [organizerCartaNode, ...nds]);
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
      const idsToDelete = collectDescendantIds(organizerId, nodes);
      setNodes(nds => nds.filter(n => !idsToDelete.has(n.id)));
    } else {
      const updatedCartaNodes = computeDetachedNodes(organizerId, organizer, nodes);
      setNodes(updatedCartaNodes);
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
