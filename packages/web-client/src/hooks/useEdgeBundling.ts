import { useMemo } from 'react';
import type { Edge, Node } from '@xyflow/react';

export interface BundleData {
  bundleCount: number;
  bundledEdgeIds: string[];
}

/**
 * Groups parallel edges between the same node pair (same port types) into bundles.
 * Returns display edges where bundles are collapsed into a single representative edge.
 */
export function useEdgeBundling(edges: Edge[], nodes: Node[]): {
  displayEdges: Edge[];
  bundleMap: Map<string, Edge[]>;
} {
  return useMemo(() => {
    if (edges.length === 0) {
      return { displayEdges: [], bundleMap: new Map() };
    }

    // Build node lookup for getting port types
    const nodeMap = new Map<string, Node>();
    for (const node of nodes) {
      nodeMap.set(node.id, node);
    }

    // Build bundle key: normalized pair of nodeIds + port types
    const bundles = new Map<string, Edge[]>();

    for (const edge of edges) {
      const sourceNode = nodeMap.get(edge.source);
      const targetNode = nodeMap.get(edge.target);

      const sourcePortType = edge.sourceHandle || 'default';
      const targetPortType = edge.targetHandle || 'default';

      // Normalize: always put smaller nodeId first for consistent keying
      const [nodeA, nodeB, portA, portB] =
        edge.source < edge.target
          ? [edge.source, edge.target, sourcePortType, targetPortType]
          : [edge.target, edge.source, targetPortType, sourcePortType];

      // Only bundle construct-to-construct edges
      const isConstruct = sourceNode?.type === 'construct' && targetNode?.type === 'construct';
      const key = isConstruct
        ? `${nodeA}|${nodeB}|${portA}|${portB}`
        : edge.id; // unique key = no bundling

      if (!bundles.has(key)) bundles.set(key, []);
      bundles.get(key)!.push(edge);
    }

    const displayEdges: Edge[] = [];

    for (const [, bundledEdges] of bundles) {
      if (bundledEdges.length === 1) {
        // Single edge - still use bundled type for smart routing
        const single = { ...bundledEdges[0] };
        single.type = 'bundled';
        displayEdges.push(single);
      } else {
        // Bundle: keep first edge as representative, mark it as bundled
        const representative = { ...bundledEdges[0] };
        representative.type = 'bundled';
        representative.data = {
          ...representative.data,
          bundleCount: bundledEdges.length,
          bundledEdgeIds: bundledEdges.map(e => e.id),
        } as Record<string, unknown>;
        displayEdges.push(representative);
      }
    }

    return { displayEdges, bundleMap: bundles };
  }, [edges, nodes]);
}
