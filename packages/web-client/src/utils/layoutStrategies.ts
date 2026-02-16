import type { SpreadInput } from './spreadNodes.js';

/**
 * Compute grid positions for items within an organizer.
 * Returns a Map of itemId → position within the organizer content area.
 */
export function computeGridPositions(
  items: SpreadInput[],
  cols: number,
  contentTopY: number,
  padding: number,
): Map<string, { x: number; y: number }> {
  const colWidth = Math.max(...items.map(n => n.width)) + 30;
  const rowHeight = Math.max(...items.map(n => n.height)) + 30;

  const positions = new Map<string, { x: number; y: number }>();
  items.forEach((child, idx) => {
    const x = (idx % cols) * colWidth + padding;
    const y = Math.floor(idx / cols) * rowHeight + contentTopY;
    positions.set(child.id, { x, y });
  });
  return positions;
}

/**
 * Transform top-to-bottom hierarchical positions into the specified direction.
 * Takes TB positions from hierarchicalLayout and rotates/mirrors for LR/RL/BT.
 */
export function transformDirectionalPositions(
  tbPositions: Map<string, { x: number; y: number }>,
  direction: 'LR' | 'RL' | 'TB' | 'BT',
  itemDimensions: Map<string, { width: number; height: number }>,
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();

  if (direction === 'TB') {
    for (const [id, pos] of tbPositions) result.set(id, pos);
  } else if (direction === 'BT') {
    const positions = [...tbPositions.values()];
    const maxY = Math.max(...positions.map(p => p.y));
    for (const [id, pos] of tbPositions) {
      const dims = itemDimensions.get(id);
      const height = dims?.height ?? 0;
      result.set(id, { x: pos.x, y: maxY - pos.y - height });
    }
  } else if (direction === 'LR') {
    for (const [id, pos] of tbPositions) {
      result.set(id, { x: pos.y, y: pos.x });
    }
  } else if (direction === 'RL') {
    const positions = [...tbPositions.values()];
    const maxY = Math.max(...positions.map(p => p.y));
    for (const [id, pos] of tbPositions) {
      const dims = itemDimensions.get(id);
      const height = dims?.height ?? 0;
      result.set(id, { x: maxY - pos.y - height, y: pos.x });
    }
  }

  return result;
}

/**
 * Compute wagon snap positions for all wagons attached to constructs within an organizer.
 * Wagons are positioned to the right of their parent construct with a gap.
 */
export function computeWagonSnapPositions(
  children: Array<{ id: string; type?: string; parentId?: string; data: Record<string, unknown> }>,
  allNodes: Array<{ id: string; type?: string; parentId?: string; data: Record<string, unknown> }>,
  getConstructWidth: (node: { id: string; type?: string }) => number,
  gap: number,
): Array<{ id: string; position: { x: number; y: number } }> {
  const patches: Array<{ id: string; position: { x: number; y: number } }> = [];

  for (const child of children) {
    if (child.type === 'organizer') continue;
    const wagons = allNodes.filter(n =>
      n.type === 'organizer' && n.parentId === child.id
    );
    for (const wagon of wagons) {
      if (!(wagon.data as any).attachedToSemanticId) continue;
      const constructWidth = getConstructWidth(child);
      patches.push({ id: wagon.id, position: { x: constructWidth + gap, y: 0 } });
    }
  }

  return patches;
}

/**
 * Normalize layout positions so the minimum position starts at (padding, contentTopY).
 * Used after hierarchical/flow layout to position content within organizer bounds.
 */
export function normalizePositionsToContentArea(
  positions: Map<string, { x: number; y: number }>,
  contentTopY: number,
  padding: number,
): Map<string, { x: number; y: number }> {
  const allPos = [...positions.values()];
  if (allPos.length === 0) return positions;

  const minX = Math.min(...allPos.map(p => p.x));
  const minY = Math.min(...allPos.map(p => p.y));

  const result = new Map<string, { x: number; y: number }>();
  for (const [id, pos] of positions) {
    result.set(id, {
      x: pos.x - minX + padding,
      y: pos.y - minY + contentTopY,
    });
  }
  return result;
}
