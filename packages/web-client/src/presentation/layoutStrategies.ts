/**
 * Pure layout strategy functions for organizer member positioning.
 * No React dependencies — testable with plain data.
 */

import type { NodeGeometry } from '@carta/schema';

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
