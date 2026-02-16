interface PositionedNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Compute aligned positions for nodes along a specified axis.
 * Returns a Map of nodeId → new position.
 */
export function computeAlignment(
  nodes: PositionedNode[],
  axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom',
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();

  switch (axis) {
    case 'left': {
      const minX = Math.min(...nodes.map(n => n.x));
      for (const n of nodes) result.set(n.id, { x: minX, y: n.y });
      break;
    }
    case 'center': {
      const avgCenterX = nodes.reduce((sum, n) => sum + (n.x + n.width / 2), 0) / nodes.length;
      for (const n of nodes) result.set(n.id, { x: avgCenterX - n.width / 2, y: n.y });
      break;
    }
    case 'right': {
      const maxRight = Math.max(...nodes.map(n => n.x + n.width));
      for (const n of nodes) result.set(n.id, { x: maxRight - n.width, y: n.y });
      break;
    }
    case 'top': {
      const minY = Math.min(...nodes.map(n => n.y));
      for (const n of nodes) result.set(n.id, { x: n.x, y: minY });
      break;
    }
    case 'middle': {
      const avgCenterY = nodes.reduce((sum, n) => sum + (n.y + n.height / 2), 0) / nodes.length;
      for (const n of nodes) result.set(n.id, { x: n.x, y: avgCenterY - n.height / 2 });
      break;
    }
    case 'bottom': {
      const maxBottom = Math.max(...nodes.map(n => n.y + n.height));
      for (const n of nodes) result.set(n.id, { x: n.x, y: maxBottom - n.height });
      break;
    }
  }

  return result;
}

/**
 * Compute evenly distributed positions along a specified axis.
 * First and last nodes stay anchored; intermediate nodes are spaced evenly.
 */
export function computeDistribution(
  nodes: PositionedNode[],
  axis: 'horizontal' | 'vertical',
): Map<string, { x: number; y: number }> {
  const result = new Map<string, { x: number; y: number }>();
  const sorted = [...nodes];

  if (axis === 'horizontal') {
    sorted.sort((a, b) => a.x - b.x);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span = (last.x + last.width) - first.x;
    const totalWidth = sorted.reduce((sum, n) => sum + n.width, 0);
    const gap = (span - totalWidth) / (sorted.length - 1);

    let currentX = first.x;
    for (const n of sorted) {
      result.set(n.id, { x: currentX, y: n.y });
      currentX += n.width + gap;
    }
  } else {
    sorted.sort((a, b) => a.y - b.y);
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const span = (last.y + last.height) - first.y;
    const totalHeight = sorted.reduce((sum, n) => sum + n.height, 0);
    const gap = (span - totalHeight) / (sorted.length - 1);

    let currentY = first.y;
    for (const n of sorted) {
      result.set(n.id, { x: n.x, y: currentY });
      currentY += n.height + gap;
    }
  }

  return result;
}
