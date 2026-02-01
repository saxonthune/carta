import { useMemo } from 'react';
import { ViewportPortal, useStore } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import type { Deployable } from '@carta/domain';
import { getLodConfig } from './lod/lodPolicy';

interface DeployableBackgroundProps {
  nodes: Node[];
  deployables: Deployable[];
}

interface DeployableBox {
  x: number;
  y: number;
  width: number;
  height: number;
  deployable: Deployable;
}

export default function DeployableBackground({ nodes, deployables }: DeployableBackgroundProps) {
  // Get current zoom level for LOD-aware font sizing
  const zoom = useStore((state) => state.transform[2]);
  const lod = getLodConfig(zoom);

  // Font size based on LOD band
  const fontSize = lod.band === 'pill' ? 32 : lod.band === 'compact' ? 16 : 11;

  // Always calculate using max font size (pill: 32) to ensure box accommodates all zoom levels
  const maxFontSize = 32;

  const boxes = useMemo(() => {
    const result: DeployableBox[] = [];

    deployables.forEach(deployable => {
      const deployableNodes = nodes.filter(node =>
        node.data?.deployableId === deployable.id
      );

      if (deployableNodes.length > 0) {
        // Calculate bounding box by finding outermost edges of all nodes
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;

        deployableNodes.forEach(node => {
          // Use measured dimensions if available, otherwise use generous defaults
          const nodeWidth = node.measured?.width ?? node.width ?? 300;
          const nodeHeight = node.measured?.height ?? node.height ?? 150;

          // Find the leftmost edge
          const nodeLeft = node.position.x;
          // Find the rightmost edge
          const nodeRight = node.position.x + nodeWidth;
          // Find the topmost edge
          const nodeTop = node.position.y;
          // Find the bottommost edge
          const nodeBottom = node.position.y + nodeHeight;

          minX = Math.min(minX, nodeLeft);
          minY = Math.min(minY, nodeTop);
          maxX = Math.max(maxX, nodeRight);
          maxY = Math.max(maxY, nodeBottom);
        });

        // Add 20px padding on all sides
        const padding = 20;
        result.push({
          x: minX - padding,
          y: minY - padding,
          width: maxX - minX + (padding * 2),
          height: maxY - minY + (padding * 2),
          deployable
        });
      }
    });

    return result;
  }, [nodes, deployables]);

  if (boxes.length === 0) {
    return null;
  }

  return (
    <ViewportPortal>
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          overflow: 'visible',
          zIndex: -1 // Render behind nodes
        }}
      >
        {boxes.map(box => {
          const fillColor = box.deployable.color || '#e5e7eb';
          const strokeColor = box.deployable.color || '#9ca3af';
          const textColor = box.deployable.color || '#374151';

          // Calculate label dimensions using max font size to ensure box fits all zoom levels
          // Character width ratio scales with font size: ~0.6 * fontSize
          const charWidthRatio = 0.6;
          const labelPadding = Math.max(12, maxFontSize * 0.4);
          const labelWidth = box.deployable.name.length * (maxFontSize * charWidthRatio) + labelPadding * 2;
          const labelHeight = maxFontSize * 1.5;

          return (
            <g key={box.deployable.id}>
              {/* Background rectangle */}
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill={fillColor}
                fillOpacity={0.15}
                stroke={strokeColor}
                strokeWidth={1}
                strokeDasharray="4 2"
                rx={6}
                ry={6}
              />
              {/* Label background - positioned at bottom-right corner with 0 margin */}
              <rect
                x={box.x + box.width - labelWidth}
                y={box.y + box.height - labelHeight}
                width={labelWidth}
                height={labelHeight}
                fill="rgba(255, 255, 255, 0.9)"
                rx={3}
                ry={3}
              />
              {/* Label text - centered in label background with LOD-aware font size */}
              <text
                x={box.x + box.width - labelWidth / 2}
                y={box.y + box.height - labelHeight / 2}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight={500}
                fill={textColor}
              >
                {box.deployable.name}
              </text>
            </g>
          );
        })}
      </svg>
    </ViewportPortal>
  );
}
