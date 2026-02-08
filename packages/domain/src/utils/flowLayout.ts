/**
 * Flow layout algorithm - topological layout for directed acyclic graphs
 * Based on Sugiyama framework: layer assignment, crossing minimization, coordinate assignment
 */

export interface FlowLayoutInput {
  id: string;
  semanticId: string;
  x: number;
  y: number;
  width: number;   // caller provides (server uses defaults, client uses measured)
  height: number;
}

export interface FlowLayoutEdge {
  sourceId: string;      // node ID
  targetId: string;      // node ID
  sourcePortId: string;  // e.g. "flow-out"
  targetPortId: string;  // e.g. "flow-in"
}

export type FlowDirection = 'TB' | 'BT' | 'LR' | 'RL';

export interface FlowLayoutOptions {
  direction: FlowDirection;
  sourcePort?: string;   // port ID defining "downstream" (default: "flow-out")
  sinkPort?: string;     // port ID defining "upstream" (default: "flow-in")
  layerGap?: number;     // gap between layers (default: 250)
  nodeGap?: number;      // gap between nodes in same layer (default: 150)
}

export interface FlowLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  layers: Map<string, number>;     // node ID → layer index (metadata for client tidy)
  layerOrder: Map<string, number>; // node ID → order within layer
}

/**
 * Compute flow layout for a set of nodes and edges
 */
export function computeFlowLayout(
  nodes: FlowLayoutInput[],
  edges: FlowLayoutEdge[],
  options: FlowLayoutOptions
): FlowLayoutResult {
  const sourcePort = options.sourcePort ?? 'flow-out';
  const sinkPort = options.sinkPort ?? 'flow-in';
  const layerGap = options.layerGap ?? 250;
  const nodeGap = options.nodeGap ?? 150;

  // Step 1: Filter edges to only flow edges
  const flowEdges = edges.filter(e => e.sourcePortId === sourcePort);

  // Step 2: Build adjacency maps
  const downstream = new Map<string, string[]>();
  const upstream = new Map<string, string[]>();

  for (const node of nodes) {
    downstream.set(node.id, []);
    upstream.set(node.id, []);
  }

  for (const edge of flowEdges) {
    downstream.get(edge.sourceId)?.push(edge.targetId);
    upstream.get(edge.targetId)?.push(edge.sourceId);
  }

  // Step 3: Detect cycles using DFS and break them
  const validEdges = breakCycles(nodes, flowEdges, downstream);

  // Rebuild adjacency with valid edges only
  downstream.clear();
  upstream.clear();
  for (const node of nodes) {
    downstream.set(node.id, []);
    upstream.set(node.id, []);
  }
  for (const edge of validEdges) {
    downstream.get(edge.sourceId)?.push(edge.targetId);
    upstream.get(edge.targetId)?.push(edge.sourceId);
  }

  // Step 4: Layer assignment (longest path from sources)
  const layers = assignLayers(nodes, upstream);

  // Step 5: Crossing minimization (barycenter heuristic)
  const layerNodes = groupByLayer(nodes, layers);
  const ordering = minimizeCrossings(layerNodes, downstream, upstream);

  // Step 6: Coordinate assignment
  const positions = assignCoordinates(
    nodes,
    layers,
    ordering,
    options.direction,
    layerGap,
    nodeGap
  );

  // Step 7: Preserve centroid
  const originalCentroid = computeCentroid(nodes);
  const newCentroid = computeCentroidFromPositions(positions);
  const offset = {
    x: originalCentroid.x - newCentroid.x,
    y: originalCentroid.y - newCentroid.y,
  };

  for (const [id, pos] of positions) {
    pos.x += offset.x;
    pos.y += offset.y;
  }

  // Step 8: Build layer order map
  const layerOrder = new Map<string, number>();
  for (const [layer, nodeIds] of ordering) {
    for (let i = 0; i < nodeIds.length; i++) {
      layerOrder.set(nodeIds[i], i);
    }
  }

  return { positions, layers, layerOrder };
}

/**
 * Break cycles by detecting back edges using DFS
 */
