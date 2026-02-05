import { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { useNodes } from './useNodes';
import {
  computeOrganizerBounds,
  toRelativePosition,
  toAbsolutePosition,
  computeOrganizerFit,
  DEFAULT_ORGANIZER_LAYOUT,
  type NodeGeometry,
} from '@carta/domain';
import type { OrganizerNodeData, OrganizerLayout } from '@carta/domain';
import { generateDeployableColor } from '@carta/document';

export interface UseOrganizerOperationsResult {
  /** Create a new organizer from selected node IDs */
  createOrganizer: (selectedNodeIds: string[]) => string | null;
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
  /** Fit an organizer to its members (handles position shifts for overflow) */
  fitOrganizerToMembers: (organizerId: string) => void;
  /** Delete an organizer (optionally delete members) */
  deleteOrganizer: (organizerId: string, deleteMembers?: boolean) => void;
  /** Change an organizer's layout strategy */
  changeLayout: (organizerId: string, layout: OrganizerLayout) => void;
  /** Set the active stack index for a stack-layout organizer */
  setStackIndex: (organizerId: string, index: number) => void;
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
    const color = generateDeployableColor();

    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    if (selectedNodes.length === 0) return null;

    const nodeGeometries: NodeGeometry[] = selectedNodes.map(n => ({
      position: n.position,
      width: n.width,
      height: n.height,
      measured: n.measured,
    }));

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

  const attachToOrganizer = useCallback((nodeId: string, organizerId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    const organizer = nodes.find(n => n.id === organizerId);
    if (!node || !organizer) return;

    // Reject attaching organizers to stack/grid organizers
    const organizerData = organizer.data as unknown as OrganizerNodeData;
    if (organizerData.layout !== 'freeform' && node.type === 'organizer') return;

    const relativePosition = toRelativePosition(node.position, organizer.position);

    setNodes(nds => nds.map(n =>
      n.id === nodeId
        ? { ...n, parentId: organizerId, position: relativePosition }
        : n
    ));
  }, [nodes, setNodes]);

  const detachFromOrganizer = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId) return;

    const parent = nodes.find(n => n.id === node.parentId);
    const absolutePosition = parent
      ? toAbsolutePosition(node.position, parent.position)
      : node.position;

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

  const fitOrganizerToMembers = useCallback((organizerId: string) => {
    const members = nodes.filter(n => n.parentId === organizerId);
    if (members.length === 0) return;

    const memberGeometries: NodeGeometry[] = members.map(n => ({
      position: n.position,
      width: n.width,
      height: n.height,
      measured: n.measured,
    }));

    const fit = computeOrganizerFit(memberGeometries, DEFAULT_ORGANIZER_LAYOUT);
    const needsShift = fit.positionDelta.x !== 0 || fit.positionDelta.y !== 0;

    setNodes(nds => nds.map(n => {
      if (n.id === organizerId) {
        return {
          ...n,
          position: needsShift
            ? { x: n.position.x + fit.positionDelta.x, y: n.position.y + fit.positionDelta.y }
            : n.position,
          width: fit.size.width,
          height: fit.size.height,
          style: { ...n.style, width: fit.size.width, height: fit.size.height },
        };
      }
      if (needsShift && n.parentId === organizerId) {
        return {
          ...n,
          position: {
            x: n.position.x + fit.childPositionDelta.x,
            y: n.position.y + fit.childPositionDelta.y,
          },
        };
      }
      return n;
    }));
  }, [nodes, setNodes]);

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
      setNodes(nds => {
        return nds
          .filter(n => n.id !== organizerId)
          .map(n => {
            if (n.parentId === organizerId) {
              const absolutePosition = toAbsolutePosition(n.position, organizer.position);
              return { ...n, parentId: undefined, extent: undefined, position: absolutePosition };
            }
            return n;
          });
      });
    }
  }, [nodes, setNodes]);

  const changeLayout = useCallback((organizerId: string, layout: OrganizerLayout) => {
    setNodes(nds => nds.map(n => {
      if (n.id === organizerId && n.type === 'organizer') {
        const data = n.data as OrganizerNodeData;
        return { ...n, data: { ...data, layout, stackIndex: layout === 'stack' ? 0 : data.stackIndex } };
      }
      return n;
    }));
  }, [setNodes]);

  const setStackIndex = useCallback((organizerId: string, index: number) => {
    setNodes(nds => nds.map(n => {
      if (n.id === organizerId && n.type === 'organizer') {
        const data = n.data as OrganizerNodeData;
        return { ...n, data: { ...data, stackIndex: index } };
      }
      return n;
    }));
  }, [setNodes]);

  return {
    createOrganizer,
    attachToOrganizer,
    detachFromOrganizer,
    toggleOrganizerCollapse,
    renameOrganizer,
    updateOrganizerColor,
    fitOrganizerToMembers,
    deleteOrganizer,
    changeLayout,
    setStackIndex,
  };
}
