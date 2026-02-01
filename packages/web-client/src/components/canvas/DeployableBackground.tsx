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
        const padding = 14;
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
          const fillColor = box.deployable.color || 'var(--color-content-subtle)';
          const strokeColor = box.deployable.color || 'var(--color-content-subtle)';

          // Label opacity based on LOD band
          const labelOpacity = lod.band === 'pill' ? 0 : lod.band === 'compact' ? 0.4 : 0.7;

          return (
            <g key={box.deployable.id}>
              {/* Background rectangle */}
              <rect
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill={fillColor}
                fillOpacity={0.04}
                stroke={strokeColor}
                strokeWidth={1}
                strokeOpacity={0.12}
                rx={4}
                ry={4}
              />
              {/* Label text - positioned at bottom-right with LOD-aware opacity */}
              {labelOpacity > 0 && (
                <text
                  x={box.x + box.width - 8}
                  y={box.y + box.height - 6}
                  textAnchor="end"
                  dominantBaseline="auto"
                  fontSize={fontSize}
                  fontWeight={500}
                  fill="var(--color-content-muted)"
                  fillOpacity={labelOpacity}
                >
                  {box.deployable.name}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </ViewportPortal>
  );
}
