import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Canvas, type CanvasRef, useNodeDrag, useNodeResize, useCanvasContext } from '../../canvas-engine/index.js';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useNodes } from '../../hooks/useNodes';
import { useEdges } from '../../hooks/useEdges';
import { useSchemas } from '../../hooks/useSchemas';
import { usePortSchemas } from '../../hooks/usePortSchemas';
import { useMapNodePipeline } from '../../hooks/useMapNodePipeline';
import { useMapEdgePipeline } from '../../hooks/useMapEdgePipeline';

interface MapV2Props {
  searchText?: string;
}

// Inner component that uses canvas context
function MapV2Inner({ sortedNodes, canvasRef }: {
  sortedNodes: any[];
  canvasRef: React.RefObject<CanvasRef | null>;
}) {
  const { adapter } = useDocumentContext();
  const { transform, isSelected, onNodePointerDown: onSelectPointerDown, selectedIds } = useCanvasContext();

  // Refs for stable callback access
  const selectedIdsRef = useRef(selectedIds);
  const sortedNodesRef = useRef(sortedNodes);
  useEffect(() => { selectedIdsRef.current = selectedIds; }, [selectedIds]);
  useEffect(() => { sortedNodesRef.current = sortedNodes; }, [sortedNodes]);

  // Drag state
  const [dragOffsets, setDragOffsets] = useState<Map<string, { dx: number; dy: number }>>(new Map());
  const dragOriginRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);

  // Resize state
  const [resizeDeltas, setResizeDeltas] = useState<{ dw: number; dh: number } | null>(null);
  const resizeOriginRef = useRef<{ nodeId: string; width: number; height: number } | null>(null);

  // Node drag hook
  const { onPointerDown: onNodePointerDownDrag } = useNodeDrag({
    zoomScale: transform.k,
    callbacks: {
      onDragStart: (nodeId) => {
        const node = sortedNodesRef.current.find(n => n.id === nodeId);
        if (node) {
          dragOriginRef.current = { nodeId, x: node.position.x, y: node.position.y };
        }
      },
      onDrag: (nodeId, deltaX, deltaY) => {
        const origin = dragOriginRef.current;
        if (!origin || origin.nodeId !== nodeId) return;

        // If node is selected, move all selected nodes
        const idsToMove = selectedIdsRef.current.includes(nodeId) ? selectedIdsRef.current : [nodeId];
        setDragOffsets(prev => {
          const next = new Map(prev);
          for (const id of idsToMove) {
            next.set(id, { dx: deltaX, dy: deltaY });
          }
          return next;
        });
      },
      onDragEnd: () => {
        const patches: Array<{ id: string; position: { x: number; y: number } }> = [];
        for (const [id, offset] of dragOffsets) {
          const node = sortedNodesRef.current.find(n => n.id === id);
          if (node) {
            patches.push({ id, position: { x: node.position.x + offset.dx, y: node.position.y + offset.dy } });
          }
        }
        if (patches.length > 0) {
          adapter.patchNodes?.(patches, 'drag-commit');
        }
        setDragOffsets(new Map());
        dragOriginRef.current = null;
      },
    },
  });

  // Node resize hook
  const { resizingNodeId, onResizePointerDown } = useNodeResize({
    zoomScale: transform.k,
    callbacks: {
      onResizeStart: (nodeId) => {
        const node = sortedNodesRef.current.find(n => n.id === nodeId);
        if (node) {
          resizeOriginRef.current = {
            nodeId,
            width: (node.style?.width as number) ?? 300,
            height: (node.style?.height as number) ?? 200,
          };
        }
      },
      onResize: (nodeId, deltaWidth, deltaHeight) => {
        const origin = resizeOriginRef.current;
        if (!origin || origin.nodeId !== nodeId) return;
        setResizeDeltas({ dw: deltaWidth, dh: deltaHeight });
      },
      onResizeEnd: (nodeId) => {
        const origin = resizeOriginRef.current;
        if (!origin) return;
        const newWidth = Math.max(100, origin.width + (resizeDeltas?.dw ?? 0));
        const newHeight = Math.max(60, origin.height + (resizeDeltas?.dh ?? 0));
        adapter.patchNodes?.([{ id: nodeId, style: { width: newWidth, height: newHeight } }]);
        resizeOriginRef.current = null;
        setResizeDeltas(null);
      },
    },
  });

  // Node rendering — interactive colored boxes
  const nodeElements = useMemo(() => {
    return sortedNodes
      .filter(n => !n.hidden)
      .map(n => {
        const isOrganizer = n.type === 'organizer';
        const data = n.data as Record<string, unknown>;
        const color = (data.color as string) ?? (isOrganizer ? '#7c3aed' : '#6b7280');
        const label = (data.label as string) ?? (data.semanticId as string) ?? n.id;
        let width = (n.style?.width as number) ?? (isOrganizer ? 300 : 200);
        let height = (n.style?.height as number) ?? (isOrganizer ? 200 : 80);

        // Apply resize deltas if this node is being resized
        if (resizingNodeId === n.id && resizeDeltas) {
          width = Math.max(100, width + resizeDeltas.dw);
          height = Math.max(60, height + resizeDeltas.dh);
        }

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

        // Apply drag offset if this node is being dragged
        const offset = dragOffsets.get(n.id);
        if (offset) {
          absX += offset.dx;
          absY += offset.dy;
        }

        const selected = isSelected(n.id);

        return (
          <div
            key={n.id}
            data-node-id={n.id}
            onPointerDown={(e) => {
              onSelectPointerDown(n.id, e);
              onNodePointerDownDrag(n.id, e);
            }}
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
              cursor: 'grab',
              outline: selected ? '2px solid var(--color-accent, #3b82f6)' : 'none',
              outlineOffset: '2px',
            }}
          >
            {label}
            {isOrganizer && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: 12,
                  height: 12,
                  cursor: 'se-resize',
                  backgroundColor: color,
                  opacity: 0.5,
                }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  onResizePointerDown(n.id, { horizontal: 'right', vertical: 'bottom' }, e);
                }}
              />
            )}
          </div>
        );
      });
  }, [sortedNodes, dragOffsets, resizingNodeId, resizeDeltas, isSelected, onSelectPointerDown, onNodePointerDownDrag, onResizePointerDown]);

  // Zoom controls style
  const zoomButtonStyle: React.CSSProperties = {
    width: 32,
    height: 32,
    border: '1px solid var(--color-border, #e5e7eb)',
    borderRadius: 4,
    backgroundColor: 'var(--color-surface, #fff)',
    color: 'var(--color-text, #000)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 16,
    fontWeight: 500,
    padding: 0,
  };

  return (
    <>
      {/* Zoom controls */}
      <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button onClick={() => canvasRef.current?.zoomIn()} style={zoomButtonStyle}>+</button>
        <button onClick={() => canvasRef.current?.zoomOut()} style={zoomButtonStyle}>−</button>
        <button
          onClick={() => {
            const rects = sortedNodesRef.current.filter(n => !n.hidden && !n.parentId).map(n => ({
              x: n.position.x,
              y: n.position.y,
              width: (n.style?.width as number) ?? (n.type === 'organizer' ? 300 : 200),
              height: (n.style?.height as number) ?? (n.type === 'organizer' ? 200 : 80),
            }));
            canvasRef.current?.fitView(rects, 0.1);
          }}
          style={zoomButtonStyle}
        >
          ⊡
        </button>
      </div>
      {nodeElements}
    </>
  );
}

