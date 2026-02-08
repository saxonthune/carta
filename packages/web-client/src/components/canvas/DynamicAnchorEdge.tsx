import { memo, useCallback } from 'react';
import { getSmoothStepPath, Position, useStore, type EdgeProps } from '@xyflow/react';
import type { BundleData } from '../../hooks/useEdgeBundling';

/** Extracted geometry for a node — only the values edges need. */
interface NodeRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function nodeRectEqual(a: NodeRect | null, b: NodeRect | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/**
 * Given a rectangle and a target point, find the intersection of
 * the line from the rect center to the target with the rect boundary.
 * Returns { x, y, position } where position is which edge was hit.
 */
function getRectBoundaryPoint(
  rect: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number }
): { x: number; y: number; position: Position } {
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const dx = target.x - cx;
  const dy = target.y - cy;

  // Avoid division by zero
  if (dx === 0 && dy === 0) {
    return { x: cx, y: rect.y + rect.height, position: Position.Bottom };
  }

  const hw = rect.width / 2;
  const hh = rect.height / 2;

  // Scale factors to reach each edge
  const scaleX = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? hh / Math.abs(dy) : Infinity;

  const scale = Math.min(scaleX, scaleY);
  const ix = cx + dx * scale;
  const iy = cy + dy * scale;

  // Determine which edge
  let position: Position;
  if (scaleX < scaleY) {
    position = dx > 0 ? Position.Right : Position.Left;
  } else {
    position = dy > 0 ? Position.Bottom : Position.Top;
  }

  return { x: ix, y: iy, position };
}

/**
 * Dynamic anchor edge that computes attachment points from node geometry
 * instead of using React Flow's handle-derived coordinates.
 * Supports bundle count badge for parallel edges.
 */
export default memo(function DynamicAnchorEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  data,
}: EdgeProps) {
  const bundleData = data as BundleData | undefined;
  const count = bundleData?.bundleCount || 1;
  const isBundled = count > 1;
  const isAttachment = (data as Record<string, unknown>)?.isAttachmentEdge === true;
  const hopDistance = (data as Record<string, unknown>)?.hopDistance as number | undefined;
  const dimmed = (data as Record<string, unknown>)?.dimmed as boolean | undefined;
  const strokeWidth = isAttachment
    ? ((style as Record<string, unknown>).strokeWidth as number ?? 3)
    : isBundled ? Math.min(1.5 + (count - 1) * 1, 6) : 1.5;

  // Per-node selectors: extract only geometry values with value-based equality
  // so edges don't re-render when unrelated nodes change reference.
  const sourceRect = useStore(
    useCallback((s): NodeRect | null => {
      const n = s.nodeLookup.get(source);
      if (!n?.internals?.positionAbsolute || !n?.measured?.width || !n?.measured?.height) return null;
      return { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, width: n.measured.width, height: n.measured.height };
    }, [source]),
    nodeRectEqual,
  );
  const targetRect = useStore(
    useCallback((s): NodeRect | null => {
      const n = s.nodeLookup.get(target);
      if (!n?.internals?.positionAbsolute || !n?.measured?.width || !n?.measured?.height) return null;
      return { x: n.internals.positionAbsolute.x, y: n.internals.positionAbsolute.y, width: n.measured.width, height: n.measured.height };
    }, [target]),
    nodeRectEqual,
  );

  let sx = sourceX;
  let sy = sourceY;
  let sp = sourcePosition;
  let tx = targetX;
  let ty = targetY;
  let tp = targetPosition;

  // If we have both nodes, compute dynamic boundary points
  if (sourceRect && targetRect) {
    const targetCenter = {
      x: targetRect.x + targetRect.width / 2,
      y: targetRect.y + targetRect.height / 2,
    };
    const sourceCenter = {
      x: sourceRect.x + sourceRect.width / 2,
      y: sourceRect.y + sourceRect.height / 2,
    };

    const sourceBoundary = getRectBoundaryPoint(sourceRect, targetCenter);
    const targetBoundary = getRectBoundaryPoint(targetRect, sourceCenter);

    sx = sourceBoundary.x;
    sy = sourceBoundary.y;
    sp = sourceBoundary.position;
    tx = targetBoundary.x;
    ty = targetBoundary.y;
    tp = targetBoundary.position;
  }

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX: sx,
    sourceY: sy,
    targetX: tx,
    targetY: ty,
    sourcePosition: sp,
    targetPosition: tp,
  });

  const edgeOpacity = dimmed ? 0.15 : 1;
  // Hop badge color: blue near start → green/yellow far
  const hopBadgeColor = hopDistance !== undefined
    ? `hsl(${210 - Math.min(hopDistance * 20, 90)}, 70%, 50%)`
    : undefined;
  const showHopBadge = hopDistance !== undefined && !isBundled;

  return (
    <>
      {/* Invisible wider path for easier click targeting */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="react-flow__edge-interaction"
      />
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          ...style,
          strokeWidth,
          stroke: style.stroke || 'var(--edge-default-color, #94a3b8)',
          opacity: edgeOpacity,
          transition: 'opacity 150ms ease',
        }}
        fill="none"
      />
      {isBundled && !dimmed && (
        <g
          transform={`translate(${labelX}, ${labelY})`}
          style={{ cursor: 'pointer' }}
        >
          <circle r={10} fill="var(--color-surface, white)" stroke={String(style.stroke || 'var(--edge-default-color, #94a3b8)')} strokeWidth={1.5} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={10}
            fontWeight={600}
            fill="var(--color-content-muted, #6b7280)"
            style={{ pointerEvents: 'none' }}
          >
            {count}
          </text>
        </g>
      )}
      {showHopBadge && (
        <g
          transform={`translate(${labelX}, ${labelY})`}
          style={{ pointerEvents: 'none' }}
        >
          <circle r={12} fill={hopBadgeColor} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={11}
            fontWeight={700}
            fill="white"
            style={{ pointerEvents: 'none' }}
          >
            {hopDistance}
          </text>
        </g>
      )}
    </>
  );
});
