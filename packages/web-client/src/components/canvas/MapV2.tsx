import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { Canvas, type CanvasRef, useNodeDrag, useNodeResize, useCanvasContext, ConnectionHandle } from '../../canvas-engine/index.js';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useNodes } from '../../hooks/useNodes';
import { useEdges } from '../../hooks/useEdges';
import { useSchemas } from '../../hooks/useSchemas';
import { usePortSchemas } from '../../hooks/usePortSchemas';
import { useMapNodePipeline } from '../../hooks/useMapNodePipeline';
import { useMapEdgePipeline } from '../../hooks/useMapEdgePipeline';
import { useNarrative } from '../../hooks/useNarrative';
import Narrative from './Narrative';
import { getRectBoundaryPoint, waypointsToPath, computeBezierPath, type Waypoint } from '../../utils/edgeGeometry.js';
import { canConnect, getHandleType } from '@carta/domain';
import { stripHandlePrefix } from '../../utils/handlePrefix.js';

interface MapV2Props {
  searchText?: string;
}

// Inner component that uses canvas context
function MapV2Inner({ sortedNodes, canvasRef, getSchema, getPortSchema, onSelectionChange }: {
  sortedNodes: any[];
  canvasRef: React.RefObject<CanvasRef | null>;
  getSchema: (type: string) => any;
  getPortSchema: (type: string) => any;
  onSelectionChange: (ids: string[]) => void;
}) {
  const { adapter } = useDocumentContext();
  const { transform, isSelected, onNodePointerDown: onSelectPointerDown, selectedIds, startConnection, connectionDrag } = useCanvasContext();

  // Sync selection changes to outer component
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    if (selectedIds !== selectedIdsRef.current) {
      selectedIdsRef.current = selectedIds;
      onSelectionChange(selectedIds);
    }
  }, [selectedIds, onSelectionChange]);

  // Refs for stable callback access
  const sortedNodesRef = useRef(sortedNodes);
  useEffect(() => { sortedNodesRef.current = sortedNodes; }, [sortedNodes]);

  // Port drawer hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

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
        const idsToMove = selectedIds.includes(nodeId) ? selectedIds : [nodeId];
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

  // Source port type for connection validation during drag
  const sourcePortType = useMemo(() => {
    if (!connectionDrag) return null;
    const sourceNode = sortedNodes.find(n => n.id === connectionDrag.sourceNodeId);
    if (!sourceNode || sourceNode.type !== 'construct') return null;
    const sourceData = sourceNode.data as Record<string, unknown>;
    const sourceSchema = getSchema((sourceData as any).constructType);
    if (!sourceSchema) return null;
    const sourcePort = sourceSchema.ports?.find((p: any) => p.id === connectionDrag.sourceHandle);
    return sourcePort?.portType ?? null;
  }, [connectionDrag, sortedNodes, getSchema]);

  // Node rendering — interactive colored boxes with port drawer
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
        const schema = !isOrganizer ? getSchema((data as any).constructType) : null;

        return (
          <div
            key={n.id}
            data-node-id={n.id}
            onPointerDown={(e) => {
              onSelectPointerDown(n.id, e);
              onNodePointerDownDrag(n.id, e);
            }}
            onPointerEnter={() => setHoveredNodeId(n.id)}
            onPointerLeave={() => setHoveredNodeId(null)}
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
            {/* Port drawer - collapsed state (dots strip) */}
            {!isOrganizer && schema?.ports && schema.ports.length > 0 && !connectionDrag && (
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                backgroundColor: 'var(--color-surface-alt, rgba(0,0,0,0.1))',
                borderRadius: '0 0 6px 6px',
              }}>
                {schema.ports.map((port: any) => {
                  const portSchema = getPortSchema(port.portType);
                  return (
                    <div key={port.id} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      backgroundColor: portSchema?.color ?? '#94a3b8',
                    }} />
                  );
                })}
              </div>
            )}
            {/* Port drawer - expanded state on hover */}
            {hoveredNodeId === n.id && !isOrganizer && schema?.ports && schema.ports.length > 0 && !connectionDrag && (
              <div style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30,
                backgroundColor: 'var(--color-surface-elevated, white)',
                border: '1px solid var(--color-border, #e5e7eb)',
                borderRadius: '0 0 8px 8px',
                padding: '6px 8px',
                display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center',
              }}
              onPointerEnter={() => setHoveredNodeId(n.id)}
              onPointerLeave={() => setHoveredNodeId(null)}
              >
                {schema.ports.map((port: any) => {
                  const portSchema = getPortSchema(port.portType);
                  const portColor = portSchema?.color ?? '#94a3b8';
                  return (
                    <div key={port.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                      <ConnectionHandle
                        type="source"
                        id={port.id}
                        nodeId={n.id}
                        onStartConnection={startConnection}
                        style={{
                          width: 16, height: 16, borderRadius: '50%',
                          backgroundColor: portColor, border: '2px solid white',
                          cursor: 'crosshair',
                        }}
                      />
                      <span style={{ fontSize: 9, color: 'var(--color-content-muted, #6b7280)' }}>
                        {port.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Drop zones during connection drag */}
            {connectionDrag && connectionDrag.sourceNodeId !== n.id && !isOrganizer && schema?.ports && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                borderRadius: 6, overflow: 'hidden', zIndex: 25,
              }}>
                {schema.ports.map((port: any) => {
                  const portSchema = getPortSchema(port.portType);
                  const isValid = sourcePortType ? canConnect(sourcePortType, port.portType) : false;
                  const portColor = portSchema?.color ?? '#94a3b8';
                  return (
                    <ConnectionHandle
                      key={port.id}
                      type="target"
                      id={port.id}
                      nodeId={n.id}
                      style={{
                        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        backgroundColor: isValid ? portColor + '40' : 'rgba(128,128,128,0.15)',
                        border: isValid ? `2px solid ${portColor}` : '2px dotted rgba(128,128,128,0.4)',
                        pointerEvents: isValid ? 'auto' : 'none',
                        fontSize: 11, fontWeight: 600,
                        color: isValid ? portColor : 'rgba(128,128,128,0.6)',
                      }}
                    >
                      {port.label}
                    </ConnectionHandle>
                  );
                })}
              </div>
            )}
          </div>
        );
      });
  }, [sortedNodes, dragOffsets, resizingNodeId, resizeDeltas, isSelected, onSelectPointerDown, onNodePointerDownDrag, onResizePointerDown, getSchema, getPortSchema, hoveredNodeId, connectionDrag, sourcePortType, startConnection]);

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
  const { edges, setEdges } = useEdges();
  const { schemas, getSchema } = useSchemas();
  const { getPortSchema } = usePortSchemas();
  const { narrative, showNarrative, hideNarrative } = useNarrative();

  // Track selected IDs for edge pipeline
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

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
    selectedNodeIds,
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

  // Connection validation
  const handleValidateConnection = useCallback((conn: {
    source: string; sourceHandle: string;
    target: string; targetHandle: string;
  }) => {
    if (conn.source === conn.target) return false;
    if (!conn.sourceHandle || !conn.targetHandle) return false;

    const cleanSourceHandle = stripHandlePrefix(conn.sourceHandle);
    const cleanTargetHandle = stripHandlePrefix(conn.targetHandle);

    const sourceNode = nodes.find(n => n.id === conn.source);
    const targetNode = nodes.find(n => n.id === conn.target);
    if (!sourceNode || !targetNode) return false;
    if (sourceNode.type !== 'construct' || targetNode.type !== 'construct') return true;

    const sourceData = sourceNode.data as Record<string, unknown>;
    const targetData = targetNode.data as Record<string, unknown>;
    const sourceSchema = getSchema((sourceData as any).constructType);
    const targetSchema = getSchema((targetData as any).constructType);
    if (!sourceSchema || !targetSchema) return false;

    const sourcePort = sourceSchema.ports?.find((p: any) => p.id === cleanSourceHandle);
    const targetPort = targetSchema.ports?.find((p: any) => p.id === cleanTargetHandle);
    if (!sourcePort || !targetPort) return false;

    return canConnect(sourcePort.portType, targetPort.portType);
  }, [nodes, getSchema]);

  // Connection creation
  const handleConnect = useCallback((conn: {
    source: string; sourceHandle: string;
    target: string; targetHandle: string;
  }) => {
    const cleanSourceHandle = stripHandlePrefix(conn.sourceHandle);
    const cleanTargetHandle = stripHandlePrefix(conn.targetHandle);

    const sourceNode = nodes.find(n => n.id === conn.source);
    const targetNode = nodes.find(n => n.id === conn.target);
    if (!sourceNode || !targetNode) return;
    if (sourceNode.type !== 'construct' || targetNode.type !== 'construct') return;

    const sourceData = sourceNode.data as Record<string, unknown>;
    const targetData = targetNode.data as Record<string, unknown>;
    const sourceSchema = getSchema((sourceData as any).constructType);
    const targetSchema = getSchema((targetData as any).constructType);
    if (!sourceSchema || !targetSchema) return;

    const sourcePort = sourceSchema.ports?.find((p: any) => p.id === cleanSourceHandle);
    const targetPort = targetSchema.ports?.find((p: any) => p.id === cleanTargetHandle);
    if (!sourcePort || !targetPort) return;

    // Normalize direction: ensure source has 'source' handle type
    const sourceHandleType = getHandleType(sourcePort.portType);
    const targetHandleType = getHandleType(targetPort.portType);
    const needsFlip = sourceHandleType === 'target' && targetHandleType === 'source';

    const normalized = needsFlip
      ? { source: conn.target, sourceHandle: cleanTargetHandle, target: conn.source, targetHandle: cleanSourceHandle }
      : { source: conn.source, sourceHandle: cleanSourceHandle, target: conn.target, targetHandle: cleanTargetHandle };

    // Add edge via setEdges
    setEdges((eds) => {
      const newEdge = {
        id: `e-${normalized.source}-${normalized.sourceHandle}-${normalized.target}-${normalized.targetHandle}`,
        source: normalized.source,
        sourceHandle: normalized.sourceHandle,
        target: normalized.target,
        targetHandle: normalized.targetHandle,
      };
      // Check for duplicate
      const exists = eds.some(e =>
        e.source === newEdge.source &&
        e.sourceHandle === newEdge.sourceHandle &&
        e.target === newEdge.target &&
        e.targetHandle === newEdge.targetHandle
      );
      if (exists) return eds;
      return [...eds, newEdge];
    });
  }, [nodes, getSchema, setEdges]);

  // Edge click handler
  const handleEdgeClick = useCallback((edge: any, event: React.MouseEvent) => {
    // Select source + target nodes
    setSelectedNodeIds([edge.source, edge.target]);

    // Build narrative endpoint data
    const sourceNode = sortedNodes.find(n => n.id === edge.source);
    const targetNode = sortedNodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return;

    const sourceData = sourceNode.data as Record<string, unknown>;
    const targetData = targetNode.data as Record<string, unknown>;
    const sourceName = (sourceData.label as string) ?? (sourceData.semanticId as string) ?? edge.source;
    const targetName = (targetData.label as string) ?? (targetData.semanticId as string) ?? edge.target;

    // Get port colors
    const sourceSchema = getSchema((sourceData as any).constructType);
    const targetSchema = getSchema((targetData as any).constructType);
    const sourcePort = sourceSchema?.ports?.find((p: any) => p.id === edge.sourceHandle);
    const targetPort = targetSchema?.ports?.find((p: any) => p.id === edge.targetHandle);
    const sourcePortSchema = sourcePort ? getPortSchema(sourcePort.portType) : null;
    const targetPortSchema = targetPort ? getPortSchema(targetPort.portType) : null;

    showNarrative({
      kind: 'edge',
      from: {
        name: sourceName,
        schemaType: sourceSchema?.displayName ?? '',
        portLabel: edge.sourceHandle ?? '',
        portColor: sourcePortSchema?.color ?? '#94a3b8',
      },
      to: {
        name: targetName,
        schemaType: targetSchema?.displayName ?? '',
        portLabel: edge.targetHandle ?? '',
        portColor: targetPortSchema?.color ?? '#94a3b8',
      },
      position: { x: event.clientX, y: event.clientY },
      anchor: 'above',
    });
  }, [sortedNodes, getSchema, getPortSchema, showNarrative]);

  // Edge rendering — bezier paths with dynamic anchors
  const renderEdges = useCallback(() => {
    // Build node rect lookup
    const nodeRects = new Map<string, { x: number; y: number; width: number; height: number }>();
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
      nodeRects.set(n.id, { x, y, width: w, height: h });
    }

    return displayEdges.filter(e => !e.hidden).map(e => {
      const srcRect = nodeRects.get(e.source);
      const tgtRect = nodeRects.get(e.target);
      if (!srcRect || !tgtRect) return null;

      const srcCenter = { x: srcRect.x + srcRect.width / 2, y: srcRect.y + srcRect.height / 2 };
      const tgtCenter = { x: tgtRect.x + tgtRect.width / 2, y: tgtRect.y + tgtRect.height / 2 };

      const srcBoundary = getRectBoundaryPoint(srcRect, tgtCenter);
      const tgtBoundary = getRectBoundaryPoint(tgtRect, srcCenter);

      const dataRecord = e.data as Record<string, unknown> | undefined;
      const waypoints = dataRecord?.waypoints as Waypoint[] | undefined;
      const polarity = dataRecord?.polarity as string | undefined;
      const dimmed = dataRecord?.dimmed as boolean | undefined;
      const bundleCount = (dataRecord?.bundleCount as number) ?? 1;
      const isBundled = bundleCount > 1;
      const showArrow = polarity !== 'bidirectional';

      let edgePath: string;
      let labelX: number;
      let labelY: number;

      if (waypoints && waypoints.length >= 2) {
        edgePath = waypointsToPath(waypoints);
        const mid = Math.floor(waypoints.length / 2);
        labelX = waypoints[mid].x;
        labelY = waypoints[mid].y;
      } else {
        const result = computeBezierPath(
          srcBoundary.x, srcBoundary.y, srcBoundary.side,
          tgtBoundary.x, tgtBoundary.y, tgtBoundary.side,
        );
        edgePath = result.path;
        labelX = result.labelX;
        labelY = result.labelY;
      }

      const color = (e.style?.stroke as string) ?? 'var(--edge-default-color, #94a3b8)';
      const strokeWidth = isBundled ? Math.min(1.5 + (bundleCount - 1) * 1, 6) : 1.5;
      const opacity = dimmed ? 0.15 : 0.8;

      return (
        <g key={e.id}>
          {/* Wider invisible path for click targeting */}
          <path d={edgePath} fill="none" stroke="transparent" strokeWidth={20}
            style={{ pointerEvents: 'stroke', cursor: 'pointer' }}
            onClick={(ev) => handleEdgeClick(e, ev)} />
          <path d={edgePath} fill="none" stroke={color} strokeWidth={strokeWidth}
            opacity={opacity}
            markerEnd={showArrow ? 'url(#carta-arrow-end)' : undefined}
            style={{ pointerEvents: 'none' }} />
          {isBundled && !dimmed && (
            <g transform={`translate(${labelX}, ${labelY})`}>
              <circle r={10} fill="var(--color-surface, white)" stroke={color} strokeWidth={1.5} />
              <text textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight={600}
                fill="var(--color-content-muted, #6b7280)" style={{ pointerEvents: 'none' }}>
                {bundleCount}
              </text>
            </g>
          )}
        </g>
      );
    });
  }, [sortedNodes, displayEdges, handleEdgeClick]);

  // Connection preview rendering
  const renderConnectionPreview = useCallback((drag: any, transform: any) => {
    const sourceNode = sortedNodes.find(n => n.id === drag.sourceNodeId);
    if (!sourceNode) return null;
    const { x: absX, y: absY } = getAbsolutePosition(sourceNode);
    const w = (sourceNode.style?.width as number) ?? 200;
    const h = (sourceNode.style?.height as number) ?? 80;

    const sx = absX + w / 2;
    const sy = absY + h;
    const canvasPos = canvasRef.current?.screenToCanvas(drag.currentX, drag.currentY);
    if (!canvasPos) return null;

    return (
      <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
        <line x1={sx} y1={sy} x2={canvasPos.x} y2={canvasPos.y}
          stroke="var(--color-accent, #3b82f6)" strokeWidth={2} strokeDasharray="4 4"
          style={{ pointerEvents: 'none' }} />
      </g>
    );
  }, [sortedNodes, getAbsolutePosition, canvasRef]);

  return (
    <div style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-canvas)', position: 'relative' }}>
      {/* SVG arrow marker definition */}
      <svg style={{ position: 'absolute', width: 0, height: 0 }}>
        <defs>
          <marker id="carta-arrow-end" viewBox="0 0 10 10" refX="10" refY="5"
                  markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--edge-default-color, #94a3b8)" />
          </marker>
        </defs>
      </svg>
      <Canvas
        ref={canvasRef}
        viewportOptions={{ minZoom: 0.05, maxZoom: 3 }}
        renderEdges={renderEdges}
        renderConnectionPreview={renderConnectionPreview}
        connectionDrag={{
          onConnect: handleConnect,
          isValidConnection: handleValidateConnection,
        }}
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
        onBackgroundPointerDown={() => {
          canvasRef.current?.clearSelection();
          setSelectedNodeIds([]);
        }}
      >
        <MapV2Inner
          sortedNodes={sortedNodes}
          canvasRef={canvasRef}
          getSchema={getSchema}
          getPortSchema={getPortSchema}
          onSelectionChange={setSelectedNodeIds}
        />
      </Canvas>
      <Narrative narrative={narrative} onDismiss={hideNarrative} />
    </div>
  );
}
