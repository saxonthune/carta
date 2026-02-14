import { useState, useEffect, useCallback, useRef } from 'react';
import { resolvePinConstraints } from '@carta/domain';
import type { PinLayoutNode, PinDirection, OrganizerNodeData } from '@carta/domain';
import { useNodes, usePinConstraints } from '../../hooks';
import LayoutMapOrganizerNode from './LayoutMapOrganizerNode';
import ContextMenuPrimitive from '../ui/ContextMenuPrimitive';
import { useViewport, useConnectionDrag } from '../../canvas-engine/index.js';

interface LayoutMapProps {
  onClose: () => void;
}

interface LocalNode {
  id: string;
  position: { x: number; y: number };
  data: { name: string; color: string };
  style?: { width?: number; height?: number };
}

interface LocalEdge {
  id: string;
  source: string;
  sourceHandle: string | null | undefined;
  target: string;
  targetHandle: string;
  label: string;
}

const VALID_SOURCE_HANDLES = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

interface ConnectionCandidate {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}

interface ConnectionRule {
  id: string;
  message: string;
  test: (candidate: ConnectionCandidate) => boolean; // true = passes
}

interface ValidationResult {
  valid: boolean;
  message: string; // description if valid, rejection reason if invalid
}

const LAYOUT_MAP_RULES: ConnectionRule[] = [
  {
    id: 'no-self-loop',
    message: 'Cannot connect to self',
    test: (c) => c.source !== c.target,
  },
  {
    id: 'source-is-compass',
    message: 'Must drag from a compass handle',
    test: (c) => VALID_SOURCE_HANDLES.has(c.sourceHandle),
  },
  {
    id: 'target-is-body',
    message: 'Must drop on organizer body',
    test: (c) => c.targetHandle === 'body',
  },
];

function validateConnection(
  rules: ConnectionRule[],
  candidate: ConnectionCandidate,
  nameMap: Map<string, string>
): ValidationResult {
  for (const rule of rules) {
    if (!rule.test(candidate)) {
      return { valid: false, message: rule.message };
    }
  }
  const sourceName = nameMap.get(candidate.target) || candidate.target;
  const targetName = nameMap.get(candidate.source) || candidate.source;
  const direction = candidate.sourceHandle;
  return { valid: true, message: `${sourceName} ${direction} of ${targetName}` };
}

function getHandlePosition(node: LocalNode, handleId: string | null | undefined): { x: number; y: number } {
  const w = node.style?.width ?? 400;
  const h = node.style?.height ?? 300;
  const cx = node.position.x + w / 2;
  const cy = node.position.y + h / 2;
  switch (handleId) {
    case 'N':
      return { x: cx, y: node.position.y };
    case 'NE':
      return { x: node.position.x + w, y: node.position.y };
    case 'E':
      return { x: node.position.x + w, y: cy };
    case 'SE':
      return { x: node.position.x + w, y: node.position.y + h };
    case 'S':
      return { x: cx, y: node.position.y + h };
    case 'SW':
      return { x: node.position.x, y: node.position.y + h };
    case 'W':
      return { x: node.position.x, y: cy };
    case 'NW':
      return { x: node.position.x, y: node.position.y };
    default:
      return { x: cx, y: cy }; // 'body' or unknown → center
  }
}

