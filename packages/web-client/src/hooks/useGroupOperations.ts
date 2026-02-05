import { useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { useNodes } from './useNodes';
import {
  computeGroupBounds,
  toRelativePosition,
  toAbsolutePosition,
  computeGroupFit,
  DEFAULT_GROUP_LAYOUT,
  type NodeGeometry,
} from '@carta/domain';
import type { VisualGroupNodeData } from '@carta/domain';
import { generateDeployableColor } from '@carta/document';

export interface UseGroupOperationsResult {
  /** Create a new visual group from selected node IDs */
  createGroup: (selectedNodeIds: string[]) => string | null;
  /** Attach a node to a group (converts to relative position) */
  attachToGroup: (nodeId: string, groupId: string) => void;
  /** Detach a node from its group (converts to absolute position) */
  detachFromGroup: (nodeId: string) => void;
  /** Toggle a group's collapsed state */
  toggleGroupCollapse: (groupId: string) => void;
  /** Rename a group */
  renameGroup: (groupId: string, name: string) => void;
  /** Update a group's color */
  updateGroupColor: (groupId: string, color: string) => void;
  /** Fit a group to its children (handles position shifts for overflow) */
  fitGroupToChildren: (groupId: string) => void;
  /** Delete a group (optionally delete children) */
  deleteGroup: (groupId: string, deleteChildren?: boolean) => void;
}

/**
 * Hook providing visual group operations.
 * Uses pure geometry functions from @carta/domain for testability.
 */
export function useGroupOperations(): UseGroupOperationsResult {
  const { nodes, setNodes } = useNodes();

  /**
   * Create a new visual group from selected nodes.
   * Returns the new group ID, or null if fewer than 2 nodes selected.
   */
  const createGroup = useCallback((selectedNodeIds: string[]): string | null => {
    if (selectedNodeIds.length < 2) return null;

    const groupId = crypto.randomUUID();
    const color = generateDeployableColor();

    // Get selected nodes for bounds calculation
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    if (selectedNodes.length === 0) return null;

    // Convert to NodeGeometry for pure function
    const nodeGeometries: NodeGeometry[] = selectedNodes.map(n => ({
      position: n.position,
      width: n.width,
      height: n.height,
      measured: n.measured,
    }));

    // Compute bounds using pure function
    const bounds = computeGroupBounds(nodeGeometries, DEFAULT_GROUP_LAYOUT);

    const groupPosition = { x: bounds.x, y: bounds.y };

    // Create the group node (set both width/height and style for expandParent compat)
    const groupNode: Node<VisualGroupNodeData> = {
      id: groupId,
      type: 'visual-group',
      position: groupPosition,
      width: bounds.width,
      height: bounds.height,
      style: { width: bounds.width, height: bounds.height },
      data: {
        isVisualGroup: true,
        name: 'New Group',
        color,
        collapsed: false,
      },
    };

    // Update children with parentId and convert to relative positions
    const updatedNodes = nodes.map(n => {
      if (selectedNodeIds.includes(n.id)) {
        const relativePos = toRelativePosition(n.position, groupPosition);
        return {
          ...n,
          parentId: groupId,
          position: relativePos,
        };
      }
      return n;
    });

    // Group node must come before its children (React Flow requirement)
    setNodes([groupNode, ...updatedNodes]);

    return groupId;
  }, [nodes, setNodes]);

  /**
   * Attach a node to a group, converting its position to relative.
   */
  const attachToGroup = useCallback((nodeId: string, groupId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    const group = nodes.find(n => n.id === groupId);
    if (!node || !group) return;

    const relativePosition = toRelativePosition(node.position, group.position);

    setNodes(nds => nds.map(n =>
      n.id === nodeId
        ? { ...n, parentId: groupId, position: relativePosition }
        : n
    ));
  }, [nodes, setNodes]);

  /**
   * Detach a node from its group, converting its position to absolute.
   */
  const detachFromGroup = useCallback((nodeId: string) => {
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

  /**
   * Toggle a group's collapsed state.
   */
  const toggleGroupCollapse = useCallback((groupId: string) => {
    setNodes(nds => nds.map(n => {
      if (n.id === groupId && n.type === 'visual-group') {
        const data = n.data as VisualGroupNodeData;
        return { ...n, data: { ...data, collapsed: !data.collapsed } };
      }
      return n;
    }));
  }, [setNodes]);

  /**
   * Rename a group.
   */
  const renameGroup = useCallback((groupId: string, name: string) => {
    setNodes(nds => nds.map(n => {
      if (n.id === groupId && n.type === 'visual-group') {
        const data = n.data as VisualGroupNodeData;
        return { ...n, data: { ...data, name } };
      }
      return n;
    }));
  }, [setNodes]);

  /**
   * Update a group's color.
   */
  const updateGroupColor = useCallback((groupId: string, color: string) => {
    setNodes(nds => nds.map(n => {
      if (n.id === groupId && n.type === 'visual-group') {
        const data = n.data as VisualGroupNodeData;
        return { ...n, data: { ...data, color } };
      }
      return n;
    }));
  }, [setNodes]);

  /**
   * Fit a group to its children, handling position shifts for left/upward overflow.
   * If children have been dragged above/left of the content area, the group position
   * is shifted and all children positions are adjusted to compensate.
   */
  const fitGroupToChildren = useCallback((groupId: string) => {
    const children = nodes.filter(n => n.parentId === groupId);
    if (children.length === 0) return;

    const childGeometries: NodeGeometry[] = children.map(n => ({
      position: n.position,
      width: n.width,
      height: n.height,
      measured: n.measured,
    }));

    const fit = computeGroupFit(childGeometries, DEFAULT_GROUP_LAYOUT);

    const needsShift = fit.positionDelta.x !== 0 || fit.positionDelta.y !== 0;

    setNodes(nds => nds.map(n => {
      if (n.id === groupId) {
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
      if (needsShift && n.parentId === groupId) {
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

  /**
   * Delete a group.
   * If deleteChildren is true, deletes all children too.
   * Otherwise, detaches children (converts to absolute positions) before deleting group.
   */
  const deleteGroup = useCallback((groupId: string, deleteChildren = false) => {
    const group = nodes.find(n => n.id === groupId);
    if (!group) return;

    if (deleteChildren) {
      // Delete group and all descendants
      const idsToDelete = new Set<string>([groupId]);

      // Build parent-to-children map and find all descendants
      const findDescendants = (parentId: string, depth = 0) => {
        if (depth > 20) return; // Prevent infinite recursion
        for (const node of nodes) {
          if (node.parentId === parentId && !idsToDelete.has(node.id)) {
            idsToDelete.add(node.id);
            findDescendants(node.id, depth + 1);
          }
        }
      };
      findDescendants(groupId);

      setNodes(nds => nds.filter(n => !idsToDelete.has(n.id)));
    } else {
      // Detach children first, then delete group
      setNodes(nds => {
        return nds
          .filter(n => n.id !== groupId)
          .map(n => {
            if (n.parentId === groupId) {
              // Convert to absolute position
              const absolutePosition = toAbsolutePosition(n.position, group.position);
              return { ...n, parentId: undefined, extent: undefined, position: absolutePosition };
            }
            return n;
          });
      });
    }
  }, [nodes, setNodes]);

  return {
    createGroup,
    attachToGroup,
    detachFromGroup,
    toggleGroupCollapse,
    renameGroup,
    updateGroupColor,
    fitGroupToChildren,
    deleteGroup,
  };
}
