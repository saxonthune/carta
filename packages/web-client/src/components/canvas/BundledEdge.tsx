import { getSmoothStepPath, type EdgeProps } from '@xyflow/react';
import type { BundleData } from '../../hooks/useEdgeBundling';

export default function BundledEdge({
  id,
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

  // Calculate stroke width: thicker for more bundled edges, capped at 6
  const strokeWidth = isBundled ? Math.min(1.5 + (count - 1) * 1, 6) : 1.5;

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  return (
    <>
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
      {/* Midpoint bundle indicator - only for bundled edges */}
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
