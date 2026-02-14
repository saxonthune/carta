import { useRef, useMemo, useCallback, useEffect } from 'react';
import { Canvas, type CanvasRef } from '../../canvas-engine/index.js';
import { useNodes } from '../../hooks/useNodes';
import { useEdges } from '../../hooks/useEdges';
import { useSchemas } from '../../hooks/useSchemas';
import { usePortSchemas } from '../../hooks/usePortSchemas';
import { useMapNodePipeline } from '../../hooks/useMapNodePipeline';
import { useMapEdgePipeline } from '../../hooks/useMapEdgePipeline';

interface MapV2Props {
  searchText?: string;
}

export default function MapV2({ searchText }: MapV2Props) {
  const { nodes } = useNodes();
  const { edges } = useEdges();
  const { schemas, getSchema } = useSchemas();
  const { getPortSchema } = usePortSchemas();

  // Node pipeline (needs same inputs as Map.tsx)
  // For the static shell, pass stub/no-op values for interactive-only params:
  const nodeActions = useMemo(() => ({
    onRename: () => {},
    onValuesChange: () => {},
    onInstanceColorChange: () => {},
    onToggleCollapse: () => {},
    onSpreadChildren: () => {},
    onFlowLayoutChildren: () => {},
    onGridLayoutChildren: () => {},
    onFitToChildren: () => {},
    onUpdateOrganizerColor: () => {},
    onRenameOrganizer: () => {},
    onRecursiveLayout: () => {},
    onToggleLayoutPin: () => {},
  }), []);

  const { sortedNodes, edgeRemap } = useMapNodePipeline({
    nodes,
    edges,
    renamingNodeId: null,
    renamingOrganizerId: null,
    isTraceActive: false,
    traceResult: null,
    nodeActions,
    orgRenameStart: () => {},
    orgRenameStop: () => {},
    searchText,
    getSchema,
  });

  const { displayEdges } = useMapEdgePipeline({
    edges,
    sortedNodes,
    edgeRemap,
    selectedNodeIds: [],
    schemas,
    getSchema,
    getPortSchema,
    isTraceActive: false,
    traceResult: null,
    nodes,
  });

  // Canvas ref + fit view on mount
  const canvasRef = useRef<CanvasRef>(null);

  // Fit view after first render
  const fitDone = useRef(false);
  useEffect(() => {
    if (sortedNodes.length > 0 && !fitDone.current && canvasRef.current) {
      const rects = sortedNodes
        .filter(n => !n.hidden && !n.parentId) // top-level only
        .map(n => ({
          x: n.position.x,
          y: n.position.y,
          width: (n.style?.width as number) ?? (n.type === 'organizer' ? 300 : 200),
          height: (n.style?.height as number) ?? (n.type === 'organizer' ? 200 : 80),
        }));
      canvasRef.current.fitView(rects, 0.1);
      fitDone.current = true;
    }
  }, [sortedNodes]);

  // Node rendering — simple colored boxes
  const nodeElements = useMemo(() => {
    return sortedNodes
      .filter(n => !n.hidden)
      .map(n => {
        const isOrganizer = n.type === 'organizer';
        const data = n.data as Record<string, unknown>;
        const color = (data.color as string) ?? (isOrganizer ? '#7c3aed' : '#6b7280');
        const label = (data.label as string) ?? (data.semanticId as string) ?? n.id;
        const width = (n.style?.width as number) ?? (isOrganizer ? 300 : 200);
        const height = (n.style?.height as number) ?? (isOrganizer ? 200 : 80);

        // Compute absolute position (children have relative positions)
        let absX = n.position.x;
        let absY = n.position.y;
        if (n.parentId) {
          const parent = sortedNodes.find(p => p.id === n.parentId);
          if (parent) {
            absX += parent.position.x;
            absY += parent.position.y;
          }
        }

        return (
          <div
            key={n.id}
            style={{
              position: 'absolute',
              left: absX,
              top: absY,
              width,
              height,
              backgroundColor: isOrganizer ? 'transparent' : color,
              border: isOrganizer ? `2px dashed ${color}` : `1px solid color-mix(in srgb, ${color} 70%, transparent)`,
              borderRadius: isOrganizer ? 8 : 6,
              opacity: isOrganizer ? 0.6 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isOrganizer ? color : 'white',
              fontSize: 12,
              fontWeight: 500,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              padding: '0 8px',
              pointerEvents: 'none',
            }}
          >
            {label}
          </div>
        );
      });
  }, [sortedNodes]);

  // Edge rendering — straight lines between node centers, passed via renderEdges prop
  const renderEdges = useCallback(() => {
    // Build a lookup of node positions for edge endpoint resolution
    const nodeMap = new Map<string, { cx: number; cy: number }>();
    for (const n of sortedNodes) {
      if (n.hidden) continue;
      const w = (n.style?.width as number) ?? (n.type === 'organizer' ? 300 : 200);
      const h = (n.style?.height as number) ?? (n.type === 'organizer' ? 200 : 80);
      let x = n.position.x;
      let y = n.position.y;
      if (n.parentId) {
        const parent = sortedNodes.find(p => p.id === n.parentId);
        if (parent) { x += parent.position.x; y += parent.position.y; }
      }
      nodeMap.set(n.id, { cx: x + w / 2, cy: y + h / 2 });
    }

    return displayEdges
      .filter(e => !e.hidden)
      .map(e => {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (!src || !tgt) return null;
        const color = (e.style?.stroke as string) ?? 'var(--edge-default-color, #94a3b8)';
        return (
          <line
            key={e.id}
            x1={src.cx} y1={src.cy}
            x2={tgt.cx} y2={tgt.cy}
            stroke={color}
            strokeWidth={1.5}
            opacity={0.6}
          />
        );
      });
  }, [sortedNodes, displayEdges]);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-canvas)' }}>
      <Canvas
        ref={canvasRef}
        viewportOptions={{ minZoom: 0.05, maxZoom: 3 }}
        renderEdges={renderEdges}
        patternId="mapv2-grid"
      >
        {nodeElements}
      </Canvas>
    </div>
  );
}
