import { useState, useEffect, useCallback, useRef } from 'react';
import { resolvePinConstraints } from '@carta/domain';
import type { PinLayoutNode, PinDirection, OrganizerNodeData } from '@carta/domain';
import { useNodes, usePinConstraints } from '../../hooks';
import LayoutMapOrganizerNode from './LayoutMapOrganizerNode';
import ContextMenuPrimitive from '../ui/ContextMenuPrimitive';
import { Canvas, useCanvasContext, useNodeDrag, useKeyboardShortcuts, ConnectionPreview, type CanvasRef } from '../../canvas-engine/index.js';
import { EdgeLabel } from '../../canvas-engine/EdgeLabel.js';
import CanvasToolbar, { ToolbarButton, ToolbarDivider } from './CanvasToolbar';
import { Tooltip } from '../ui';
import { MagnifyingGlassPlus, MagnifyingGlassMinus, CornersOut, ArrowsClockwise, X } from '@phosphor-icons/react';

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

interface LayoutMapInnerProps {
  localNodes: LocalNode[];
  setLocalNodes: React.Dispatch<React.SetStateAction<LocalNode[]>>;
  localNodesRef: React.MutableRefObject<LocalNode[]>;
  constraints: any[];
  removeConstraint: (id: string) => void;
  onClose: () => void;
  handleTestLayout: () => void;
  canvasRef: React.RefObject<CanvasRef | null>;
  edgeContextMenu: { x: number; y: number; edgeId: string } | null;
  setEdgeContextMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number; edgeId: string } | null>>;
  connectionHint: {
    valid: boolean;
    message: string;
    x: number;
    y: number;
    mode: 'guidance' | 'valid' | 'invalid';
    anchor: 'mouse' | 'target';
  } | null;
  setConnectionHint: React.Dispatch<React.SetStateAction<{
    valid: boolean;
    message: string;
    x: number;
    y: number;
    mode: 'guidance' | 'valid' | 'invalid';
    anchor: 'mouse' | 'target';
  } | null>>;
}

function LayoutMapInner({
  localNodes,
  setLocalNodes,
  localNodesRef,
  constraints,
  removeConstraint,
  onClose,
  handleTestLayout,
  canvasRef,
  edgeContextMenu,
  setEdgeContextMenu,
  connectionHint,
  setConnectionHint,
}: LayoutMapInnerProps) {
  const { transform, connectionDrag, startConnection, selectedIds, clearSelection } = useCanvasContext();

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      {
        key: ['Delete', 'Backspace'],
        action: () => {
          if (selectedIds.length === 0) return;
          // Remove all constraints involving selected nodes
          for (const c of constraints) {
            if (selectedIds.includes(c.sourceOrganizerId) || selectedIds.includes(c.targetOrganizerId)) {
              removeConstraint(c.id);
            }
          }
          clearSelection();
        },
      },
    ],
  });

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
  const handleDeleteConstraint = useCallback(() => {
    if (edgeContextMenu) {
      removeConstraint(edgeContextMenu.edgeId);
      setEdgeContextMenu(null);
    }
  }, [edgeContextMenu, removeConstraint]);

  return (
    <>
      {/* Node HTML layer - rendered as Canvas children (inside transformed div) */}
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
            outline: selectedIds.includes(node.id) ? '2px solid var(--color-accent)' : undefined,
            outlineOffset: 2,
          }}
          onPointerDown={(e) => handleNodePointerDown(node.id, e)}
        >
          <LayoutMapOrganizerNode id={node.id} data={node.data} onStartConnection={startConnection} />
        </div>
      ))}

      {/* Toolbar */}
      <CanvasToolbar>
        <ToolbarButton onClick={() => canvasRef.current?.zoomIn()} tooltip="Zoom in">
          <MagnifyingGlassPlus weight="bold" size={16} />
        </ToolbarButton>
        <ToolbarButton onClick={() => canvasRef.current?.zoomOut()} tooltip="Zoom out">
          <MagnifyingGlassMinus weight="bold" size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => {
            const rects = localNodes.map((n) => ({
              x: n.position.x,
              y: n.position.y,
              width: n.style?.width ?? 400,
              height: n.style?.height ?? 300,
            }));
            canvasRef.current?.fitView(rects, 0.2);
          }}
          tooltip="Fit view"
        >
          <CornersOut weight="bold" size={16} />
        </ToolbarButton>
        <ToolbarDivider />
        <ToolbarButton onClick={handleTestLayout} tooltip="Test layout">
          <ArrowsClockwise weight="bold" size={16} />
        </ToolbarButton>
      </CanvasToolbar>

      {/* Close button */}
      <div data-no-pan="true" className="absolute bottom-4 left-4 z-10">
        <Tooltip content="Close" placement="right">
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface border border-border shadow-sm text-content-muted hover:bg-red-500 hover:border-red-500 hover:text-white transition-colors"
          >
            <X weight="bold" size={18} />
          </button>
        </Tooltip>
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
    </>
  );
}