export default function MapV2({ searchText }: MapV2Props) {
  const { nodes } = useNodes();
  const { edges } = useEdges();
  const { schemas, getSchema } = useSchemas();
  const { getPortSchema } = usePortSchemas();

  // Node pipeline (needs same inputs as Map.tsx)
  // For interaction, pass stub/no-op values for modal-only params:
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

  // Helper to compute absolute positions for box select
  const getAbsolutePosition = useCallback((n: any) => {
    let absX = n.position.x;
    let absY = n.position.y;
    if (n.parentId) {
      const parent = sortedNodes.find(p => p.id === n.parentId);
      if (parent) {
        absX += parent.position.x;
        absY += parent.position.y;
      }
    }
    return { x: absX, y: absY };
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
        boxSelect={{
          getNodeRects: () => sortedNodes.filter(n => !n.hidden && n.type !== 'organizer').map(n => {
            const { x, y } = getAbsolutePosition(n);
            return {
              id: n.id,
              x,
              y,
              width: (n.style?.width as number) ?? 200,
              height: (n.style?.height as number) ?? 80,
            };
          }),
        }}
        onBackgroundPointerDown={() => canvasRef.current?.clearSelection()}
      >
        <MapV2Inner sortedNodes={sortedNodes} canvasRef={canvasRef} />
      </Canvas>
    </div>
  );
}
