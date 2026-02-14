import type { SpreadInput } from './spreadNodes';

/**
 * Removes overlaps between nodes by pushing them apart along the axis of least overlap.
 * Preserves original positions for non-overlapping nodes and maintains centroid.
 */
export function deOverlapNodes(
  nodes: SpreadInput[],
  padding = 20
): Map<string, { x: number; y: number }> {
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

  // Copy node positions into mutable array
  const positions = nodes.map(n => ({
    id: n.id,
    x: n.x,
    y: n.y,
    width: n.width,
    height: n.height
  }));

  // Handle degenerate case: if any two nodes have identical center positions,
  // add small random jitter to break symmetry
  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const centerXi = positions[i].x + positions[i].width / 2;
      const centerYi = positions[i].y + positions[i].height / 2;
      const centerXj = positions[j].x + positions[j].width / 2;
      const centerYj = positions[j].y + positions[j].height / 2;

      if (centerXi === centerXj && centerYi === centerYj) {
        positions[i].x += (Math.random() - 0.5) * 6;
        positions[i].y += (Math.random() - 0.5) * 6;
        positions[j].x += (Math.random() - 0.5) * 6;
        positions[j].y += (Math.random() - 0.5) * 6;
      }
    }
  }

  // Iterate up to 50 times to resolve overlaps
  for (let iteration = 0; iteration < 50; iteration++) {
    let moved = false;

    for (let i = 0; i < positions.length; i++) {
      for (let j = i + 1; j < positions.length; j++) {
        const a = positions[i];
        const b = positions[j];

        const centerXa = a.x + a.width / 2;
        const centerYa = a.y + a.height / 2;
        const centerXb = b.x + b.width / 2;
        const centerYb = b.y + b.height / 2;

        // Compute overlap on X axis
        const overlapX = (a.width + b.width) / 2 + padding - Math.abs(centerXa - centerXb);
        // Compute overlap on Y axis
        const overlapY = (a.height + b.height) / 2 + padding - Math.abs(centerYa - centerYb);

        // If they overlap
        if (overlapX > 0 && overlapY > 0) {
          let dx = centerXa - centerXb;
          let dy = centerYa - centerYb;

          // Fallback direction if centers are identical (shouldn't happen after jitter)
          if (dx === 0 && dy === 0) {
            dx = 1;
            dy = 1;
          }

          const sign = (v: number) => v >= 0 ? 1 : -1;

          // Push apart on the axis of least overlap
          if (overlapX < overlapY) {
            // Push apart on X
            const shift = overlapX / 2;
            a.x += shift * sign(dx);
            b.x -= shift * sign(dx);
          } else {
            // Push apart on Y
            const shift = overlapY / 2;
            a.y += shift * sign(dy);
            b.y -= shift * sign(dy);
          }

          moved = true;
        }
      }
    }

    // If nothing moved, we've converged
    if (!moved) break;
  }

  // Compute new centroid
  let ncx = 0, ncy = 0;
  for (const p of positions) {
    ncx += p.x + p.width / 2;
    ncy += p.y + p.height / 2;
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
