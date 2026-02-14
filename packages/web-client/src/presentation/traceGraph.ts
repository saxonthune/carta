export interface TraceResult {
  nodeDistances: Map<string, number>;
  edgeDistances: Map<string, number>;
  maxDepth: number;
}

interface EdgeLike {
  id: string;
  source: string;
  target: string;
}

/**
 * BFS forward traversal from a start node, following edge.source → edge.target direction.
 * Returns semantic hop distances for all reachable nodes and edges.
 */
export function traceGraph(startNodeId: string, edges: EdgeLike[]): TraceResult {
  // Build adjacency list: source → [{ target, edgeId }]
  const adjacency = new Map<string, Array<{ targetId: string; edgeId: string }>>();
  for (const edge of edges) {
    let neighbors = adjacency.get(edge.source);
    if (!neighbors) {
      neighbors = [];
      adjacency.set(edge.source, neighbors);
    }
    neighbors.push({ targetId: edge.target, edgeId: edge.id });
  }

  const nodeDistances = new Map<string, number>();
  const edgeDistances = new Map<string, number>();
  let maxDepth = 0;

  // BFS
  nodeDistances.set(startNodeId, 0);
  const queue = [startNodeId];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    const currentDist = nodeDistances.get(current)!;
    const neighbors = adjacency.get(current);
    if (!neighbors) continue;

    for (const { targetId, edgeId } of neighbors) {
      // Edge gets distance of source + 1 (the hop number)
      edgeDistances.set(edgeId, currentDist + 1);

      if (!nodeDistances.has(targetId)) {
        const nextDist = currentDist + 1;
        nodeDistances.set(targetId, nextDist);
        if (nextDist > maxDepth) maxDepth = nextDist;
        queue.push(targetId);
      }
    }
  }

  return { nodeDistances, edgeDistances, maxDepth };
}
