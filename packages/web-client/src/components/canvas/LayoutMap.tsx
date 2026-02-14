import { useState, useEffect, useCallback, useRef } from 'react';
import { resolvePinConstraints } from '@carta/domain';
import type { PinLayoutNode, PinDirection, OrganizerNodeData } from '@carta/domain';
import { useNodes, usePinConstraints } from '../../hooks';
import LayoutMapOrganizerNode from './LayoutMapOrganizerNode';
import ContextMenuPrimitive from '../ui/ContextMenuPrimitive';
import { useViewport, useConnectionDrag, useNodeDrag, useKeyboardShortcuts, DotGrid, ConnectionPreview } from '../../canvas-engine/index.js';
import { EdgeLabel } from '../../canvas-engine/EdgeLabel.js';

interface LayoutMapProps {
  onClose: () => void;
}

export interface LocalNode {
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

export const VALID_SOURCE_HANDLES = new Set(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']);

// Direction vectors for bezier control point offsets (unit vectors per compass direction)
const DIRECTION_VECTORS: Record<string, { dx: number; dy: number }> = {
  N: { dx: 0, dy: -1 },
  NE: { dx: 0.707, dy: -0.707 },
  E: { dx: 1, dy: 0 },
  SE: { dx: 0.707, dy: 0.707 },
  S: { dx: 0, dy: 1 },
  SW: { dx: -0.707, dy: 0.707 },
  W: { dx: -1, dy: 0 },
  NW: { dx: -0.707, dy: -0.707 },
};

function getConnectionPath(
  sx: number, sy: number,
  tx: number, ty: number,
  sourceHandle: string | null | undefined
): string {
  const dist = Math.sqrt((tx - sx) ** 2 + (ty - sy) ** 2);
  const offset = Math.min(dist * 0.4, 120);

  const dir = DIRECTION_VECTORS[sourceHandle ?? ''] ?? { dx: 0, dy: 0 };

  // Control point 1: extends from source in the handle's direction
  const c1x = sx + dir.dx * offset;
  const c1y = sy + dir.dy * offset;

  // Control point 2: approaches target from the opposite side
  const c2x = tx - dir.dx * offset;
  const c2y = ty - dir.dy * offset;

  return `M ${sx},${sy} C ${c1x},${c1y} ${c2x},${c2y} ${tx},${ty}`;
}

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

export function getHandlePosition(node: LocalNode, handleId: string | null | undefined): { x: number; y: number } {
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
    mode: 'guidance' | 'valid' | 'invalid';
    anchor: 'mouse' | 'target';
  } | null>(null);

  // Viewport
  const { transform, containerRef, fitView } = useViewport({ minZoom: 0.15, maxZoom: 2 });

  // Keyboard shortcuts (minimal, ready for future expansion with box-select)
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: ['Delete', 'Backspace'],
        action: () => {
          // Delete the most recently right-clicked edge, if context menu was open
          // For now, no-op — LayoutMap doesn't have selection yet.
          // This wires up the infrastructure for when useBoxSelect is added.
        },
      },
    ],
  });

  // Refs for accessing current values inside native event listeners (Pattern 2: stable callbacks)
  const localNodesRef = useRef(localNodes);
  localNodesRef.current = localNodes;
  const transformRef = useRef(transform);
  transformRef.current = transform;

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

  // Drag origin for cumulative delta application
  const dragOriginRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);

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
          if (result.valid) {
            const rect = targetEl.getBoundingClientRect();
            setConnectionHint({
              valid: true,
              message: result.message,
              x: rect.left + rect.width / 2,
              y: rect.top,
              mode: 'valid',
              anchor: 'target',
            });
          } else {
            setConnectionHint({
              valid: false,
              message: result.message,
              x: e.clientX,
              y: e.clientY,
              mode: 'invalid',
              anchor: 'mouse',
            });
          }
          return;
        }
      }
      // Not hovering over a valid target
      setConnectionHint({
        valid: false,
        message: 'Drop on a node',
        x: e.clientX,
        y: e.clientY,
        mode: 'guidance',
        anchor: 'mouse',
      });
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

  // Update edges when constraints or node names change (Pattern 3: decouple from position changes)
  // Edge topology depends on constraints + node names, NOT positions.
  // Positions are read at render time via getHandlePosition, so edge lines
  // update visually without needing to rebuild the edge array on every drag frame.
  const nodeNameKey = localNodes.map((n) => `${n.id}:${n.data.name}`).join(',');
  useEffect(() => {
    const nodes = localNodesRef.current;
    const nameMap = new Map<string, string>();
    for (const n of nodes) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [constraints, nodeNameKey]);

  // Handle node drag using canvas-engine primitive
  const { onPointerDown: handleNodePointerDown } = useNodeDrag({
    zoomScale: transform.k,
    handleSelector: '.drag-handle',
    callbacks: {
      onDragStart: (nodeId) => {
        // Store original position for cumulative delta application
        const node = localNodesRef.current.find((n) => n.id === nodeId);
        if (node) dragOriginRef.current = { nodeId, x: node.position.x, y: node.position.y };
      },
      onDrag: (nodeId, deltaX, deltaY) => {
        const origin = dragOriginRef.current;
        if (!origin || origin.nodeId !== nodeId) return;
        setLocalNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId
              ? { ...n, position: { x: origin.x + deltaX, y: origin.y + deltaY } }
              : n
          )
        );
      },
      onDragEnd: () => {
        dragOriginRef.current = null;
      },
    },
  });

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
      style={{ overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}
    >
      {/* Background dot grid */}
      <DotGrid transform={transform} patternId="layout-map-dots" />

      {/* Edge SVG layer */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0 }} className="pointer-events-none">
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
                <EdgeLabel
                  x={midX}
                  y={midY}
                  onContextMenu={(e) => onEdgeContextMenu(e, edge.id)}
                >
                  <span style={{ fontSize: 11, color: 'var(--color-content-muted)' }}>
                    {edge.label}
                  </span>
                </EdgeLabel>
              </g>
            );
          })}
        </g>

        {/* Connection preview curve (screen coords, outside the transform group) */}
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

          const endX = connectionDrag.currentX - offsetX;
          const endY = connectionDrag.currentY - offsetY;

          const d = getConnectionPath(
            screenSourceX, screenSourceY,
            endX, endY,
            connectionDrag.sourceHandle
          );

          const strokeColor = connectionHint && connectionHint.mode !== 'guidance'
            ? (connectionHint.valid ? 'var(--color-success, #22c55e)' : 'var(--color-error, #ef4444)')
            : 'var(--color-accent)';

          return (
            <ConnectionPreview
              d={d}
              stroke={strokeColor}
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
            data-no-pan="true"
            style={{
              position: 'absolute',
              left: node.position.x,
              top: node.position.y,
              width: node.style?.width,
              height: node.style?.height,
              pointerEvents: 'auto',
            }}
            onPointerDown={(e) => handleNodePointerDown(node.id, e)}
          >
            <LayoutMapOrganizerNode id={node.id} data={node.data} onStartConnection={startConnection} />
          </div>
        ))}
      </div>

      {/* Header bar */}
      <div
        data-no-pan="true"
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

      {/* Bottom-left return button */}
      <div
        data-no-pan="true"
        className="absolute bottom-4 left-4 z-10"
      >
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm rounded bg-surface-depth-1 hover:bg-surface-depth-2 text-content border border-border transition-colors shadow-sm"
        >
          Return to Map
        </button>
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
            top: connectionHint.anchor === 'target'
              ? connectionHint.y - 8
              : connectionHint.y - 40,
            transform: 'translateX(-50%)',
          }}
        >
          <div
            className={`rounded-md shadow-md px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
              connectionHint.mode === 'valid'
                ? 'bg-emerald-600/90 text-white'
                : connectionHint.mode === 'invalid'
                  ? 'bg-red-600/90 text-white'
                  : 'bg-surface-depth-1/90 text-content-muted border border-border'
            }`}
          >
            {connectionHint.message}
          </div>
        </div>
      )}
    </div>
  );
}
