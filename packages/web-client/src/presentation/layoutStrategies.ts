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

  const padding = 20;
  const headerHeight = 40;

  if (members.length > 0) {
    visibleIndices.add(clampedIndex);

    // Position all members at the same spot (top-left of content area)
    const baseX = padding;
    const baseY = padding + headerHeight;
    for (let i = 0; i < members.length; i++) {
      positions.set(i, { x: baseX, y: baseY });
    }
  }

  // Size to fit the active member
  const active = members[clampedIndex];
  const activeW = active?.measured?.width ?? active?.width ?? 220;
  const activeH = active?.measured?.height ?? active?.height ?? 120;

  return {
    positions,
    visibleIndices,
    organizerSize: members.length > 0
      ? { width: activeW + padding * 2, height: activeH + padding * 2 + headerHeight }
      : undefined,
  };
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
  const defaultCellWidth = 220;
  const defaultCellHeight = 120;

  // Resolve each member's actual dimensions
  const widths = members.map(m => m.measured?.width ?? m.width ?? defaultCellWidth);
  const heights = members.map(m => m.measured?.height ?? m.height ?? defaultCellHeight);

  // Compute max width per column and max height per row
  const colWidths = new Array(cols).fill(defaultCellWidth);
  const numRows = Math.ceil(members.length / cols);
  const rowHeights = new Array(numRows).fill(defaultCellHeight);

  for (let i = 0; i < members.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    colWidths[col] = Math.max(colWidths[col], widths[i]);
    rowHeights[row] = Math.max(rowHeights[row], heights[i]);
  }

  // Compute cumulative offsets per column/row
  const colOffsets = [padding];
  for (let c = 1; c < cols; c++) {
    colOffsets[c] = colOffsets[c - 1] + colWidths[c - 1] + gap;
  }
  const rowOffsets = [padding + headerHeight];
  for (let r = 1; r < numRows; r++) {
    rowOffsets[r] = rowOffsets[r - 1] + rowHeights[r - 1] + gap;
  }

  let maxX = 0;
  let maxY = 0;

  for (let i = 0; i < members.length; i++) {
    visibleIndices.add(i);
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = colOffsets[col];
    const y = rowOffsets[row];
    positions.set(i, { x, y });
    maxX = Math.max(maxX, x + colWidths[col]);
    maxY = Math.max(maxY, y + rowHeights[row]);
  }

  return {
    positions,
    visibleIndices,
    organizerSize: members.length > 0
      ? { width: maxX + padding, height: maxY + padding }
      : undefined,
  };
}
