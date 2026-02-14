import { useMemo, useCallback } from 'react';
import type { Node, ReactFlowInstance } from '@xyflow/react';
import { nodeContainedInOrganizer } from '@carta/domain';

export interface UseCoveredNodesInputs {
  sortedNodes: Node[];
  setNodes: (updater: (nodes: Node[]) => Node[]) => void;
  reactFlow: ReactFlowInstance;
  setSelectedNodeIds: (ids: string[]) => void;
}

export interface UseCoveredNodesOutputs {
  coveredNodeIds: string[];
  rescueCoveredNodes: () => void;
}

export function useCoveredNodes(inputs: UseCoveredNodesInputs): UseCoveredNodesOutputs {
  const { sortedNodes, setNodes, reactFlow, setSelectedNodeIds } = inputs;

  // Detect non-parented nodes visually covered by organizers they don't belong to
  const coveredNodeIds = useMemo(() => {
    const visibleOrganizers = sortedNodes.filter(n => n.type === 'organizer' && !n.hidden);
    if (visibleOrganizers.length === 0) return [];

    const covered: string[] = [];
    for (const node of sortedNodes) {
      if (node.type === 'organizer' || node.hidden || node.parentId) continue;
      const nodeW = node.measured?.width ?? node.width ?? 200;
      const nodeH = node.measured?.height ?? node.height ?? 100;
      for (const org of visibleOrganizers) {
        const orgW = (org.style?.width as number) ?? org.width ?? 200;
        const orgH = (org.style?.height as number) ?? org.height ?? 200;
        if (nodeContainedInOrganizer(
          node.position, { width: nodeW, height: nodeH },
          org.position, { width: orgW, height: orgH }
        )) {
          covered.push(node.id);
          break;
        }
      }
    }
    return covered;
  }, [sortedNodes]);

  // Rescue covered nodes by moving them just outside the covering organizer
  const rescueCoveredNodes = useCallback(() => {
    const visibleOrganizers = sortedNodes.filter(n => n.type === 'organizer' && !n.hidden);
    const margin = 20;
    const rescuedIds: string[] = [];

    setNodes((nds: Node[]) => nds.map((n: Node) => {
      if (!coveredNodeIds.includes(n.id)) return n;

      const nodeW = n.measured?.width ?? n.width ?? 200;
      const nodeH = n.measured?.height ?? n.height ?? 100;

      // Find the covering organizer
      const coveringOrg = visibleOrganizers.find(org => {
        const orgW = (org.style?.width as number) ?? org.width ?? 200;
        const orgH = (org.style?.height as number) ?? org.height ?? 200;
        return nodeContainedInOrganizer(
          n.position, { width: nodeW, height: nodeH },
          org.position, { width: orgW, height: orgH }
        );
      });
      if (!coveringOrg) return n;

      const orgW = (coveringOrg.style?.width as number) ?? coveringOrg.width ?? 200;
      const orgH = (coveringOrg.style?.height as number) ?? coveringOrg.height ?? 200;

      // Find nearest edge to node center
      const cx = n.position.x + nodeW / 2;
      const cy = n.position.y + nodeH / 2;
      const distLeft = cx - coveringOrg.position.x;
      const distRight = (coveringOrg.position.x + orgW) - cx;
      const distTop = cy - coveringOrg.position.y;
      const distBottom = (coveringOrg.position.y + orgH) - cy;
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      let newPos = { ...n.position };
      if (minDist === distLeft) {
        newPos = { x: coveringOrg.position.x - nodeW - margin, y: n.position.y };
      } else if (minDist === distRight) {
        newPos = { x: coveringOrg.position.x + orgW + margin, y: n.position.y };
      } else if (minDist === distTop) {
        newPos = { x: n.position.x, y: coveringOrg.position.y - nodeH - margin };
      } else {
        newPos = { x: n.position.x, y: coveringOrg.position.y + orgH + margin };
      }

      rescuedIds.push(n.id);
      return { ...n, position: newPos };
    }));

    // Select rescued nodes (visual only, use RF store directly)
    if (rescuedIds.length > 0) {
      reactFlow.setNodes(nds => nds.map(n => ({
        ...n,
        selected: rescuedIds.includes(n.id),
      })));
      setSelectedNodeIds(rescuedIds);
    }
  }, [sortedNodes, coveredNodeIds, setNodes, reactFlow, setSelectedNodeIds]);

  return {
    coveredNodeIds,
    rescueCoveredNodes,
  };
}
