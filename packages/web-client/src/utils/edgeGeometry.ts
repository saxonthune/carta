/**
 * Edge geometry utilities for MapV2 edge rendering.
 * Extracted from DynamicAnchorEdge.tsx as pure functions.
 */

export type EdgeSide = 'top' | 'bottom' | 'left' | 'right';

export interface Waypoint {
  x: number;
  y: number;
}

/**
 * Given a rectangle and a target point, find the intersection of
 * the line from the rect center to the target with the rect boundary.
 * Returns { x, y, side } where side is which edge was hit.
 */
export function getRectBoundaryPoint(
  rect: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number }
): { x: number; y: number; side: EdgeSide } {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  // Avoid division by zero
  if (dx === 0 && dy === 0) {
    return { x: cx, y: rect.y + rect.height, side: 'bottom' };
  }

  const hw = rect.width / 2;
  const hh = rect.height / 2;

  // Scale factors to reach each edge
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;

  const scale = Math.min(scaleX, scaleY);
  const ix = cx + dx * scale;
  const iy = cy + dy * scale;

  // Determine which edge
  let side: EdgeSide;
  if (scaleX < scaleY) {
    side = dx > 0 ? 'right' : 'left';
  } else {
    side = dy > 0 ? 'bottom' : 'top';
  }

  return { x: ix, y: iy, side };
}

/**
 * Build an SVG path from waypoints with rounded corners.
 */
export function waypointsToPath(waypoints: Waypoint[]): string {
  if (waypoints.length < 2) return '';
  if (waypoints.length === 2) {
    // Straight line, no corners to round
    return `M ${waypoints[0].x} ${waypoints[0].y} L ${waypoints[1].x} ${waypoints[1].y}`;
  }

  let path = `M ${waypoints[0].x} ${waypoints[0].y}`;

  // Process each waypoint from index 1 to n-2 (intermediate bend points)
  for (let i = 1; i < waypoints.length - 1; i++) {
    const prev = waypoints[i - 1];
    const curr = waypoints[i];
    const next = waypoints[i + 1];

    // Calculate segment lengths
    const prevSegmentLength = Math.sqrt(
      Math.pow(curr.x - prev.x, 2) + Math.pow(curr.y - prev.y, 2)
    );
    const nextSegmentLength = Math.sqrt(
      Math.pow(next.x - curr.x, 2) + Math.pow(next.y - curr.y, 2)
    );

    // Compute corner radius: 6px, but clamped to half the shorter segment
    const maxRadius = Math.min(prevSegmentLength / 2, nextSegmentLength / 2);
    const radius = Math.min(6, maxRadius);

    if (radius > 0) {
      // Direction vectors (normalized to unit length)
      const prevDx = (curr.x - prev.x) / prevSegmentLength;
      const prevDy = (curr.y - prev.y) / prevSegmentLength;
      const nextDx = (next.x - curr.x) / nextSegmentLength;
      const nextDy = (next.y - curr.y) / nextSegmentLength;

      // Approach point: radius pixels before the bend
      const approachX = curr.x - prevDx * radius;
      const approachY = curr.y - prevDy * radius;

      // Departure point: radius pixels after the bend
      const departureX = curr.x + nextDx * radius;
      const departureY = curr.y + nextDy * radius;

      // Draw line to approach point, then quadratic bezier curve to departure point
      path += ` L ${approachX} ${approachY} Q ${curr.x} ${curr.y} ${departureX} ${departureY}`;
    } else {
      // Radius too small, just use sharp corner
      path += ` L ${curr.x} ${curr.y}`;
    }
  }

  // Final segment to last waypoint
  const last = waypoints[waypoints.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
}

/**
 * Compute control point for cubic bezier based on edge side and offset.
 */
function controlPoint(x: number, y: number, side: EdgeSide, offset: number): [number, number] {
  switch (side) {
    case 'top': return [x, y - offset];
    case 'bottom': return [x, y + offset];
    case 'left': return [x - offset, y];
    case 'right': return [x + offset, y];
  }
}

/**
 * Compute a cubic bezier path for edge rendering.
 * Given source/target points and which side they exit from, produce an SVG path string.
 */
export function computeBezierPath(
  sx: number, sy: number, sSide: EdgeSide,
  tx: number, ty: number, tSide: EdgeSide,
): { path: string; labelX: number; labelY: number } {
  // Control point offset: proportional to distance, min 30px
  const dist = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
  const offset = Math.max(30, dist * 0.25);

  // Control points extend outward from the boundary side
  const [scx, scy] = controlPoint(sx, sy, sSide, offset);
  const [tcx, tcy] = controlPoint(tx, ty, tSide, offset);

  const path = `M ${sx} ${sy} C ${scx} ${scy}, ${tcx} ${tcy}, ${tx} ${ty}`;
  const labelX = (sx + tx) / 2;
  const labelY = (sy + ty) / 2;
  return { path, labelX, labelY };
}
