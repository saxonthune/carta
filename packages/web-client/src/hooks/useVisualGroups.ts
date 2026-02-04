import { useMemo, useCallback } from 'react';
import type { Node } from '@xyflow/react';
import type { VisualGroup, ConstructNodeData } from '@carta/domain';
import type { VisualGroupNodeData } from '../components/canvas/VisualGroupNode';

interface GroupTreeNode {
  group: VisualGroup;
  depth: number;
  children: GroupTreeNode[];
  parentName?: string;
}

interface VisualGroupsResult {
  /** React Flow nodes for the visual groups */
  groupNodes: Node<VisualGroupNodeData>[];
  /** Map from nodeId to collapsed groupId for edge remapping */
  edgeRemap: Map<string, string>;
  /** Callback to toggle a group's collapsed state */
  toggleGroupCollapsed: (groupId: string) => void;
}

/**
 * Hook to compute visual group nodes from flat VisualGroup storage.
 *
 * Responsibilities:
 * 1. Build group tree from flat storage (via parentGroupId)
 * 2. Compute depth via parent traversal
 * 3. Compute bounds bottom-up (union of children + padding)
 * 4. Generate React Flow nodes with z-index
 * 5. Return edgeRemap for collapsed edge routing
 */
export function useVisualGroups(
  contentNodes: Node<ConstructNodeData>[],
  visualGroups: VisualGroup[],
  levelId: string,
  onUpdateGroup: (levelId: string, groupId: string, updates: Partial<VisualGroup>) => void
): VisualGroupsResult {
  // Build group lookup map
  const groupMap = useMemo(() => {
    const map = new Map<string, VisualGroup>();
    visualGroups.forEach((g) => map.set(g.id, g));
    return map;
  }, [visualGroups]);

  // Build tree structure with depth calculation
  const groupTree = useMemo(() => {
    const treeNodes = new Map<string, GroupTreeNode>();
    const rootGroups: GroupTreeNode[] = [];

    // First pass: create tree nodes
    visualGroups.forEach((group) => {
      treeNodes.set(group.id, {
        group,
        depth: 0,
        children: [],
      });
    });

    // Second pass: build parent-child relationships and calculate depth
    visualGroups.forEach((group) => {
      const node = treeNodes.get(group.id)!;
      if (group.parentGroupId && treeNodes.has(group.parentGroupId)) {
        const parent = treeNodes.get(group.parentGroupId)!;
        parent.children.push(node);
        node.parentName = parent.group.name;
      } else {
        rootGroups.push(node);
      }
    });

    // Third pass: calculate depth via BFS
    const queue: GroupTreeNode[] = [...rootGroups];
    while (queue.length > 0) {
      const node = queue.shift()!;
      node.children.forEach((child) => {
        child.depth = node.depth + 1;
        queue.push(child);
      });
    }

    return { treeNodes, rootGroups };
  }, [visualGroups]);

  // Count content nodes per group
  const nodeCountByGroup = useMemo(() => {
    const counts = new Map<string, number>();
    contentNodes.forEach((node) => {
      const groupId = node.data?.groupId;
      if (groupId) {
        counts.set(groupId, (counts.get(groupId) || 0) + 1);
      }
    });
    return counts;
  }, [contentNodes]);

  // Compute bounds for each group (bottom-up)
  const groupBounds = useMemo(() => {
    const bounds = new Map<
      string,
      { x: number; y: number; width: number; height: number }
    >();
    const PADDING = 20;
    const HEADER_HEIGHT = 40;

    // Get nodes belonging to a group (recursively including child groups)
    const getGroupContentNodes = (groupId: string): Node<ConstructNodeData>[] => {
      const directNodes = contentNodes.filter((n) => n.data?.groupId === groupId);
      const treeNode = groupTree.treeNodes.get(groupId);
      if (!treeNode) return directNodes;

      // Include nodes from child groups
      const childNodes = treeNode.children.flatMap((child) =>
        getGroupContentNodes(child.group.id)
      );
      return [...directNodes, ...childNodes];
    };

    // Process groups depth-first (deepest first for bottom-up)
    const processGroup = (treeNode: GroupTreeNode): void => {
      // First process children
      treeNode.children.forEach(processGroup);

      const group = treeNode.group;

      // If group has a manual position/size, use it
      if (group.position && group.size) {
        bounds.set(group.id, {
          x: group.position.x,
          y: group.position.y,
          width: group.size.width,
          height: group.size.height,
        });
        return;
      }

      // Calculate bounds from content
      const groupNodes = getGroupContentNodes(group.id);
      const childGroupBounds = treeNode.children
        .map((c) => bounds.get(c.group.id))
        .filter((b): b is NonNullable<typeof b> => b !== undefined);

      if (groupNodes.length === 0 && childGroupBounds.length === 0) {
        // Empty group - use default size at position
        const pos = group.position || { x: 0, y: 0 };
        bounds.set(group.id, {
          x: pos.x,
          y: pos.y,
          width: 200,
          height: 120,
        });
        return;
      }

      // Calculate bounding box
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;

      groupNodes.forEach((node) => {
        const w = node.measured?.width ?? node.width ?? 200;
        const h = node.measured?.height ?? node.height ?? 100;
        minX = Math.min(minX, node.position.x);
        minY = Math.min(minY, node.position.y);
        maxX = Math.max(maxX, node.position.x + w);
        maxY = Math.max(maxY, node.position.y + h);
      });

      childGroupBounds.forEach((b) => {
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      });

      bounds.set(group.id, {
        x: minX - PADDING,
        y: minY - PADDING - HEADER_HEIGHT,
        width: maxX - minX + PADDING * 2,
        height: maxY - minY + PADDING * 2 + HEADER_HEIGHT,
      });
    };

    groupTree.rootGroups.forEach(processGroup);
    return bounds;
  }, [contentNodes, groupTree]);

  // Build edge remap for collapsed groups
  const edgeRemap = useMemo(() => {
    const remap = new Map<string, string>();
    visualGroups.forEach((group) => {
      if (group.collapsed) {
        // Find all content nodes in this group (recursively)
        const findNodesInGroup = (groupId: string): string[] => {
          const directNodes = contentNodes
            .filter((n) => n.data?.groupId === groupId)
            .map((n) => n.id);
          const treeNode = groupTree.treeNodes.get(groupId);
          if (!treeNode) return directNodes;

          const childNodes = treeNode.children.flatMap((c) =>
            findNodesInGroup(c.group.id)
          );
          return [...directNodes, ...childNodes];
        };

        const nodeIds = findNodesInGroup(group.id);
        nodeIds.forEach((nodeId) => {
          remap.set(nodeId, group.id);
        });
      }
    });
    return remap;
  }, [visualGroups, contentNodes, groupTree]);

  // Toggle group collapsed state
  const toggleGroupCollapsed = useCallback(
    (groupId: string) => {
      const group = groupMap.get(groupId);
      if (group) {
        onUpdateGroup(levelId, groupId, { collapsed: !group.collapsed });
      }
    },
    [groupMap, levelId, onUpdateGroup]
  );

  // Generate React Flow nodes
  const groupNodes = useMemo(() => {
    return visualGroups.map((group): Node<VisualGroupNodeData> => {
      const treeNode = groupTree.treeNodes.get(group.id);
      const depth = treeNode?.depth ?? 0;
      const parentName = treeNode?.parentName;
      const bound = groupBounds.get(group.id);
      const childCount = nodeCountByGroup.get(group.id) || 0;

      // For collapsed groups, use stored position or bounds
      const position = group.collapsed
        ? group.position || { x: bound?.x || 0, y: bound?.y || 0 }
        : { x: bound?.x || 0, y: bound?.y || 0 };

      return {
        id: `group-${group.id}`,
        type: 'visual-group',
        position,
        style: group.collapsed
          ? { width: 180, height: 44 }
          : {
              width: bound?.width || 200,
              height: bound?.height || 120,
            },
        data: {
          group,
          depth,
          childCount,
          parentGroupName: parentName,
          onToggleCollapse: () => toggleGroupCollapsed(group.id),
        },
        zIndex: -100 + depth * 10,
        selectable: true,
        draggable: true,
      };
    });
  }, [
    visualGroups,
    groupTree,
    groupBounds,
    nodeCountByGroup,
    toggleGroupCollapsed,
  ]);

  return {
    groupNodes,
    edgeRemap,
    toggleGroupCollapsed,
  };
}
