import type { SpreadInput } from './spreadNodes';

/**
 * Compacts nodes by removing whitespace while preserving spatial order.
 * Groups nodes into rows (y-threshold) then places them tightly with gap spacing.
 * Preserves original centroid so the camera doesn't jump.
 */
export function compactNodes(nodes: SpreadInput[], gap = 20): Map<string, { x: number; y: number }> {
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

  // Sort by row (y, 30px threshold) then column (x)
  const sorted = [...nodes].sort((a, b) => {
    const rowDiff = a.y - b.y;
    if (Math.abs(rowDiff) > 30) return rowDiff;
    return a.x - b.x;
  });

  // Group into rows: nodes whose y-values are within 30px of the row leader
  const rows: SpreadInput[][] = [];
  let currentRow: SpreadInput[] = [sorted[0]];
  let rowY = sorted[0].y;

  for (let i = 1; i < sorted.length; i++) {
    if (Math.abs(sorted[i].y - rowY) <= 30) {
      currentRow.push(sorted[i]);
    } else {
      rows.push(currentRow);
      currentRow = [sorted[i]];
      rowY = sorted[i].y;
    }
  }
  rows.push(currentRow);

  // Place rows top-to-bottom, items left-to-right within each row
  const positions: { id: string; x: number; y: number; w: number; h: number }[] = [];
  let gridY = 0;

  for (const row of rows) {
    let gridX = 0;
    let maxH = 0;
    for (const n of row) {
      positions.push({ id: n.id, x: gridX, y: gridY, w: n.width, h: n.height });
      gridX += n.width + gap;
      maxH = Math.max(maxH, n.height);
    }
    gridY += maxH + gap;
  }

  // Compute new centroid and shift to preserve original
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
