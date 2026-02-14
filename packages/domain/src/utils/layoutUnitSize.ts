/**
 * Layout unit size computation
 *
 * Computes the bounding box of a "layout unit" (construct + its wagon tree).
 * Layout algorithms position layout units using their unified bounding box.
 */

export interface LayoutItem {
  id: string;
  semanticId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface WagonInfo {
  id: string;
  parentId: string;  // node ID of the construct (or another wagon)
  x: number;         // relative to parent
  y: number;         // relative to parent
  width: number;
  height: number;
}

/**
 * Full bounding box for a layout unit including negative offsets (wagons above/left of construct).
 */
export interface LayoutUnitBounds {
  /** Offset from construct top-left to bounding box top-left (typically <= 0) */
  offsetX: number;
  offsetY: number;
  /** Total bounding box size */
  width: number;
  height: number;
}

/**
 * Given top-level constructs and their attached wagons,
 * compute the full bounding box of each layout unit (construct + wagon tree),
 * including negative offsets for wagons positioned above/left of the construct.
 * Returns a Map<constructId, LayoutUnitBounds>.
 *
 * Algorithm:
 * 1. Build a map of parentId → child wagons
 * 2. For each construct, recursively walk its wagon tree
 * 3. Each wagon's absolute offset = sum of relative positions up the chain
 * 4. Track minLeft/minTop and maxRight/maxBottom
 * 5. The layout unit's bounds = full bounding box with offset from construct's top-left
 */
export function computeLayoutUnitBounds(
  constructs: LayoutItem[],
  wagons: WagonInfo[],
): Map<string, LayoutUnitBounds> {
  const result = new Map<string, LayoutUnitBounds>();

  // Build a map of parentId → child wagons for fast lookup
  const wagonsByParent = new Map<string, WagonInfo[]>();
  for (const wagon of wagons) {
    const siblings = wagonsByParent.get(wagon.parentId) || [];
    siblings.push(wagon);
    wagonsByParent.set(wagon.parentId, siblings);
  }

  // For each construct, compute its layout unit bounding box
  for (const construct of constructs) {
    let minLeft = 0;
    let minTop = 0;
    let maxRight = construct.width;
    let maxBottom = construct.height;

    // Recursively walk the wagon tree
    function walkWagons(parentId: string, offsetX: number, offsetY: number): void {
      const children = wagonsByParent.get(parentId) || [];
      for (const wagon of children) {
        // Wagon position is relative to parent, so compute absolute position
        const absoluteX = offsetX + wagon.x;
        const absoluteY = offsetY + wagon.y;

        // Update bounding box
        minLeft = Math.min(minLeft, absoluteX);
        minTop = Math.min(minTop, absoluteY);
        maxRight = Math.max(maxRight, absoluteX + wagon.width);
        maxBottom = Math.max(maxBottom, absoluteY + wagon.height);

        // Recurse for nested wagons
        walkWagons(wagon.id, absoluteX, absoluteY);
      }
    }

    // Start walking from the construct (offset 0,0)
    walkWagons(construct.id, 0, 0);

    result.set(construct.id, {
      offsetX: minLeft,
      offsetY: minTop,
      width: maxRight - minLeft,
      height: maxBottom - minTop,
    });
  }

  return result;
}

/**
 * Given top-level constructs and their attached wagons,
 * compute the bounding box of each layout unit (construct + wagon tree).
 * Returns a Map<constructId, { width, height }>.
 * Position (x,y) stays the same — we only expand width/height.
 *
 * Algorithm:
 * 1. Build a map of parentId → child wagons
 * 2. For each construct, recursively walk its wagon tree
 * 3. Each wagon's absolute offset = sum of relative positions up the chain
 * 4. Union all rects: construct rect + all wagon rects (using absolute offsets)
 * 5. The layout unit's size = bounding box encompassing all rects, anchored at the construct's top-left
 */
export function computeLayoutUnitSizes(
  constructs: LayoutItem[],
  wagons: WagonInfo[],
): Map<string, { width: number; height: number }> {
  const result = new Map<string, { width: number; height: number }>();

  // Build a map of parentId → child wagons for fast lookup
  const wagonsByParent = new Map<string, WagonInfo[]>();
  for (const wagon of wagons) {
    const siblings = wagonsByParent.get(wagon.parentId) || [];
    siblings.push(wagon);
    wagonsByParent.set(wagon.parentId, siblings);
  }

  // For each construct, compute its layout unit bounding box
  for (const construct of constructs) {
    let maxRight = construct.width;
    let maxBottom = construct.height;

    // Recursively walk the wagon tree
    function walkWagons(parentId: string, offsetX: number, offsetY: number): void {
      const children = wagonsByParent.get(parentId) || [];
      for (const wagon of children) {
        // Wagon position is relative to parent, so compute absolute position
        const absoluteX = offsetX + wagon.x;
        const absoluteY = offsetY + wagon.y;

        // Update bounding box
        maxRight = Math.max(maxRight, absoluteX + wagon.width);
        maxBottom = Math.max(maxBottom, absoluteY + wagon.height);

        // Recurse for nested wagons
        walkWagons(wagon.id, absoluteX, absoluteY);
      }
    }

    // Start walking from the construct (offset 0,0)
    walkWagons(construct.id, 0, 0);

    result.set(construct.id, { width: maxRight, height: maxBottom });
  }

  return result;
}