export default function LayoutMap({ onClose }: LayoutMapProps) {
  const { nodes: allNodes } = useNodes();
  const { constraints, addConstraint, removeConstraint } = usePinConstraints();
  const canvasRef = useRef<CanvasRef>(null);

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

  // Refs for accessing current values inside native event listeners (Pattern 2: stable callbacks)
  const localNodesRef = useRef(localNodes);
  localNodesRef.current = localNodes;

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
      canvasRef.current?.fitView(rects, 0.2);
      fitViewDoneRef.current = true;
    }
  }, [localNodes]);

  // Connection drag callbacks
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
      const nameMap = new Map<string, string>();
      for (const n of localNodesRef.current) {
        nameMap.set(n.id, n.data.name || n.id);
      }
      const result = validateConnection(LAYOUT_MAP_RULES, connection, nameMap);
      return result.valid;
    },
    []
  );

  const getNodeRects = useCallback(
    () => localNodes.map((n) => ({
      id: n.id,
      x: n.position.x, y: n.position.y,
      width: n.style?.width ?? 400, height: n.style?.height ?? 300,
    })),
    [localNodes]
  );

  const handleEdgeContextMenu = useCallback((event: React.MouseEvent, edgeId: string) => {
    event.preventDefault();
    setEdgeContextMenu({ x: event.clientX, y: event.clientY, edgeId });
  }, []);

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

  return (
    <Canvas
      ref={canvasRef}
      viewportOptions={{ minZoom: 0.15, maxZoom: 2 }}
      connectionDrag={{ onConnect: handleConnect, isValidConnection }}
      boxSelect={{ getNodeRects }}
      patternId="layout-map-dots"
      onBackgroundPointerDown={(e) => {
        if (!e.shiftKey) {
          canvasRef.current?.clearSelection();
        }
      }}
      className="w-full h-full"
      renderEdges={() => (
        <>
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
                  onContextMenu={(e) => handleEdgeContextMenu(e, edge.id)}
                  style={{ cursor: 'context-menu' }}
                />
                <EdgeLabel
                  x={midX}
                  y={midY}
                  onContextMenu={(e) => handleEdgeContextMenu(e, edge.id)}
                >
                  <span style={{ fontSize: 11, color: 'var(--color-content-muted)' }}>
                    {edge.label}
                  </span>
                </EdgeLabel>
              </g>
            );
          })}
        </>
      )}
      renderConnectionPreview={(drag, transform) => {
        const sourceNode = localNodes.find((n) => n.id === drag.sourceNodeId);
        if (!sourceNode) return null;

        const sourcePos = getHandlePosition(sourceNode, drag.sourceHandle);
        const screenSourceX = sourcePos.x * transform.k + transform.x;
        const screenSourceY = sourcePos.y * transform.k + transform.y;

        // Get container offset for correct SVG coordinates - not needed as drag coords are already screen-relative
        const endX = drag.currentX;
        const endY = drag.currentY;

        const d = getConnectionPath(
          screenSourceX, screenSourceY,
          endX, endY,
          drag.sourceHandle
        );

        // Use connectionHint to determine stroke color
        const strokeColor = connectionHint && connectionHint.mode !== 'guidance'
          ? (connectionHint.valid ? 'var(--color-success, #22c55e)' : 'var(--color-error, #ef4444)')
          : 'var(--color-accent)';

        return (
          <ConnectionPreview
            d={d}
            stroke={strokeColor}
          />
        );
      }}
    >
      <LayoutMapInner
        localNodes={localNodes}
        setLocalNodes={setLocalNodes}
        localNodesRef={localNodesRef}
        constraints={constraints}
        removeConstraint={removeConstraint}
        onClose={onClose}
        handleTestLayout={handleTestLayout}
        canvasRef={canvasRef}
        edgeContextMenu={edgeContextMenu}
        setEdgeContextMenu={setEdgeContextMenu}
        connectionHint={connectionHint}
        setConnectionHint={setConnectionHint}
      />
    </Canvas>
  );
}