export default function LayoutMap({ onClose }: LayoutMapProps) {
  const { nodes: allNodes } = useNodes();
  const { constraints, addConstraint, removeConstraint } = usePinConstraints();

  // Local state for layout view nodes/edges (independent from real canvas)
  const [localNodes, setLocalNodes] = useState<LocalNode[]>([]);
  const [localEdges, setLocalEdges] = useState<LocalEdge[]>([]);
  const [edgeContextMenu, setEdgeContextMenu] = useState<{ x: number; y: number; edgeId: string } | null>(
    null
  );
  const [connectionHint, setConnectionHint] = useState<{
    valid: boolean;
    message: string;
    x: number;
    y: number;
  } | null>(null);

  // Viewport
  const { transform, containerRef, fitView } = useViewport({ minZoom: 0.15, maxZoom: 2 });

  // FitView on mount
  const fitViewDoneRef = useRef(false);
  useEffect(() => {
    if (localNodes.length > 0 && !fitViewDoneRef.current) {
      const rects = localNodes.map((n) => ({
        x: n.position.x,
        y: n.position.y,
        width: n.style?.width ?? 400,
        height: n.style?.height ?? 300,
      }));
      fitView(rects, 0.2);
      fitViewDoneRef.current = true;
    }
  }, [localNodes, fitView]);

  // Drag state
  const dragStateRef = useRef<{
    nodeId: string;
    startX: number;
    startY: number;
    originalX: number;
    originalY: number;
  } | null>(null);

  // Node name map for validation messages
  const nodeNameMapRef = useRef(new Map<string, string>());
  useEffect(() => {
    const map = new Map<string, string>();
    for (const n of localNodes) {
      map.set(n.id, n.data.name || n.id);
    }
    nodeNameMapRef.current = map;
  }, [localNodes]);

  // Connection drag
  const handleConnect = useCallback(
    (connection: { source: string; sourceHandle: string; target: string; targetHandle: string }) => {
      if (connection.source === connection.target) return; // no self-loops
      const direction = connection.sourceHandle as PinDirection;
      // Swap source and target: dragging from org1's NE handle to org2 means "org2 is NE of org1"
      addConstraint(connection.target, connection.source, direction);
    },
    [addConstraint]
  );

  const isValidConnection = useCallback(
    (connection: { source: string; sourceHandle: string; target: string; targetHandle: string }) => {
      const result = validateConnection(LAYOUT_MAP_RULES, connection, nodeNameMapRef.current);
      return result.valid;
    },
    []
  );

  const { connectionDrag, startConnection } = useConnectionDrag({
    onConnect: handleConnect,
    isValidConnection,
  });

  // Connection drag feedback - hit-test and show hints
  useEffect(() => {
    if (!connectionDrag) {
      setConnectionHint(null);
      return;
    }

    const handleMove = (e: PointerEvent) => {
      const elements = document.elementsFromPoint(e.clientX, e.clientY);
      const targetEl = elements.find((el) =>
        el.hasAttribute('data-connection-target')
      ) as HTMLElement | undefined;

      if (targetEl) {
        const targetNodeId = targetEl.getAttribute('data-node-id');
        const targetHandleId = targetEl.getAttribute('data-handle-id');
        if (targetNodeId && targetHandleId) {
          const result = validateConnection(
            LAYOUT_MAP_RULES,
            {
              source: connectionDrag.sourceNodeId,
              sourceHandle: connectionDrag.sourceHandle,
              target: targetNodeId,
              targetHandle: targetHandleId,
            },
            nodeNameMapRef.current
          );
          setConnectionHint({
            valid: result.valid,
            message: result.message,
            x: e.clientX,
            y: e.clientY,
          });
          return;
        }
      }
      // Not hovering over a valid target
      setConnectionHint(null);
    };

    window.addEventListener('pointermove', handleMove);
    return () => window.removeEventListener('pointermove', handleMove);
  }, [connectionDrag]);

  // Initialize layout nodes from real canvas organizers
  useEffect(() => {
    // Find eligible organizers: top-level organizers AND wagons attached to top-level constructs
    const eligibleOrganizers = allNodes.filter((n) => {
      if (n.type !== 'organizer') return false;
      if (!n.parentId) return true; // regular top-level organizer
      // Wagon: has attachedToSemanticId and parent construct is top-level
      const data = n.data as OrganizerNodeData;
      if (!data.attachedToSemanticId) return false;
      const parent = allNodes.find((p) => p.id === n.parentId);
      return parent ? !parent.parentId : false;
    });

    const layoutNodes: LocalNode[] = eligibleOrganizers.map((orgNode) => {
      const orgData = orgNode.data as OrganizerNodeData;
      let displayName = orgData.name;

      // For wagons, append the construct title
      if (orgData.attachedToSemanticId) {
        const parentNode = allNodes.find((n) => n.id === orgNode.parentId);
        const constructTitle = parentNode
          ? ((parentNode.data as any).title ?? (parentNode.data as any).semanticId ?? parentNode.id)
          : orgData.attachedToSemanticId;
        displayName = `${orgData.name} → ${constructTitle}`;
      }

      // Convert wagon positions to absolute for layout view
      let position = orgNode.position;
      if (orgNode.parentId) {
        const parentNode = allNodes.find((n) => n.id === orgNode.parentId);
        if (parentNode) {
          position = {
            x: orgNode.position.x + parentNode.position.x,
            y: orgNode.position.y + parentNode.position.y,
          };
        }
      }

      return {
        id: orgNode.id,
        position,
        data: {
          name: displayName,
          color: orgData.color,
        },
        style: {
          width: (orgNode as any).measured?.width ?? (orgNode as any).width ?? 400,
          height: (orgNode as any).measured?.height ?? (orgNode as any).height ?? 300,
        },
      };
    });

    setLocalNodes(layoutNodes);
  }, [allNodes]);

  // Update edges whenever constraints change
  useEffect(() => {
    // Build a name lookup from local nodes
    const nameMap = new Map<string, string>();
    for (const n of localNodes) {
      nameMap.set(n.id, n.data.name || n.id);
    }

    const edges: LocalEdge[] = constraints.map((c) => {
      const sourceName = nameMap.get(c.sourceOrganizerId) || c.sourceOrganizerId;
      const targetName = nameMap.get(c.targetOrganizerId) || c.targetOrganizerId;
      // Constraint means: sourceOrganizerId is positioned {direction} of targetOrganizerId
      const label = `${sourceName} ${c.direction} of ${targetName}`;

      return {
        id: c.id,
        source: c.targetOrganizerId, // reference node (anchor)
        sourceHandle: c.direction,
        target: c.sourceOrganizerId, // positioned node
        targetHandle: 'body',
        label,
      };
    });
    setLocalEdges(edges);
  }, [constraints, localNodes]);

  // Handle node drag
  const handlePointerDown = useCallback(
    (nodeId: string, event: React.PointerEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (!target.closest('.drag-handle')) return;

      event.stopPropagation();

      const node = localNodes.find((n) => n.id === nodeId);
      if (!node) return;

      dragStateRef.current = {
        nodeId,
        startX: event.clientX,
        startY: event.clientY,
        originalX: node.position.x,
        originalY: node.position.y,
      };

      const handlePointerMove = (e: PointerEvent) => {
        if (!dragStateRef.current) return;

        const deltaScreenX = e.clientX - dragStateRef.current.startX;
        const deltaScreenY = e.clientY - dragStateRef.current.startY;

        const deltaCanvasX = deltaScreenX / transform.k;
        const deltaCanvasY = deltaScreenY / transform.k;

        setLocalNodes((prev) =>
          prev.map((n) =>
            n.id === dragStateRef.current!.nodeId
              ? {
                  ...n,
                  position: {
                    x: dragStateRef.current!.originalX + deltaCanvasX,
                    y: dragStateRef.current!.originalY + deltaCanvasY,
                  },
                }
              : n
          )
        );
      };

      const handlePointerUp = () => {
        dragStateRef.current = null;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    [localNodes, transform.k]
  );

  // Edge context menu handling
  const onEdgeContextMenu = useCallback((event: React.MouseEvent, edgeId: string) => {
    event.preventDefault();
    setEdgeContextMenu({ x: event.clientX, y: event.clientY, edgeId });
  }, []);

  const handleDeleteConstraint = useCallback(() => {
    if (edgeContextMenu) {
      removeConstraint(edgeContextMenu.edgeId);
      setEdgeContextMenu(null);
    }
  }, [edgeContextMenu, removeConstraint]);

  // Test Layout: resolve constraints and update local positions
  const handleTestLayout = useCallback(() => {
    const layoutNodes: PinLayoutNode[] = localNodes.map((n) => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      width: n.style?.width ?? 400,
      height: n.style?.height ?? 300,
    }));

    const result = resolvePinConstraints(layoutNodes, constraints);

    // Update local node positions
    setLocalNodes((prev) =>
      prev.map((n) => {
        const pos = result.positions.get(n.id);
        return pos ? { ...n, position: { x: pos.x, y: pos.y } } : n;
      })
    );
  }, [localNodes, constraints]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full relative"
      style={{ overflow: 'hidden', touchAction: 'none' }}
    >
      {/* Background SVG — dot grid */}
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <defs>
          <pattern
            id="layout-map-dots"
            width={16}
            height={16}
            patternUnits="userSpaceOnUse"
            patternTransform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}
          >
            <circle cx={1} cy={1} r={1} fill="var(--color-dot-grid)" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#layout-map-dots)" />
      </svg>

      {/* Edge SVG layer */}
      <svg style={{ position: 'absolute', inset: 0 }} className="pointer-events-none">
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {localEdges.map((edge) => {
            const sourceNode = localNodes.find((n) => n.id === edge.source);
            const targetNode = localNodes.find((n) => n.id === edge.target);
            if (!sourceNode || !targetNode) return null;

            const sourcePos = getHandlePosition(sourceNode, edge.sourceHandle);
            const targetPos = getHandlePosition(targetNode, edge.targetHandle);

            const midX = (sourcePos.x + targetPos.x) / 2;
            const midY = (sourcePos.y + targetPos.y) / 2;

            return (
              <g key={edge.id} style={{ pointerEvents: 'auto' }}>
                <line
                  x1={sourcePos.x}
                  y1={sourcePos.y}
                  x2={targetPos.x}
                  y2={targetPos.y}
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  onContextMenu={(e) => onEdgeContextMenu(e, edge.id)}
                  style={{ cursor: 'context-menu' }}
                />
                <text
                  x={midX}
                  y={midY}
                  fill="var(--color-content)"
                  fontSize={12}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {edge.label}
                </text>
              </g>
            );
          })}
        </g>

        {/* Connection preview line (screen coords, outside the transform group) */}
        {connectionDrag && (() => {
          const sourceNode = localNodes.find((n) => n.id === connectionDrag.sourceNodeId);
          if (!sourceNode) return null;

          const sourcePos = getHandlePosition(sourceNode, connectionDrag.sourceHandle);
          const screenSourceX = sourcePos.x * transform.k + transform.x;
          const screenSourceY = sourcePos.y * transform.k + transform.y;

          // Get container offset for correct SVG coordinates
          const containerRect = containerRef.current?.getBoundingClientRect();
          const offsetX = containerRect?.left ?? 0;
          const offsetY = containerRect?.top ?? 0;

          const strokeColor = connectionHint
            ? (connectionHint.valid ? 'var(--color-success, #22c55e)' : 'var(--color-error, #ef4444)')
            : 'var(--color-accent)';

          return (
            <line
              x1={screenSourceX}
              y1={screenSourceY}
              x2={connectionDrag.currentX - offsetX}
              y2={connectionDrag.currentY - offsetY}
              stroke={strokeColor}
              strokeWidth={2}
              strokeDasharray="4 4"
              style={{ pointerEvents: 'none' }}
            />
          );
        })()}
      </svg>

      {/* Node HTML layer */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
          transformOrigin: '0 0',
          pointerEvents: 'none',
        }}
      >
        {localNodes.map((node) => (
          <div
            key={node.id}
            style={{
              position: 'absolute',
              left: node.position.x,
              top: node.position.y,
              width: node.style?.width,
              height: node.style?.height,
              pointerEvents: 'auto',
            }}
            onPointerDown={(e) => handlePointerDown(node.id, e)}
          >
            <LayoutMapOrganizerNode id={node.id} data={node.data} onStartConnection={startConnection} />
          </div>
        ))}
      </div>

      {/* Header bar */}
      <div
        className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-2"
        style={{
          backgroundColor: 'var(--color-surface)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span className="text-sm font-medium text-content">Layout Map</span>
        <div className="flex gap-2">
          <button
            onClick={handleTestLayout}
            className="px-3 py-1.5 text-sm rounded bg-surface-depth-1 hover:bg-surface-depth-2 text-content border border-border transition-colors"
          >
            Test Layout
          </button>
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded bg-surface-depth-1 hover:bg-surface-depth-2 text-content border border-border transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Edge context menu */}
      {edgeContextMenu && (
        <ContextMenuPrimitive
          x={edgeContextMenu.x}
          y={edgeContextMenu.y}
          items={[
            {
              key: 'delete',
              label: 'Delete Constraint',
              danger: true,
              onClick: handleDeleteConstraint,
            },
          ]}
          onClose={() => setEdgeContextMenu(null)}
        />
      )}

      {/* Connection hint narrative */}
      {connectionHint && (
        <div
          className="fixed z-[40] pointer-events-none"
          style={{
            left: connectionHint.x,
            top: connectionHint.y - 40,
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className={`rounded-md shadow-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
              connectionHint.valid
                ? 'bg-emerald-600/90 text-white'
                : 'bg-red-600/90 text-white'
            }`}
          >
            {connectionHint.message}
          </div>
        </div>
      )}
    </div>
  );
}
