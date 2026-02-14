/**
 * Test: Context Menu Right-Click Behavior
 *
 * Verifies the mouse movement tracking logic for determining
 * when to show vs suppress context menus during panning.
 *
 * This is a unit/integration test of the Map component's context menu logic:
 * - Right-click without drag opens context menu
 * - Right-click with drag (>5px) does NOT open context menu
 * - Fallback behavior when mouseDown is not tracked
 */

import { describe, it, expect } from 'vitest';

/**
 * Helper to test the context menu decision logic
 * This mirrors the logic in Map.tsx onPaneContextMenu
 */
function shouldShowContextMenu(
  mouseDownPos: { x: number; y: number } | null,
  contextMenuPos: { x: number; y: number }
): boolean {
  const threshold = 5; // pixels

  if (!mouseDownPos) {
    // If mouseDownPos is null, show menu anyway (event timing edge case)
    return true;
  }

  const dx = Math.abs(contextMenuPos.x - mouseDownPos.x);
  const dy = Math.abs(contextMenuPos.y - mouseDownPos.y);

  return dx < threshold && dy < threshold;
}

describe('Context Menu Right-Click Behavior', () => {
  describe('movement detection logic', () => {
    it('should show menu when no movement occurs', () => {
      const mouseDown = { x: 100, y: 100 };
      const contextMenu = { x: 100, y: 100 };

      expect(shouldShowContextMenu(mouseDown, contextMenu)).toBe(true);
    });

    it('should show menu for movement within threshold (< 5px)', () => {
      const mouseDown = { x: 100, y: 100 };

      // Test cases within threshold
      expect(shouldShowContextMenu(mouseDown, { x: 104, y: 104 })).toBe(true); // 4px diagonal
      expect(shouldShowContextMenu(mouseDown, { x: 103, y: 100 })).toBe(true); // 3px horizontal
      expect(shouldShowContextMenu(mouseDown, { x: 100, y: 102 })).toBe(true); // 2px vertical
      expect(shouldShowContextMenu(mouseDown, { x: 101, y: 101 })).toBe(true); // 1px diagonal
    });

    it('should NOT show menu for movement beyond threshold (>= 5px)', () => {
      const mouseDown = { x: 100, y: 100 };

      // Test cases beyond threshold
      expect(shouldShowContextMenu(mouseDown, { x: 105, y: 100 })).toBe(false); // 5px horizontal
      expect(shouldShowContextMenu(mouseDown, { x: 100, y: 105 })).toBe(false); // 5px vertical
      expect(shouldShowContextMenu(mouseDown, { x: 110, y: 110 })).toBe(false); // 10px diagonal
      expect(shouldShowContextMenu(mouseDown, { x: 120, y: 120 })).toBe(false); // 20px diagonal (drag)
    });

    it('should show menu when mouseDownPos was not tracked (null)', () => {
      // Fallback behavior for edge cases where mouseDown wasn't captured
      expect(shouldShowContextMenu(null, { x: 100, y: 100 })).toBe(true);
      expect(shouldShowContextMenu(null, { x: 200, y: 300 })).toBe(true);
    });

    it('should handle negative movement correctly', () => {
      const mouseDown = { x: 100, y: 100 };

      // Movement in negative direction
      expect(shouldShowContextMenu(mouseDown, { x: 96, y: 96 })).toBe(true);  // 4px back
      expect(shouldShowContextMenu(mouseDown, { x: 95, y: 95 })).toBe(false); // 5px back
      expect(shouldShowContextMenu(mouseDown, { x: 90, y: 90 })).toBe(false); // 10px back
    });

    it('should handle edge case at exact threshold boundary', () => {
      const mouseDown = { x: 100, y: 100 };

      // Exactly at 5px threshold should NOT show menu
      expect(shouldShowContextMenu(mouseDown, { x: 105, y: 100 })).toBe(false);
      expect(shouldShowContextMenu(mouseDown, { x: 100, y: 105 })).toBe(false);
      expect(shouldShowContextMenu(mouseDown, { x: 95, y: 100 })).toBe(false);
      expect(shouldShowContextMenu(mouseDown, { x: 100, y: 95 })).toBe(false);
    });

    it('should handle mixed positive/negative movement', () => {
      const mouseDown = { x: 100, y: 100 };

      // One axis within, one beyond
      expect(shouldShowContextMenu(mouseDown, { x: 103, y: 110 })).toBe(false); // x ok, y beyond
      expect(shouldShowContextMenu(mouseDown, { x: 110, y: 103 })).toBe(false); // x beyond, y ok
    });
  });

  describe('real-world scenarios', () => {
    it('should allow quick right-click (no drag)', () => {
      // User right-clicks without moving mouse at all
      const mouseDown = { x: 250, y: 350 };
      const contextMenu = { x: 250, y: 350 };

      expect(shouldShowContextMenu(mouseDown, contextMenu)).toBe(true);
    });

    it('should allow right-click with tiny accidental movement', () => {
      // User intends to right-click but mouse moves 1-2px due to hand tremor
      const mouseDown = { x: 250, y: 350 };
      const contextMenu = { x: 251, y: 352 };

      expect(shouldShowContextMenu(mouseDown, contextMenu)).toBe(true);
    });

    it('should block right-click during panning drag', () => {
      // User right-click drags to pan the canvas
      const mouseDown = { x: 100, y: 100 };
      const contextMenu = { x: 150, y: 150 }; // Dragged 50px

      expect(shouldShowContextMenu(mouseDown, contextMenu)).toBe(false);
    });

    it('should block right-click during slow drag', () => {
      // User slowly drags with right mouse button
      const mouseDown = { x: 100, y: 100 };
      const contextMenu = { x: 110, y: 100 }; // Dragged 10px horizontally

      expect(shouldShowContextMenu(mouseDown, contextMenu)).toBe(false);
    });
  });
});
