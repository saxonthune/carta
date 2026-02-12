export interface NodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Waypoint {
  x: number;
  y: number;
}

export interface RouteResult {
  waypoints: Waypoint[]; // ordered source→target, includes source/target boundary points
}

interface GridNode {
  x: number;
  y: number;
}

interface PathNode {
  node: GridNode;
  g: number; // cost from start
  h: number; // heuristic to goal
  f: number; // g + h
  parent: PathNode | null;
}

/**
 * Compute obstacle-avoiding orthogonal routes for a set of edges.
 * Pure function — no side effects, no React.
 */
export function computeOrthogonalRoutes(
  edges: Array<{
    id: string;
    sourceRect: NodeRect;
    targetRect: NodeRect;
  }>,
  obstacles: NodeRect[],
  padding: number = 20,
): Map<string, RouteResult> {
  const routes = new Map<string, RouteResult>();

  for (const edge of edges) {
    const route = computeSingleRoute(edge.sourceRect, edge.targetRect, obstacles, padding);
    routes.set(edge.id, route);
  }

  return routes;
}

function computeSingleRoute(
  sourceRect: NodeRect,
  targetRect: NodeRect,
  allObstacles: NodeRect[],
  padding: number,
): RouteResult {
  // Filter out source and target from obstacles (edges shouldn't route around their own endpoints)
  const obstacles = allObstacles.filter(
    obs => obs.id !== sourceRect.id && obs.id !== targetRect.id
  );

  // Compute boundary points (center-to-center approach)
  const sourceCenter = {
    x: sourceRect.x + sourceRect.width / 2,
    y: sourceRect.y + sourceRect.height / 2,
  };
  const targetCenter = {
    x: targetRect.x + targetRect.width / 2,
    y: targetRect.y + targetRect.height / 2,
  };

  const sourceBoundary = getRectBoundaryPoint(sourceRect, targetCenter);
  const targetBoundary = getRectBoundaryPoint(targetRect, sourceCenter);

  // Build grid from obstacles
  const gridLines = buildGridLines(obstacles, sourceBoundary, targetBoundary, padding);

  // Find path using A*
  const path = findPath(gridLines, sourceBoundary, targetBoundary, obstacles, padding);

  if (path.length === 0) {
    // No path found, return empty waypoints (edge will fall back to smooth step)
    return { waypoints: [] };
  }

  // Simplify path (remove collinear points)
  const simplified = simplifyPath(path);

  return { waypoints: simplified };
}

/**
 * Build orthogonal grid lines from obstacle bounding boxes.
 */
function buildGridLines(
  obstacles: NodeRect[],
  start: Waypoint,
  end: Waypoint,
  padding: number,
): { horizontal: number[]; vertical: number[] } {
  const horizontalSet = new Set<number>();
  const verticalSet = new Set<number>();

  // Add lines for each obstacle
  for (const obs of obstacles) {
    horizontalSet.add(obs.y - padding); // top
    horizontalSet.add(obs.y + obs.height + padding); // bottom
    verticalSet.add(obs.x - padding); // left
    verticalSet.add(obs.x + obs.width + padding); // right
  }

  // Add start/end coordinates
  horizontalSet.add(start.y);
  verticalSet.add(start.x);
  horizontalSet.add(end.y);
  verticalSet.add(end.x);

  return {
    horizontal: Array.from(horizontalSet).sort((a, b) => a - b),
    vertical: Array.from(verticalSet).sort((a, b) => a - b),
  };
}

/**
 * Check if a point is inside any obstacle (with padding).
 */
