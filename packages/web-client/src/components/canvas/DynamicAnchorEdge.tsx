import { getSmoothStepPath, Position, useStore, type EdgeProps } from '@xyflow/react';
import type { BundleData } from '../../hooks/useEdgeBundling';

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
export default function DynamicAnchorEdge({
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
  const strokeWidth = isBundled ? Math.min(1.5 + (count - 1) * 1, 6) : 1.5;

  // Try to get node positions from the store for dynamic routing
  const nodeLookup = useStore((s) => s.nodeLookup);
  const sourceNode = nodeLookup.get(source);
  const targetNode = nodeLookup.get(target);

  let sx = sourceX;
  let sy = sourceY;
  let sp = sourcePosition;
  let tx = targetX;
  let ty = targetY;
  let tp = targetPosition;

  // If we have both nodes, compute dynamic boundary points
  if (sourceNode?.internals?.positionAbsolute && sourceNode?.measured?.width && sourceNode?.measured?.height &&
      targetNode?.internals?.positionAbsolute && targetNode?.measured?.width && targetNode?.measured?.height) {
    const sourceRect = {
      x: sourceNode.internals.positionAbsolute.x,
      y: sourceNode.internals.positionAbsolute.y,
      width: sourceNode.measured.width,
      height: sourceNode.measured.height,
    };
    const targetRect = {
      x: targetNode.internals.positionAbsolute.x,
      y: targetNode.internals.positionAbsolute.y,
      width: targetNode.measured.width,
      height: targetNode.measured.height,
    };

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
        }}
        fill="none"
      />
      {isBundled && (
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
    </>
  );
}