function breakCycles(
  nodes: FlowLayoutInput[],
  edges: FlowLayoutEdge[],
  downstream: Map<string, string[]>
): FlowLayoutEdge[] {
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const backEdges = new Set<string>();

  function dfs(nodeId: string, path: string[]): void {
    if (inStack.has(nodeId)) {
      // Found a cycle - mark the back edge
      const cycleStart = path.indexOf(nodeId);
      if (cycleStart >= 0 && cycleStart < path.length - 1) {
        const edgeKey = `${path[path.length - 1]}->${nodeId}`;
        backEdges.add(edgeKey);
      }
      return;
    }

    if (visited.has(nodeId)) return;

    visited.add(nodeId);
    inStack.add(nodeId);
    path.push(nodeId);

    const neighbors = downstream.get(nodeId) ?? [];
    for (const neighbor of neighbors) {
      dfs(neighbor, path);
    }

    path.pop();
    inStack.delete(nodeId);
  }

  // Start DFS from all nodes
  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id, []);
    }
  }

  // Filter out back edges
  return edges.filter(e => !backEdges.has(`${e.sourceId}->${e.targetId}`));
}

/**
 * Assign layers using longest path from sources
 */
function assignLayers(
  nodes: FlowLayoutInput[],
  upstream: Map<string, string[]>
): Map<string, number> {
  const layers = new Map<string, number>();
  const processed = new Set<string>();

  // Find sources (nodes with no incoming flow edges)
  const sources = nodes.filter(n => (upstream.get(n.id)?.length ?? 0) === 0);

  // BFS to assign layers
  const queue: string[] = sources.map(n => n.id);
  for (const id of queue) {
    layers.set(id, 0);
    processed.add(id);
  }

  // Process remaining nodes based on max predecessor layer + 1
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (processed.has(node.id)) continue;

      const upstreamNodes = upstream.get(node.id) ?? [];
      if (upstreamNodes.length === 0) {
        // Disconnected node - place in layer 0
        layers.set(node.id, 0);
        processed.add(node.id);
        changed = true;
        continue;
      }

      // Check if all upstream nodes have been assigned
      const upstreamLayers = upstreamNodes
        .map(id => layers.get(id))
        .filter((l): l is number => l !== undefined);

      if (upstreamLayers.length === upstreamNodes.length) {
        const maxUpstream = Math.max(...upstreamLayers);
        layers.set(node.id, maxUpstream + 1);
        processed.add(node.id);
        changed = true;
      }
    }
  }

  return layers;
}

/**
 * Group nodes by layer
 */
function groupByLayer(
  nodes: FlowLayoutInput[],
  layers: Map<string, number>
): Map<number, string[]> {
  const layerNodes = new Map<number, string[]>();

  for (const node of nodes) {
    const layer = layers.get(node.id) ?? 0;
    if (!layerNodes.has(layer)) {
      layerNodes.set(layer, []);
    }
    layerNodes.get(layer)!.push(node.id);
  }

  return layerNodes;
}

/**
 * Minimize crossings using barycenter heuristic
 */
