import { useMemo } from 'react';
import type { CartaEdge } from '@carta/schema';

export interface BundleData {
  bundleCount: number;
  bundledEdgeIds: string[];
}

/**
 * Groups parallel edges between the same node pair (same port types) into bundles.
 * Returns display edges where bundles are collapsed into a single representative edge.
 *
 * Accepts a nodeTypeMap (id → type) instead of full CartaNode[] to avoid re-computing
 * when only node positions/data change but topology is unchanged.
 */
export function useEdgeBundling(edges: CartaEdge[], nodeTypeMap: Map<string, string>): {
  displayEdges: CartaEdge[];
  bundleMap: Map<string, CartaEdge[]>;
} {
  return useMemo(() => {
    if (edges.length === 0) {
      return { displayEdges: [], bundleMap: new Map() };
    }

    // Build bundle key: normalized pair of nodeIds + port types
    const bundles = new Map<string, CartaEdge[]>();

    for (const edge of edges) {
      const sourceType = nodeTypeMap.get(edge.source);
      const targetType = nodeTypeMap.get(edge.target);

      const sourcePortType = edge.sourceHandle || 'default';
      const targetPortType = edge.targetHandle || 'default';

      // Normalize: always put smaller nodeId first for consistent keying
      const [nodeA, nodeB, portA, portB] =
        edge.source < edge.target
          ? [edge.source, edge.target, sourcePortType, targetPortType]
          : [edge.target, edge.source, targetPortType, sourcePortType];

      // Only bundle construct-to-construct edges
      const isConstruct = sourceType === 'construct' && targetType === 'construct';
      const key = isConstruct
        ? `${nodeA}|${nodeB}|${portA}|${portB}`
        : edge.id; // unique key = no bundling

      if (!bundles.has(key)) bundles.set(key, []);
      bundles.get(key)!.push(edge);
    }

    const displayEdges: CartaEdge[] = [];

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
          polarity: (bundledEdges[0].data as Record<string, unknown>)?.polarity,
        } as Record<string, unknown>;
        displayEdges.push(representative);
      }
    }

    return { displayEdges, bundleMap: bundles };
  }, [edges, nodeTypeMap]);
}
