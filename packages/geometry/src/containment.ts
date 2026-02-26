export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ComputeBoundsOptions {
  padding?: number;
  minWidth?: number;
  minHeight?: number;
  pinnedSize?: { width: number; height: number } | null;
}

/**
 * Computes the bounding box for a container based on its children's rectangles.
 *
 * @param children - Array of child rectangles
 * @param options - Configuration for padding, minimums, and pinned size
 * @returns Bounding rectangle encompassing all children with padding
 */
export function computeBounds(children: Rect[], options?: ComputeBoundsOptions): Rect {
  const padding = options?.padding ?? 20;
  const minWidth = options?.minWidth ?? 100;
  const minHeight = options?.minHeight ?? 100;
  const pinnedSize = options?.pinnedSize ?? null;

  // If no children, return minimum size at origin
  if (children.length === 0) {
    return {
      x: 0,
      y: 0,
      width: minWidth,
      height: minHeight,
    };
  }

  // Find the axis-aligned bounding box of all children
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const child of children) {
    const childLeft = child.x;
    const childTop = child.y;
    const childRight = child.x + child.width;
    const childBottom = child.y + child.height;

    if (childLeft < minX) minX = childLeft;
    if (childTop < minY) minY = childTop;
    if (childRight > maxX) maxX = childRight;
    if (childBottom > maxY) maxY = childBottom;
  }

  // Apply padding
  const x = minX - padding;
  const y = minY - padding;
  let width = maxX - minX + padding * 2;
  let height = maxY - minY + padding * 2;

  // Apply minimum dimensions
  width = Math.max(width, minWidth);
  height = Math.max(height, minHeight);

  // Apply pinned size (never shrink below pinned dimensions)
  if (pinnedSize) {
    width = Math.max(width, pinnedSize.width);
    height = Math.max(height, pinnedSize.height);
  }

  return { x, y, width, height };
}

/**
 * Simple point-in-rectangle test.
 *
 * @param point - Point to test
 * @param rect - Rectangle to test against
 * @returns True if point is inside rectangle
 */
export function isPointInRect(point: { x: number; y: number }, rect: Rect): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}
