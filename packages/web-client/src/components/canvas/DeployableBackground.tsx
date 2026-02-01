import { useMemo, useState, useEffect } from 'react';
import { ViewportPortal, useStore } from '@xyflow/react';
import type { Node } from '@xyflow/react';
import type { Deployable } from '@carta/domain';
import { getLodConfig } from './lod/lodPolicy';

interface DeployableBackgroundProps {
  nodes: Node[];
  deployables: Deployable[];
  onSelectDeployable?: (deployableId: string) => void;
  onMoveDeployableNodes?: (deployableId: string, deltaX: number, deltaY: number) => void;
}

interface DeployableBox {
  x: number;
  y: number;
  width: number;
  height: number;
  deployable: Deployable;
}

export default function DeployableBackground({ nodes, deployables, onSelectDeployable, onMoveDeployableNodes }: DeployableBackgroundProps) {
  // Get current zoom level for LOD-aware font sizing
  const zoom = useStore((state) => state.transform[2]);
  const lod = getLodConfig(zoom);

  // Font size based on LOD band
  const fontSize = lod.band === 'pill' ? 32 : 16;

  // Read CSS vars for opacity
  const [fillOpacity, setFillOpacity] = useState(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--deployable-fill-opacity').trim() || '0.06')
  );
  const [strokeOpacity, setStrokeOpacity] = useState(() =>
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--deployable-stroke-opacity').trim() || '0.12')
  );

  useEffect(() => {
    const updateOpacities = () => {
      setFillOpacity(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--deployable-fill-opacity').trim() || '0.06'));
      setStrokeOpacity(parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--deployable-stroke-opacity').trim() || '0.12'));
    };
    const observer = new MutationObserver(updateOpacities);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  // Drag tracking state
  const [dragState, setDragState] = useState<{ deployableId: string; startX: number; startY: number } | null>(null);

  // Handle mouse down on deployable label
  const handleMouseDown = (deployableId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDragState({ deployableId, startX: e.clientX, startY: e.clientY });
  };

  // Handle mouse up - complete drag or click
  useEffect(() => {
    if (!dragState) return;

    const handleMouseUp = (e: MouseEvent) => {
      if (!dragState) return;
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      if (distance < 5) {
        // Click: select deployable
        onSelectDeployable?.(dragState.deployableId);
      } else {
        // Drag: move deployable nodes
        onMoveDeployableNodes?.(dragState.deployableId, deltaX / zoom, deltaY / zoom);
      }
      setDragState(null);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragState) return;
      e.preventDefault();
    };

    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [dragState, zoom, onSelectDeployable, onMoveDeployableNodes]);

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

        // Add padding: standard padding on top/left/right, extra on bottom for label
        const padding = 14;
        const bottomPadding = 40; // Extra space for label text
        result.push({
          x: minX - padding,
          y: minY - padding,
          width: maxX - minX + (padding * 2),
          height: maxY - minY + padding + bottomPadding,
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
    <>
      {/* Background rectangles - render behind nodes */}
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
            zIndex: -1
          }}
        >
          {boxes.map(box => {
            const fillColor = box.deployable.color || 'var(--color-content-subtle)';
            const strokeColor = box.deployable.color || 'var(--color-content-subtle)';

            return (
              <rect
                key={box.deployable.id}
                x={box.x}
                y={box.y}
                width={box.width}
                height={box.height}
                fill={fillColor}
                fillOpacity={fillOpacity}
                stroke={strokeColor}
                strokeWidth={1}
                strokeOpacity={strokeOpacity}
                rx={4}
                ry={4}
              />
            );
          })}
        </svg>
      </ViewportPortal>

      {/* Labels - render on top for visibility and interaction */}
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
            zIndex: 1000
          }}
        >
          {boxes.map(box => {
            // Estimate text width for background (rough approximation)
            const textWidth = box.deployable.name.length * fontSize * 0.6;
            const textHeight = fontSize + 8;
            const bgPadding = 6;

            return (
              <g key={box.deployable.id}>
                {/* Background behind text */}
                <rect
                  x={box.x + box.width - textWidth - bgPadding - 8}
                  y={box.y + box.height - textHeight - bgPadding}
                  width={textWidth + bgPadding * 2}
                  height={textHeight + bgPadding}
                  fill="var(--color-surface)"
                  fillOpacity={0.9}
                  rx={4}
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onMouseDown={(e) => handleMouseDown(box.deployable.id, e)}
                />
                {/* Label text */}
                <text
                  x={box.x + box.width - 8}
                  y={box.y + box.height - 8}
                  textAnchor="end"
                  dominantBaseline="text-after-edge"
                  fontSize={fontSize}
                  fontWeight={600}
                  fill="var(--color-content-muted)"
                  style={{ pointerEvents: 'auto', cursor: 'pointer' }}
                  onMouseDown={(e) => handleMouseDown(box.deployable.id, e)}
                >
                  {box.deployable.name}
                </text>
              </g>
            );
          })}
        </svg>
      </ViewportPortal>
    </>
  );
}
