/**
 * Pure layout strategy functions for organizer member positioning.
 * No React dependencies — testable with plain data.
 */

import type { NodeGeometry } from '@carta/domain';

export interface LayoutResult {
  /** Computed positions for members (keyed by member index) */
  positions: Map<number, { x: number; y: number }>;
  /** Set of member indices that should be visible */
  visibleIndices: Set<number>;
  /** Suggested organizer size, if layout wants to override */
  organizerSize?: { width: number; height: number };
}

/**
 * Freeform layout: members keep their own positions, all visible.
 * This is the default behavior (no-op).
 */
export function freeformLayout(members: NodeGeometry[]): LayoutResult {
  const visibleIndices = new Set<number>();
  for (let i = 0; i < members.length; i++) {
    visibleIndices.add(i);
  }
  return {
    positions: new Map(),
    visibleIndices,
  };
}

/**
 * Stack layout: only one member visible at a time.
 * All members are positioned at the same coordinates;
 * only the active one is shown.
 */
export function stackLayout(members: NodeGeometry[], activeIndex: number): LayoutResult {
  const positions = new Map<number, { x: number; y: number }>();
  const clampedIndex = Math.max(0, Math.min(activeIndex, members.length - 1));
  const visibleIndices = new Set<number>();

  if (members.length > 0) {
    visibleIndices.add(clampedIndex);

    // Position all members at the same spot (top-left of content area)
    const baseX = 20; // padding
    const baseY = 60; // padding + header
    for (let i = 0; i < members.length; i++) {
      positions.set(i, { x: baseX, y: baseY });
    }
  }

  return { positions, visibleIndices };
}

/**
 * Grid layout: members auto-positioned in a grid.
 * All members are visible, positioned in row-major order.
 */
export function gridLayout(members: NodeGeometry[], columns: number): LayoutResult {
  const positions = new Map<number, { x: number; y: number }>();
  const visibleIndices = new Set<number>();
  const cols = Math.max(1, columns);

  const padding = 20;
  const headerHeight = 40;
  const gap = 16;
  // Use measured/explicit dimensions or defaults
  const cellWidth = 220;
  const cellHeight = 120;

  let maxX = 0;
  let maxY = 0;

  for (let i = 0; i < members.length; i++) {
    visibleIndices.add(i);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padding + col * (cellWidth + gap);
    const y = padding + headerHeight + row * (cellHeight + gap);
    positions.set(i, { x, y });
    maxX = Math.max(maxX, x + cellWidth);
    maxY = Math.max(maxY, y + cellHeight);
  }

  return {
    positions,
    visibleIndices,
    organizerSize: members.length > 0
      ? { width: maxX + padding, height: maxY + padding }
      : undefined,
  };
}
