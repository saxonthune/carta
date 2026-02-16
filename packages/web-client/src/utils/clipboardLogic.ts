import type { CartaNode } from '@carta/types';
import { generateSemanticId } from './cartaFile';

/** Compute the bounding box origin (minimum x, y) of a set of nodes */
export function getClipboardBounds(nodes: CartaNode[]): { minX: number; minY: number } {
  return {
    minX: Math.min(...nodes.map(n => n.position.x)),
    minY: Math.min(...nodes.map(n => n.position.y)),
  };
}

/** Calculate paste target position, preferring explicit coordinates with offset fallback */
export function calculatePastePosition(
  explicitX: number | undefined,
  explicitY: number | undefined,
  bounds: { minX: number; minY: number },
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number },
): { x: number; y: number } {
  if (explicitX !== undefined && explicitY !== undefined) {
    return screenToFlowPosition({ x: explicitX, y: explicitY });
  }
  return { x: bounds.minX + 50, y: bounds.minY + 50 };
}

/** Transform clipboard nodes into pasted copies with new IDs and positions */
export function transformPastedNodes(
  clipboardNodes: CartaNode[],
  basePosition: { x: number; y: number },
  bounds: { minX: number; minY: number },
  getNextNodeId: () => string,
): CartaNode[] {
  return clipboardNodes.map((clipNode) => {
    const newId = getNextNodeId();
    const offsetX = clipNode.position.x - bounds.minX;
    const offsetY = clipNode.position.y - bounds.minY;

    const newSemanticId = (clipNode.data.constructType && typeof clipNode.data.constructType === 'string')
      ? generateSemanticId(clipNode.data.constructType)
      : `copy-${newId}`;

    return {
      ...clipNode,
      id: newId,
      position: {
        x: basePosition.x + offsetX,
        y: basePosition.y + offsetY,
      },
      selected: true,
      data: {
        ...clipNode.data,
        label: clipNode.data.label ? `${clipNode.data.label} (copy)` : undefined,
        semanticId: newSemanticId,
      },
    };
  });
}