function minimizeCrossings(
  layerNodes: Map<number, string[]>,
  downstream: Map<string, string[]>,
  upstream: Map<string, string[]>
): Map<number, string[]> {
  const ordering = new Map<number, string[]>();

  // Initialize ordering
  for (const [layer, nodeIds] of layerNodes) {
    ordering.set(layer, [...nodeIds]);
  }

  const maxLayer = Math.max(...layerNodes.keys());

  // Two sweeps: forward then backward
  for (let sweep = 0; sweep < 2; sweep++) {
    // Forward sweep
    for (let layer = 0; layer <= maxLayer; layer++) {
      const nodeIds = ordering.get(layer);
      if (!nodeIds || nodeIds.length <= 1) continue;

      const prevLayerOrder = ordering.get(layer - 1);
      if (!prevLayerOrder) continue;

      // Compute barycenter for each node based on upstream connections
      const barycenters = nodeIds.map(id => {
        const upstreamIds = upstream.get(id) ?? [];
        const positions = upstreamIds
          .map(upId => prevLayerOrder.indexOf(upId))
          .filter(pos => pos >= 0);

        if (positions.length === 0) return Infinity;
        return positions.reduce((a, b) => a + b, 0) / positions.length;
      });

      // Sort nodes by barycenter
      const sorted = nodeIds
        .map((id, i) => ({ id, barycenter: barycenters[i] }))
        .sort((a, b) => a.barycenter - b.barycenter)
        .map(x => x.id);

      ordering.set(layer, sorted);
    }

    // Backward sweep
    for (let layer = maxLayer; layer >= 0; layer--) {
      const nodeIds = ordering.get(layer);
      if (!nodeIds || nodeIds.length <= 1) continue;

      const nextLayerOrder = ordering.get(layer + 1);
      if (!nextLayerOrder) continue;

      // Compute barycenter for each node based on downstream connections
      const barycenters = nodeIds.map(id => {
        const downstreamIds = downstream.get(id) ?? [];
        const positions = downstreamIds
          .map(downId => nextLayerOrder.indexOf(downId))
          .filter(pos => pos >= 0);

        if (positions.length === 0) return Infinity;
        return positions.reduce((a, b) => a + b, 0) / positions.length;
      });

      // Sort nodes by barycenter
      const sorted = nodeIds
        .map((id, i) => ({ id, barycenter: barycenters[i] }))
        .sort((a, b) => a.barycenter - b.barycenter)
        .map(x => x.id);

      ordering.set(layer, sorted);
    }
  }

  return ordering;
}

/**
 * Assign coordinates based on layers and ordering
 */
function assignCoordinates(
  nodes: FlowLayoutInput[],
  layers: Map<string, number>,
  ordering: Map<number, string[]>,
  direction: FlowDirection,
  layerGap: number,
  nodeGap: number
): Map<string, { x: number; y: number }> {
  const positions = new Map<string, { x: number; y: number }>();
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (const [layer, nodeIds] of ordering) {
    // Compute total height/width of this layer
    const nodeSizes = nodeIds.map(id => {
      const node = nodeMap.get(id)!;
      return direction === 'TB' || direction === 'BT' ? node.width : node.height;
    });

    const totalSize = nodeSizes.reduce((a, b) => a + b, 0) + (nodeIds.length - 1) * nodeGap;

    // Position nodes centered around 0 on secondary axis
    let offset = -totalSize / 2;
    for (let i = 0; i < nodeIds.length; i++) {
      const id = nodeIds[i];
      const node = nodeMap.get(id)!;
      const size = nodeSizes[i];

      let x: number, y: number;

      if (direction === 'TB') {
        x = offset + size / 2;
        y = layer * layerGap;
      } else if (direction === 'BT') {
        x = offset + size / 2;
        y = -layer * layerGap;
      } else if (direction === 'LR') {
        x = layer * layerGap;
        y = offset + size / 2;
      } else { // RL
        x = -layer * layerGap;
        y = offset + size / 2;
      }

      positions.set(id, { x, y });
      offset += size + nodeGap;
    }
  }

  return positions;
}

/**
 * Compute centroid of input nodes
 */
function computeCentroid(nodes: FlowLayoutInput[]): { x: number; y: number } {
  if (nodes.length === 0) return { x: 0, y: 0 };

  const sumX = nodes.reduce((sum, n) => sum + n.x, 0);
  const sumY = nodes.reduce((sum, n) => sum + n.y, 0);

  return {
    x: sumX / nodes.length,
    y: sumY / nodes.length,
  };
}

/**
 * Compute centroid from position map
 */
function computeCentroidFromPositions(
  positions: Map<string, { x: number; y: number }>
): { x: number; y: number } {
  if (positions.size === 0) return { x: 0, y: 0 };

  let sumX = 0;
  let sumY = 0;

  for (const pos of positions.values()) {
    sumX += pos.x;
    sumY += pos.y;
  }

  return {
    x: sumX / positions.size,
    y: sumY / positions.size,
  };
}
