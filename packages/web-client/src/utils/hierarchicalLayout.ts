import type { SpreadInput } from './spreadNodes';

/**
 * Hierarchical top-to-bottom layout using Sugiyama-style algorithm.
 * Arranges nodes by edge-flow direction: sources at top, sinks at bottom.
 * Returns a map of node ID → new {x, y} position.
 */
export function hierarchicalLayout(
  nodes: SpreadInput[],
  edges: Array<{ source: string; target: string }>,
  options?: { gap?: number; layerGap?: number }
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return result;
  if (nodes.length === 1) {
    result.set(nodes[0].id, { x: nodes[0].x, y: nodes[0].y });
    return result;
  }

  const gap = options?.gap ?? 40;
  const layerGap = options?.layerGap ?? 80;

  // Compute original centroid
  let cx = 0, cy = 0;
  for (const n of nodes) {
    cx += n.x + n.width / 2;
    cy += n.y + n.height / 2;
  }
  cx /= nodes.length;
  cy /= nodes.length;

  // 1. Build adjacency map (only edges between nodes in our set)
  const nodeIds = new Set(nodes.map(n => n.id));
  const adjacency = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  for (const n of nodes) {
    adjacency.set(n.id, []);
    inDegree.set(n.id, 0);
  }

  for (const e of edges) {
    if (nodeIds.has(e.source) && nodeIds.has(e.target)) {
      adjacency.get(e.source)!.push(e.target);
      inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1);
    }
  }

  // 2. Break cycles using DFS
  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string): void {
    if (visited.has(node)) return;
    visiting.add(node);

    const targets = adjacency.get(node) ?? [];
    const filtered: string[] = [];

    for (const target of targets) {
      if (visiting.has(target)) {
        // Back edge detected - skip it to break cycle
        inDegree.set(target, Math.max(0, (inDegree.get(target) ?? 0) - 1));
      } else {
        filtered.push(target);
        dfs(target);
      }
    }

    adjacency.set(node, filtered);
    visiting.delete(node);
    visited.add(node);
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) {
      dfs(n.id);
    }
  }

  // 3. Assign layers using longest path (topological sort with levels)
  const layers = new Map<string, number>();
  const queue: string[] = [];
  const tempInDegree = new Map<string, number>();

  for (const [id, degree] of inDegree) {
    tempInDegree.set(id, degree);
    if (degree === 0) {
      queue.push(id);
      layers.set(id, 0);
    }
  }

  while (queue.length > 0) {
    const node = queue.shift()!;
    const nodeLayer = layers.get(node) ?? 0;

    for (const target of adjacency.get(node) ?? []) {
      const currentLayer = layers.get(target) ?? 0;
      layers.set(target, Math.max(currentLayer, nodeLayer + 1));

      const degree = tempInDegree.get(target)! - 1;
      tempInDegree.set(target, degree);

      if (degree === 0) {
        queue.push(target);
      }
    }
  }

  // Nodes with no edges get layer 0
  for (const n of nodes) {
    if (!layers.has(n.id)) {
      layers.set(n.id, 0);
    }
  }

  // 4. Group nodes by layer
  const layerNodes = new Map<number, SpreadInput[]>();
  for (const n of nodes) {
    const layer = layers.get(n.id)!;
    if (!layerNodes.has(layer)) {
      layerNodes.set(layer, []);
    }
    layerNodes.get(layer)!.push(n);
  }

  // 5. Order within layers using barycenter heuristic (2 passes)
  const maxLayer = Math.max(...layers.values());
  const layerOrder = new Map<number, string[]>();

  // Initialize with original order
  for (const [layer, lnodes] of layerNodes) {
    layerOrder.set(layer, lnodes.map(n => n.id));
  }

  // Down pass
  for (let layer = 1; layer <= maxLayer; layer++) {
    const lnodes = layerNodes.get(layer);
    if (!lnodes || lnodes.length === 0) continue;

    const prevOrder = layerOrder.get(layer - 1) ?? [];
    const posMap = new Map(prevOrder.map((id, i) => [id, i]));

    const barycenters = lnodes.map(n => {
      const predecessors = nodes.filter(p =>
        adjacency.get(p.id)?.includes(n.id) && layers.get(p.id) === layer - 1
      );

      if (predecessors.length === 0) return { id: n.id, bc: -1 };

      const sum = predecessors.reduce((s, p) => s + (posMap.get(p.id) ?? 0), 0);
      return { id: n.id, bc: sum / predecessors.length };
    });

    barycenters.sort((a, b) => {
      if (a.bc === -1 && b.bc === -1) return 0;
      if (a.bc === -1) return 1;
      if (b.bc === -1) return -1;
      return a.bc - b.bc;
    });

    layerOrder.set(layer, barycenters.map(b => b.id));
  }

  // Up pass
  for (let layer = maxLayer - 1; layer >= 0; layer--) {
    const lnodes = layerNodes.get(layer);
    if (!lnodes || lnodes.length === 0) continue;

    const nextOrder = layerOrder.get(layer + 1) ?? [];
    const posMap = new Map(nextOrder.map((id, i) => [id, i]));

    const barycenters = lnodes.map(n => {
      const successors = adjacency.get(n.id)?.filter(t => layers.get(t) === layer + 1) ?? [];

      if (successors.length === 0) return { id: n.id, bc: -1 };

      const sum = successors.reduce((s, t) => s + (posMap.get(t) ?? 0), 0);
      return { id: n.id, bc: sum / successors.length };
    });

    barycenters.sort((a, b) => {
      if (a.bc === -1 && b.bc === -1) return 0;
      if (a.bc === -1) return 1;
      if (b.bc === -1) return -1;
      return a.bc - b.bc;
    });

    layerOrder.set(layer, barycenters.map(b => b.id));
  }

  // 6. Assign coordinates
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const positions: { id: string; x: number; y: number; w: number; h: number }[] = [];

  for (let layer = 0; layer <= maxLayer; layer++) {
    const order = layerOrder.get(layer) ?? [];
    if (order.length === 0) continue;

    let x = 0;
    const y = layer * layerGap;

    for (const id of order) {
      const node = nodeMap.get(id)!;
      positions.push({ id, x, y, w: node.width, h: node.height });
      x += node.width + gap;
    }
  }

  // Center each layer horizontally
  const layerWidths = new Map<number, number>();
  for (const p of positions) {
    const layer = layers.get(p.id)!;
    const currentWidth = layerWidths.get(layer) ?? 0;
    layerWidths.set(layer, Math.max(currentWidth, p.x + p.w));
  }

  const maxWidth = Math.max(...layerWidths.values());

  for (const p of positions) {
    const layer = layers.get(p.id)!;
    const layerWidth = layerWidths.get(layer)!;
    p.x += (maxWidth - layerWidth) / 2;
  }

  // 7. Compute new centroid and shift to maintain original
  let ncx = 0, ncy = 0;
  for (const p of positions) {
    ncx += p.x + p.w / 2;
    ncy += p.y + p.h / 2;
  }
  ncx /= positions.length;
  ncy /= positions.length;

  const dx = cx - ncx;
  const dy = cy - ncy;

  for (const p of positions) {
    result.set(p.id, { x: p.x + dx, y: p.y + dy });
  }

  return result;
}
