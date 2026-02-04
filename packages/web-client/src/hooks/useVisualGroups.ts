import { useMemo } from 'react';
import type { Node } from '@xyflow/react';
import type { VisualGroupNodeData } from '@carta/domain';

interface VisualGroupsResult {
  /** Processed nodes with hidden flags set for collapsed groups */
  processedNodes: Node[];
  /** Map from nodeId to collapsed groupId for edge remapping */
  edgeRemap: Map<string, string>;
}

/**
 * Hook to process visual groups for React Flow.
 *
 * With native React Flow parentId groups, this hook handles:
 * 1. Setting hidden: true on children of collapsed groups
 * 2. Building edge remap for routing edges to collapsed group chips
 *
 * Groups are now regular nodes with type='visual-group' and children
 * reference them via parentId. React Flow handles:
 * - Parent-before-child ordering (required)
 * - Relative positioning
 * - Group movement (children move with parent)
 */
export function useVisualGroups(nodes: Node[]): VisualGroupsResult {
  // Build set of collapsed group IDs
  const collapsedGroupIds = useMemo(() => {
    const collapsed = new Set<string>();
    for (const node of nodes) {
      if (node.type === 'visual-group') {
        const data = node.data as VisualGroupNodeData;
        if (data.collapsed) {
          collapsed.add(node.id);
        }
      }
    }
    return collapsed;
  }, [nodes]);

  // Find all descendants of collapsed groups (recursive, up to 20 levels)
  const hiddenNodeIds = useMemo(() => {
    const hidden = new Set<string>();

    // Build parent-to-children map
    const childrenMap = new Map<string, string[]>();
    for (const node of nodes) {
      if (node.parentId) {
        const children = childrenMap.get(node.parentId) || [];
        children.push(node.id);
        childrenMap.set(node.parentId, children);
      }
    }

    // Recursively find all descendants of collapsed groups
    const addDescendants = (groupId: string, depth = 0) => {
      if (depth > 20) return; // Prevent infinite recursion
      const children = childrenMap.get(groupId) || [];
      for (const childId of children) {
        hidden.add(childId);
        addDescendants(childId, depth + 1);
      }
    };

    for (const groupId of collapsedGroupIds) {
      addDescendants(groupId);
    }

    return hidden;
  }, [nodes, collapsedGroupIds]);

  // Build edge remap for collapsed groups
  const edgeRemap = useMemo(() => {
    const remap = new Map<string, string>();

    // Map hidden node IDs to their top-level collapsed ancestor
    const findCollapsedAncestor = (nodeId: string): string | undefined => {
      const node = nodes.find(n => n.id === nodeId);
      if (!node?.parentId) return undefined;

      // Walk up the parent chain to find the top collapsed group
      let current = node;
      let collapsedAncestor: string | undefined;
      let depth = 0;

      while (current.parentId && depth < 20) {
        if (collapsedGroupIds.has(current.parentId)) {
          collapsedAncestor = current.parentId;
        }
        const parent = nodes.find(n => n.id === current.parentId);
        if (!parent) break;
        current = parent;
        depth++;
      }

      return collapsedAncestor;
    };

    for (const nodeId of hiddenNodeIds) {
      const collapsedAncestor = findCollapsedAncestor(nodeId);
      if (collapsedAncestor) {
        remap.set(nodeId, collapsedAncestor);
      }
    }

    return remap;
  }, [nodes, hiddenNodeIds, collapsedGroupIds]);

  // Process nodes: set hidden flag on children of collapsed groups
  const processedNodes = useMemo(() => {
    return nodes.map(node => {
      if (hiddenNodeIds.has(node.id)) {
        return { ...node, hidden: true };
      }
      return node;
    });
  }, [nodes, hiddenNodeIds]);

  return {
    processedNodes,
    edgeRemap,
  };
}
