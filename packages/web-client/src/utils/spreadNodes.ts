export interface SpreadInput {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Spreads nodes into a grid layout, maintaining original centroid.
 * Returns a map of node ID → new {x, y} position.
 */
export function spreadNodes(nodes: SpreadInput[], gap = 20): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  if (nodes.length === 0) return result;
  if (nodes.length === 1) {
    result.set(nodes[0].id, { x: nodes[0].x, y: nodes[0].y });
    return result;
  }

  // Compute original centroid
  let cx = 0, cy = 0;
  for (const n of nodes) {
    cx += n.x + n.width / 2;
    cy += n.y + n.height / 2;
  }
  cx /= nodes.length;
  cy /= nodes.length;

  // Sort by row (y) then column (x)
  const sorted = [...nodes].sort((a, b) => {
    const rowDiff = a.y - b.y;
    if (Math.abs(rowDiff) > 30) return rowDiff;
    return a.x - b.x;
  });

  // Determine grid dimensions
  const cols = Math.ceil(Math.sqrt(sorted.length));

  // Place in grid
  const positions: { id: string; x: number; y: number; w: number; h: number }[] = [];
  let gridY = 0;
  for (let row = 0; row < Math.ceil(sorted.length / cols); row++) {
    let gridX = 0;
    let maxH = 0;
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (idx >= sorted.length) break;
      const n = sorted[idx];
      positions.push({ id: n.id, x: gridX, y: gridY, w: n.width, h: n.height });
      gridX += n.width + gap;
      maxH = Math.max(maxH, n.height);
    }
    gridY += maxH + gap;
  }

  // Compute new centroid
  let ncx = 0, ncy = 0;
  for (const p of positions) {
    ncx += p.x + p.w / 2;
    ncy += p.y + p.h / 2;
  }
  ncx /= positions.length;
  ncy /= positions.length;

  // Shift to maintain original centroid
  const dx = cx - ncx;
  const dy = cy - ncy;
  for (const p of positions) {
    result.set(p.id, { x: p.x + dx, y: p.y + dy });
  }

  return result;
}