function isInsideObstacle(
  point: Waypoint,
  obstacles: NodeRect[],
  padding: number,
): boolean {
  for (const obs of obstacles) {
    if (
      point.x >= obs.x - padding &&
      point.x <= obs.x + obs.width + padding &&
      point.y >= obs.y - padding &&
      point.y <= obs.y + obs.height + padding
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a line segment intersects any obstacle (with padding).
 */
function lineIntersectsObstacle(
  p1: Waypoint,
  p2: Waypoint,
  obstacles: NodeRect[],
  padding: number,
): boolean {
  for (const obs of obstacles) {
    const expandedObs = {
      x: obs.x - padding,
      y: obs.y - padding,
      width: obs.width + 2 * padding,
      height: obs.height + 2 * padding,
    };

    // Check if horizontal or vertical line segment intersects rectangle
    if (p1.x === p2.x) {
      // Vertical line
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      if (
        p1.x >= expandedObs.x &&
        p1.x <= expandedObs.x + expandedObs.width &&
        minY <= expandedObs.y + expandedObs.height &&
        maxY >= expandedObs.y
      ) {
        return true;
      }
    } else if (p1.y === p2.y) {
      // Horizontal line
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      if (
        p1.y >= expandedObs.y &&
        p1.y <= expandedObs.y + expandedObs.height &&
        minX <= expandedObs.x + expandedObs.width &&
        maxX >= expandedObs.x
      ) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Find path using A* on the grid.
 */
function findPath(
  gridLines: { horizontal: number[]; vertical: number[] },
  start: Waypoint,
  end: Waypoint,
  obstacles: NodeRect[],
  padding: number,
): Waypoint[] {
  // Build valid grid nodes (intersections that aren't inside obstacles)
  const validNodes = new Set<string>();
  const nodeKey = (p: Waypoint) => `${p.x},${p.y}`;

  for (const x of gridLines.vertical) {
    for (const y of gridLines.horizontal) {
      const point = { x, y };
      if (!isInsideObstacle(point, obstacles, padding)) {
        validNodes.add(nodeKey(point));
      }
    }
  }

  // Add start and end even if not on grid
  validNodes.add(nodeKey(start));
  validNodes.add(nodeKey(end));

  // A* search
  const openSet: PathNode[] = [];
  const closedSet = new Set<string>();
  const openSetMap = new Map<string, PathNode>();

  const startNode: PathNode = {
    node: start,
    g: 0,
    h: manhattan(start, end),
    f: manhattan(start, end),
    parent: null,
  };
  openSet.push(startNode);
  openSetMap.set(nodeKey(start), startNode);

  while (openSet.length > 0) {
    // Get node with lowest f score
    openSet.sort((a, b) => a.f - b.f);
    const current = openSet.shift()!;
    const currentKey = nodeKey(current.node);
    openSetMap.delete(currentKey);

    // Goal reached
    if (currentKey === nodeKey(end)) {
      return reconstructPath(current);
    }

    closedSet.add(currentKey);

    // Get neighbors (orthogonal moves along grid lines)
    const neighbors = getNeighbors(current.node, gridLines, validNodes, obstacles, padding);

    for (const neighbor of neighbors) {
      const neighborKey = nodeKey(neighbor);

      if (closedSet.has(neighborKey)) {
        continue;
      }

      // Cost to reach neighbor
      const dist = manhattan(current.node, neighbor);
      const directionChangePenalty = getDirectionChangePenalty(current, neighbor);
      const tentativeG = current.g + dist + directionChangePenalty;

      const existingNode = openSetMap.get(neighborKey);
      if (!existingNode || tentativeG < existingNode.g) {
        const neighborNode: PathNode = {
          node: neighbor,
          g: tentativeG,
          h: manhattan(neighbor, end),
          f: tentativeG + manhattan(neighbor, end),
          parent: current,
        };

        if (existingNode) {
          // Update existing node
          const idx = openSet.indexOf(existingNode);
          if (idx !== -1) {
            openSet[idx] = neighborNode;
          }
        } else {
          // Add new node
          openSet.push(neighborNode);
        }
        openSetMap.set(neighborKey, neighborNode);
      }
    }
  }

  // No path found
  return [];
}

/**
 * Get orthogonal neighbors along grid lines.
 */
function getNeighbors(
  node: Waypoint,
  gridLines: { horizontal: number[]; vertical: number[] },
  validNodes: Set<string>,
  obstacles: NodeRect[],
  padding: number,
): Waypoint[] {
  const neighbors: Waypoint[] = [];
  const nodeKey = (p: Waypoint) => `${p.x},${p.y}`;

  // Horizontal neighbors (same Y, different X)
  for (const x of gridLines.vertical) {
    if (x === node.x) continue;
    const neighbor = { x, y: node.y };
    const key = nodeKey(neighbor);
    if (validNodes.has(key) && !lineIntersectsObstacle(node, neighbor, obstacles, padding)) {
      neighbors.push(neighbor);
    }
  }

  // Vertical neighbors (same X, different Y)
  for (const y of gridLines.horizontal) {
    if (y === node.y) continue;
    const neighbor = { x: node.x, y };
    const key = nodeKey(neighbor);
    if (validNodes.has(key) && !lineIntersectsObstacle(node, neighbor, obstacles, padding)) {
      neighbors.push(neighbor);
    }
  }

  return neighbors;
}

/**
 * Penalty for changing direction (prefer fewer bends).
 */
function getDirectionChangePenalty(current: PathNode, neighbor: Waypoint): number {
  if (!current.parent) return 0;

  const prevDir = getDirection(current.parent.node, current.node);
  const currDir = getDirection(current.node, neighbor);

  return prevDir === currDir ? 0 : 5; // Small penalty for direction change
}

function getDirection(from: Waypoint, to: Waypoint): 'h' | 'v' {
  return from.y === to.y ? 'h' : 'v';
}

function manhattan(a: Waypoint, b: Waypoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

function reconstructPath(node: PathNode): Waypoint[] {
  const path: Waypoint[] = [];
  let current: PathNode | null = node;
  while (current) {
    path.unshift(current.node);
    current = current.parent;
  }
  return path;
}

/**
 * Remove collinear intermediate points.
 */
function simplifyPath(path: Waypoint[]): Waypoint[] {
  if (path.length <= 2) return path;

  const simplified: Waypoint[] = [path[0]];

  for (let i = 1; i < path.length - 1; i++) {
    const prev = path[i - 1];
    const curr = path[i];
    const next = path[i + 1];

    // Keep point if direction changes
    const dir1 = getDirection(prev, curr);
    const dir2 = getDirection(curr, next);

    if (dir1 !== dir2) {
      simplified.push(curr);
    }
  }

  simplified.push(path[path.length - 1]);
  return simplified;
}

/**
 * Given a rectangle and a target point, find the intersection of
 * the line from the rect center to the target with the rect boundary.
 * (Duplicated from DynamicAnchorEdge for self-contained routing algorithm)
 */
function getRectBoundaryPoint(
  rect: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number }
): { x: number; y: number } {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  // Avoid division by zero
  if (dx === 0 && dy === 0) {
    return { x: cx, y: rect.y + rect.height };
  }

  const hw = rect.width / 2;
  const hh = rect.height / 2;

  // Scale factors to reach each edge
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;

  const scale = Math.min(scaleX, scaleY);
  const ix = cx + dx * scale;
  const iy = cy + dy * scale;

  return { x: ix, y: iy };
}
