/**
 * Edge aggregation for organizer boundaries.
 *
 * Edges crossing organizer boundaries are aggregated into summary edges
 * (with bundleCount badge). Intra-organizer edges are kept individual.
 * Selecting a node "unwraps" its edges so you see individual connections.
 */

import type { ProcessableNode } from './organizerProcessor';
import type { ProcessableEdge } from './presentationModel';

/**
 * Compute aggregated edges for cross-organizer boundaries.
 *
 * Rules:
 * 1. Same organizer (or both free) → individual edge
 * 2. Cross-boundary → aggregate by effective endpoint pair
 * 3. Selected nodes keep their own ID as effective endpoint (unwrapped)
 * 4. Hidden nodes (collapsed) use edgeRemap target as effective endpoint
 * 5. Unselected organizer members use organizer ID as effective endpoint
 */
export function computeEdgeAggregation<E extends ProcessableEdge>(
  edges: E[],
  nodes: ProcessableNode[],
  edgeRemap: Map<string, string>,
  selectedNodeIds: Set<string>,
): E[] {
  // Build node lookup
  const nodeMap = new Map<string, ProcessableNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const individualEdges: E[] = [];
  const aggregateGroups = new Map<string, {
    effectiveSource: string;
    effectiveTarget: string;
    sourceRemapped: boolean;
    targetRemapped: boolean;
    edges: E[];
  }>();

  for (const edge of edges) {
    const sourceParentId = nodeMap.get(edge.source)?.parentId;
    const targetParentId = nodeMap.get(edge.target)?.parentId;

    // Check if both endpoints are in the same organizer (or both free)
    const sourceHidden = edgeRemap.has(edge.source);
    const targetHidden = edgeRemap.has(edge.target);

    if (!sourceHidden && !targetHidden && sourceParentId === targetParentId) {
      // Same organizer (including both undefined = both free) → individual
      individualEdges.push(edge);
      continue;
    }

    // Compute effective endpoints
    const { id: effSource, remapped: srcRemapped } = getEffectiveEndpoint(
      edge.source, nodeMap, edgeRemap, selectedNodeIds,
    );
    const { id: effTarget, remapped: tgtRemapped } = getEffectiveEndpoint(
      edge.target, nodeMap, edgeRemap, selectedNodeIds,
    );

    // Self-loop after remapping → skip (intra-collapsed-org)
    if (effSource === effTarget) continue;

    // If neither side was remapped to an organizer, it's individual
    if (!srcRemapped && !tgtRemapped) {
      individualEdges.push(edge);
      continue;
    }

    // Group by effective endpoints for aggregation
    const groupKey = `${effSource}\0${effTarget}`;
    let group = aggregateGroups.get(groupKey);
    if (!group) {
      group = {
        effectiveSource: effSource,
        effectiveTarget: effTarget,
        sourceRemapped: srcRemapped,
        targetRemapped: tgtRemapped,
        edges: [],
      };
      aggregateGroups.set(groupKey, group);
    }
    group.edges.push(edge);
  }

  // Build aggregate edges
  const aggregateEdges: E[] = [];
  for (const group of aggregateGroups.values()) {
    const firstEdge = group.edges[0];
    aggregateEdges.push({
      ...firstEdge,
      id: `agg-${group.effectiveSource}-${group.effectiveTarget}`,
      source: group.effectiveSource,
      target: group.effectiveTarget,
      sourceHandle: group.sourceRemapped ? 'group-connect' : (firstEdge as any).sourceHandle,
      targetHandle: group.targetRemapped ? 'group-connect' : (firstEdge as any).targetHandle,
      data: {
        ...((firstEdge as any).data || {}),
        bundleCount: group.edges.length,
        bundledEdgeIds: group.edges.map(e => e.id),
      },
    } as E);
  }

  return [...individualEdges, ...aggregateEdges];
}

function getEffectiveEndpoint(
  nodeId: string,
  nodeMap: Map<string, ProcessableNode>,
  edgeRemap: Map<string, string>,
  selectedNodeIds: Set<string>,
): { id: string; remapped: boolean } {
  // Hidden (collapsed ancestor) → use collapsed ancestor organizer
  const remapped = edgeRemap.get(nodeId);
  if (remapped) {
    return { id: remapped, remapped: true };
  }

  // Selected → keep as-is (unwrap individual edges)
  if (selectedNodeIds.has(nodeId)) {
    return { id: nodeId, remapped: false };
  }

  // In an organizer → use organizer ID (unless organizer is selected = unwrap)
  const node = nodeMap.get(nodeId);
  if (node?.parentId) {
    if (selectedNodeIds.has(node.parentId)) {
      return { id: nodeId, remapped: false };  // unwrap: show individual edge
    }
    return { id: node.parentId, remapped: true };
  }

  // Free node → keep as-is
  return { id: nodeId, remapped: false };
}
