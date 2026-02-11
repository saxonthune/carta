import type { Node } from '@xyflow/react';

/**
 * Default dimensions for different node types.
 */
const DEFAULT_DIMENSIONS = {
  organizer: { width: 400, height: 300 },
  construct: { width: 200, height: 100 },
};

/**
 * Canonical function for getting node dimensions.
 *
 * Encodes the fallback chain for all node types:
 * 1. style (if manually resized via NodeResizer)
 * 2. measured (computed by React Flow after render)
 * 3. explicit width/height (if set)
 * 4. type-based default
 *
 * This ensures consistent dimension reads across layout, resize persistence,
 * and fitToChildren operations.
 */
export function getNodeDimensions(node: Node): { width: number; height: number } {
  const defaults = node.type === 'organizer'
    ? DEFAULT_DIMENSIONS.organizer
    : DEFAULT_DIMENSIONS.construct;

  return {
    width: (node.style?.width as number) ?? node.measured?.width ?? node.width ?? defaults.width,
    height: (node.style?.height as number) ?? node.measured?.height ?? node.height ?? defaults.height,
  };
}
