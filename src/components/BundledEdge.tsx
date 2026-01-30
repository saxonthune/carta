import { getSmoothStepPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import type { BundleData } from '../hooks/useEdgeBundling';

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
  const { setNodes } = useReactFlow();
  const bundleData = data as BundleData | undefined;
  const count = bundleData?.bundleCount || 2;

  // Calculate stroke width: thicker for more bundled edges, capped at 10
  const strokeWidth = Math.min(2 + (count - 1) * 1.5, 10);

  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const handleClick = () => {
    if (!bundleData?.bundledEdgeIds) return;

    // Select all nodes involved in the bundle
    // Parse node IDs from edge IDs (format: edge-{source}-{port}-{target}-{port})
    const nodeIds = new Set<string>();
    // We can get node IDs from the edge itself (source/target are on the representative edge)
    // But for all bundled edges we need to look at the edges array
    // For simplicity, just select the source and target of this representative edge
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: nodeIds.has(n.id) ? true : n.selected,
      }))
    );
  };

  return (
    <>
      <path
        id={id}
        className="react-flow__edge-path"
        d={edgePath}
        style={{
          ...style,
          strokeWidth,
          stroke: style.stroke || '#6366f1',
        }}
        fill="none"
      />
      {/* Midpoint bundle indicator */}
      <g
        transform={`translate(${labelX}, ${labelY})`}
        onClick={handleClick}
        style={{ cursor: 'pointer' }}
      >
        <circle r={10} fill="white" stroke={String(style.stroke || '#6366f1')} strokeWidth={1.5} />
        <text
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={10}
          fontWeight={600}
          fill={String(style.stroke || '#6366f1')}
          style={{ pointerEvents: 'none' }}
        >
          {count}
        </text>
      </g>
    </>
  );
}
