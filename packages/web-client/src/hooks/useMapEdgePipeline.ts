import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import type { ConstructSchema, ConstructNodeData, OrganizerNodeData } from '@carta/domain';
import { computeEdgeAggregation, filterInvalidEdges } from '../presentation/index';
import { useEdgeBundling } from './useEdgeBundling';

export interface MapEdgePipelineInputs {
  edges: Edge[];
  sortedNodes: Node[];
  edgeRemap: Map<string, string>;
  selectedNodeIds: string[];
  schemas: ConstructSchema[];
  getSchema: (type: string) => ConstructSchema | undefined;
  getPortSchema: (id: string) => { polarity?: string } | undefined;
  isTraceActive: boolean;
  traceResult: { edgeDistances: Map<string, number> } | null;
  nodes: Node[];
}

export interface MapEdgePipelineOutputs {
  displayEdges: Edge[];
  bundleMap: globalThis.Map<string, Edge[]>;
}

export function useMapEdgePipeline(inputs: MapEdgePipelineInputs): MapEdgePipelineOutputs {
  const {
    edges,
    sortedNodes,
    edgeRemap,
    selectedNodeIds,
    schemas,
    getSchema,
    getPortSchema,
    isTraceActive,
    traceResult,
    nodes,
  } = inputs;

  // Aggregate cross-organizer edges and remap collapsed edges
  const selectedNodeIdsSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const filteredEdges = useMemo(() => {
    // Aggregate edges crossing organizer boundaries (replaces collapse remap + dedup)
    let result = computeEdgeAggregation(edges, sortedNodes, edgeRemap, selectedNodeIdsSet);

    // Remove edges whose resolved source or target is hidden (not in visible nodes)
    const visibleNodeIds = new Set(
      sortedNodes.filter(n => !n.hidden).map(n => n.id)
    );
    result = result.filter(edge =>
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );

    // Filter edges with invalid handle references (defensive layer against stale port refs)
    result = filterInvalidEdges(result, sortedNodes, getSchema);

    // Inject wagon attachment edges (thick dotted lines from construct to its attached organizer)
    const wagonEdges: Edge[] = [];
    for (const node of sortedNodes) {
      if (node.type !== 'organizer' || node.hidden) continue;
      const orgData = node.data as OrganizerNodeData;
      if (!orgData.attachedToSemanticId) continue;
      const owner = sortedNodes.find(n =>
        n.type === 'construct' && !n.hidden &&
        (n.data as ConstructNodeData).semanticId === orgData.attachedToSemanticId
      );
      if (!owner) continue;
      wagonEdges.push({
        id: `wagon-${node.id}`,
        source: owner.id,
        target: node.id,
        sourceHandle: null,
        targetHandle: 'group-connect',
        type: 'bundled',
        data: { isAttachmentEdge: true },
        style: { strokeDasharray: '8 4', strokeWidth: 3, stroke: orgData.color },
      });
    }
    if (wagonEdges.length > 0) {
      result = [...result, ...wagonEdges];
    }

    // Augment edges with flow trace data
    if (isTraceActive && traceResult) {
      result = result.map(edge => {
        const hopDistance = traceResult.edgeDistances.get(edge.id);
        return {
          ...edge,
          data: {
            ...edge.data,
            hopDistance,
            dimmed: hopDistance === undefined,
          },
        };
      });
    }

    return result;
  }, [edges, edgeRemap, sortedNodes, selectedNodeIdsSet, isTraceActive, traceResult, getSchema]);

  // Stable node type map — only changes when nodes are added/removed/type changed
  const nodeTypeMap = useMemo(
    () => new globalThis.Map(nodes.map(n => [n.id, n.type ?? 'construct'] as [string, string])),
    [nodes]
  );

  // Build a stable polarity lookup: constructType → portId → polarity
  // Only recalculates when schemas change, not on every node movement.
  const polarityLookup = useMemo(() => {
    const lookup = new globalThis.Map<string, globalThis.Map<string, string>>();
    for (const schema of schemas) {
      if (!schema.ports) continue;
      const portMap = new globalThis.Map<string, string>();
      for (const port of schema.ports) {
        const portSchema = getPortSchema(port.portType);
        if (portSchema?.polarity) {
          portMap.set(port.id, portSchema.polarity);
        }
      }
      if (portMap.size > 0) lookup.set(schema.type, portMap);
    }
    return lookup;
  }, [schemas, getPortSchema]);

  // Stable map: nodeId → constructType (only changes when nodes are added/removed/type changed)
  const nodeConstructTypeMap = useMemo(() => {
    const map = new globalThis.Map<string, string>();
    for (const n of nodes) {
      if (n.type === 'construct') {
        map.set(n.id, (n.data as ConstructNodeData).constructType);
      }
    }
    return map;
  }, [nodes]);

  // Enrich edges with polarity data for arrowhead rendering and waypoints from Yjs
  // Uses stable lookup maps to avoid depending on raw `nodes` reference
  const polarityEdges = useMemo(() => {
    return filteredEdges.map(edge => {
      // Read waypoints from the raw edge (top-level property from Yjs)
      const rawWaypoints = (edge as any).waypoints;

      if ((edge.data as Record<string, unknown>)?.isAttachmentEdge) {
        // Clean up top-level waypoints and optionally enrich data
        const { waypoints: _wp, ...cleanEdge } = edge as any;
        return rawWaypoints
          ? { ...cleanEdge, data: { ...edge.data, waypoints: rawWaypoints } }
          : cleanEdge;
      }

      const constructType = nodeConstructTypeMap.get(edge.source);
      if (!constructType) {
        const { waypoints: _wp, ...cleanEdge } = edge as any;
        return rawWaypoints
          ? { ...cleanEdge, data: { ...edge.data, waypoints: rawWaypoints } }
          : cleanEdge;
      }

      const portMap = polarityLookup.get(constructType);
      if (!portMap) {
        const { waypoints: _wp, ...cleanEdge } = edge as any;
        return rawWaypoints
          ? { ...cleanEdge, data: { ...edge.data, waypoints: rawWaypoints } }
          : cleanEdge;
      }

      const polarity = edge.sourceHandle ? portMap.get(edge.sourceHandle) : undefined;

      // Clean up top-level waypoints and enrich data with both polarity and waypoints
      const { waypoints: _wp, ...cleanEdge } = edge as any;
      return {
        ...cleanEdge,
        data: {
          ...edge.data,
          ...(polarity ? { polarity } : {}),
          ...(rawWaypoints ? { waypoints: rawWaypoints } : {}),
        },
      };
    });
  }, [filteredEdges, nodeConstructTypeMap, polarityLookup]);

  // Edge bundling: collapse parallel edges between same node pairs
  const { displayEdges, bundleMap } = useEdgeBundling(polarityEdges, nodeTypeMap);

  return {
    displayEdges,
    bundleMap,
  };
}
