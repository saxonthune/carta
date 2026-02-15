import { useRef, useMemo, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, type CanvasRef, useNodeDrag, useNodeResize, useCanvasContext, useKeyboardShortcuts } from '../../canvas-engine/index.js';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useNodes } from '../../hooks/useNodes';
import { useEdges } from '../../hooks/useEdges';
import { useSchemas } from '../../hooks/useSchemas';
import { usePortSchemas } from '../../hooks/usePortSchemas';
import { useMapNodePipeline } from '../../hooks/useMapNodePipeline';
import { useMapEdgePipeline } from '../../hooks/useMapEdgePipeline';
import { useNarrative } from '../../hooks/useNarrative';
import { useOrganizerOperations } from '../../hooks/useOrganizerOperations';
import { useLayoutActions } from '../../hooks/useLayoutActions';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { usePinConstraints } from '../../hooks/usePinConstraints';
import { useNodeLinks } from '../../canvas-engine/useNodeLinks';
import { findContainerAt } from '../../canvas-engine/containment';
import { useMapState } from '../../hooks/useMapState';
import { useFlowTrace } from '../../hooks/useFlowTrace';
import Narrative from './Narrative';
import MapV2Toolbar from './MapV2Toolbar';
import ContextMenu from '../ui/ContextMenu';
import AddConstructMenu from './AddConstructMenu';
import ConstructEditor from '../ConstructEditor';
import ConstructDebugModal from '../modals/ConstructDebugModal';
import { MenuLevel, type MenuItem } from '../ui/ContextMenuPrimitive';
import { getRectBoundaryPoint, waypointsToPath, computeBezierPath, type Waypoint } from '../../utils/edgeGeometry.js';
import { canConnect, getHandleType, nodeContainedInOrganizer, type ConstructSchema, type ConstructNodeData, getDisplayName, type DocumentAdapter } from '@carta/domain';
import { stripHandlePrefix } from '../../utils/handlePrefix.js';
import { generateSemanticId } from '../../utils/cartaFile';
import type { LodBand } from './lod/lodPolicy.js';
import { MapV2OrganizerNode, type OrganizerChromeProps } from './MapV2OrganizerNode';
import { MapV2ConstructNode } from './MapV2ConstructNode';

interface MapV2Props {
  searchText?: string;
  onSelectionChange?: (nodes: any[]) => void;
}

// Helper to compute absolute position including parent offset and drag offset
function getAbsolutePosition(
  node: any,
  sortedNodes: any[],
  dragOffsets: Map<string, { dx: number; dy: number }>
): { x: number; y: number } {
  let x = node.position.x;
  let y = node.position.y;
  if (node.parentId) {
    const parent = sortedNodes.find(p => p.id === node.parentId);
    if (parent) {
      x += parent.position.x;
      y += parent.position.y;
      const parentOffset = dragOffsets.get(parent.id);
      if (parentOffset) {
        x += parentOffset.dx;
        y += parentOffset.dy;
      }
    }
  }
  const offset = dragOffsets.get(node.id);
  if (offset) {
    x += offset.dx;
    y += offset.dy;
  }
  return { x, y };
}


// Slim prop interface for MapV2Content
interface MapV2ContentProps {
  sortedNodes: any[];
  sortedNodesRef: React.MutableRefObject<any[]>;
  getSchema: (type: string) => any;
  getPortSchema: (type: string) => any;
  adapter: DocumentAdapter;

  // Drag offset state (lifted to parent for renderEdges)
  dragOffsets: Map<string, { dx: number; dy: number }>;
  setDragOffsets: React.Dispatch<React.SetStateAction<Map<string, { dx: number; dy: number }>>>;
  dragOffsetsRef: React.MutableRefObject<Map<string, { dx: number; dy: number }>>;

  // Interaction callbacks (defined in parent, need domain access)
  getFollowers: (leaderId: string) => string[];
  fitToChildren: (organizerId: string) => void;
  attachNodeToOrganizer: (nodeId: string, organizerId: string) => void;
  detachNodeFromOrganizer: (nodeId: string) => void;
  toggleOrganizerCollapse: (organizerId: string) => void;
  showNarrative: (state: any) => void;
  hideNarrative: () => void;

  // Event callbacks for chrome (parent handles these)
  onNodeContextMenu: (e: React.MouseEvent, nodeId: string) => void;
  onNodeDoubleClick: (nodeId: string) => void;
  onNodeMouseEnter: (nodeId: string) => void;
  onNodeMouseLeave: () => void;
  onSelectionChange: (ids: string[]) => void;

  // Organizer chrome state
  organizerChrome: OrganizerChromeProps;

  // Covered nodes (computed in parent)
  coveredNodeIds: string[];
}

// Inner component that uses canvas context - renamed to MapV2Content with slim prop interface
function MapV2Content({
  sortedNodes,
  sortedNodesRef,
  getSchema,
  getPortSchema,
  adapter,
  dragOffsets,
  setDragOffsets,
  dragOffsetsRef,
  getFollowers,
  fitToChildren,
  attachNodeToOrganizer,
  detachNodeFromOrganizer,
  toggleOrganizerCollapse,
  showNarrative,
  hideNarrative,
  onNodeContextMenu,
  onNodeDoubleClick,
  onNodeMouseEnter,
  onNodeMouseLeave,
  onSelectionChange,
  organizerChrome,
  coveredNodeIds,
}: MapV2ContentProps) {
  const { transform, isSelected, onNodePointerDown: onSelectPointerDown, selectedIds, startConnection, connectionDrag } = useCanvasContext();

  // LOD band tracking based on zoom level
  const [lodBand, setLodBand] = useState<LodBand>('normal');

  useEffect(() => {
    const zoom = transform.k;
    const band: LodBand = zoom < 0.5 ? 'marker' : 'normal';
    setLodBand(band);
  }, [transform.k]);

  // Sync selection changes to outer component
  const selectedIdsRef = useRef(selectedIds);
  useEffect(() => {
    if (selectedIds !== selectedIdsRef.current) {
      selectedIdsRef.current = selectedIds;
      onSelectionChange(selectedIds);
    }
  }, [selectedIds, onSelectionChange]);

  // Port drawer hover state
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Drag state — dragOffsets/setDragOffsets/dragOffsetsRef passed as props from parent
  const dragOriginRef = useRef<{ nodeId: string; x: number; y: number } | null>(null);
  const lastPointerEventRef = useRef<{ clientX: number; clientY: number; ctrlKey: boolean; metaKey: boolean } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Track pointer events during drag for Ctrl+drag hints
  useEffect(() => {
    if (!dragOriginRef.current) return;

    const handlePointerMove = (e: PointerEvent) => {
      lastPointerEventRef.current = { clientX: e.clientX, clientY: e.clientY, ctrlKey: e.ctrlKey, metaKey: e.metaKey };

      // Throttle narrative updates via rAF
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }

      const draggedNodeId = dragOriginRef.current?.nodeId;
      if (!draggedNodeId) return;

      rafIdRef.current = requestAnimationFrame(() => {
        rafIdRef.current = null;
        const node = sortedNodesRef.current.find(n => n.id === draggedNodeId);
        if (!node || node.type === 'organizer') return;

        const isCtrl = e.ctrlKey || e.metaKey;
        const targetOrganizerId = findContainerAt(e.clientX, e.clientY);

        if (targetOrganizerId && targetOrganizerId !== node.parentId) {
          const targetOrg = sortedNodesRef.current.find(n => n.id === targetOrganizerId);
          const orgData = targetOrg?.data as any;
          const orgName = orgData?.name ?? 'organizer';

          if (isCtrl) {
            showNarrative({ kind: 'hint', text: `Release to add to ${orgName}`, variant: 'attach', position: { x: e.clientX, y: e.clientY } });
          } else {
            showNarrative({ kind: 'hint', text: `Hold Ctrl to add to ${orgName}`, variant: 'neutral', position: { x: e.clientX, y: e.clientY } });
          }
        } else if (targetOrganizerId && targetOrganizerId === node.parentId) {
          const targetOrg = sortedNodesRef.current.find(n => n.id === targetOrganizerId);
          const orgData = targetOrg?.data as any;
          const orgName = orgData?.name ?? 'organizer';

          if (isCtrl) {
            showNarrative({ kind: 'hint', text: `Release to detach from ${orgName}`, variant: 'detach', position: { x: e.clientX, y: e.clientY } });
          }
        } else if (isCtrl && node.parentId && !targetOrganizerId) {
          const parentOrg = sortedNodesRef.current.find(n => n.id === node.parentId);
          const orgData = parentOrg?.data as any;
          const orgName = orgData?.name ?? 'organizer';
          showNarrative({ kind: 'hint', text: `Release to detach from ${orgName}`, variant: 'detach', position: { x: e.clientX, y: e.clientY } });
        } else {
          hideNarrative();
        }
      });
    };

    window.addEventListener('pointermove', handlePointerMove);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [sortedNodesRef, showNarrative, hideNarrative]);

  // Resize state
  const [resizeDeltas, setResizeDeltas] = useState<{ dw: number; dh: number } | null>(null);
  const resizeOriginRef = useRef<{ nodeId: string; width: number; height: number } | null>(null);

  // Node drag hook
  const { onPointerDown: onNodePointerDownDrag } = useNodeDrag({
    zoomScale: transform.k,
    callbacks: {
      onDragStart: (nodeId, event) => {
        const node = sortedNodesRef.current.find(n => n.id === nodeId);
        if (node) {
          dragOriginRef.current = { nodeId, x: node.position.x, y: node.position.y };
        }
        lastPointerEventRef.current = { clientX: event.clientX, clientY: event.clientY, ctrlKey: event.ctrlKey, metaKey: event.metaKey };
      },
      onDrag: (nodeId, deltaX, deltaY) => {
        const origin = dragOriginRef.current;
        if (!origin || origin.nodeId !== nodeId) return;

        // If node is selected, move all selected nodes + their wagon followers
        let idsToMove = selectedIds.includes(nodeId) ? [...selectedIds] : [nodeId];
        const allIdsToMove = new Set(idsToMove);
        for (const id of idsToMove) {
          for (const follower of getFollowers(id)) {
            allIdsToMove.add(follower);
          }
        }

        setDragOffsets(prev => {
          const next = new Map(prev);
          for (const id of allIdsToMove) {
            next.set(id, { dx: deltaX, dy: deltaY });
          }
          dragOffsetsRef.current = next;
          return next;
        });
      },
      onDragEnd: (nodeId) => {
        const node = sortedNodesRef.current.find(n => n.id === nodeId);
        const lastEvent = lastPointerEventRef.current;
        const currentOffsets = dragOffsetsRef.current;

        // Commit position changes first
        const patches: Array<{ id: string; position: { x: number; y: number } }> = [];
        for (const [id, offset] of currentOffsets) {
          const n = sortedNodesRef.current.find(n => n.id === id);
          if (n) {
            patches.push({ id, position: { x: n.position.x + offset.dx, y: n.position.y + offset.dy } });
          }
        }
        if (patches.length > 0) {
          adapter.patchNodes?.(patches, 'drag-commit');
        }

        // Auto-fit parent organizers whose children moved
        const parentOrgIds = new Set<string>();
        for (const [id] of currentOffsets) {
          const n = sortedNodesRef.current.find(node => node.id === id);
          if (n?.parentId) {
            parentOrgIds.add(n.parentId);
          }
        }
        for (const orgId of parentOrgIds) {
          fitToChildren(orgId);
        }

        // Clear routed waypoints for edges connected to moved nodes
        const movedIds = new Set(patches.map(p => p.id));
        const affectedIds = new Set<string>();

        // Add moved node IDs and their parent organizers
        for (const id of movedIds) {
          affectedIds.add(id);
          const n = sortedNodesRef.current.find(node => node.id === id);
          if (n?.parentId) {
            affectedIds.add(n.parentId);
          }
        }

        // Get current edges from adapter and clear waypoints
        const currentEdges = adapter.getEdges() as any[];
        const clearedEdgePatches = currentEdges
          .filter(e =>
            (affectedIds.has(e.source) || affectedIds.has(e.target)) &&
            e.data?.waypoints &&
            !e.id.startsWith('agg-') && !e.id.startsWith('wagon-')
          )
          .map(e => ({ id: e.id, data: { waypoints: null } }));

        if (clearedEdgePatches.length > 0) {
          adapter.patchEdgeData?.(clearedEdgePatches);
        }

        // Handle Ctrl+drag attach/detach
        if (lastEvent && node && node.type !== 'organizer') {
          const isModifier = lastEvent.ctrlKey || lastEvent.metaKey;
          if (isModifier) {
            const targetOrganizerId = findContainerAt(lastEvent.clientX, lastEvent.clientY);

            if (targetOrganizerId && targetOrganizerId !== node.parentId) {
              attachNodeToOrganizer(nodeId, targetOrganizerId);
            } else if (node.parentId && !targetOrganizerId) {
              detachNodeFromOrganizer(nodeId);
            }
          }
        }

        const emptyMap = new Map<string, { dx: number; dy: number }>();
        dragOffsetsRef.current = emptyMap;
        setDragOffsets(emptyMap);
        dragOriginRef.current = null;
        lastPointerEventRef.current = null;
        hideNarrative();
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

  // Node rendering — now with LOD support, inline editing, sequence badges, and dimmed nodes
  const nodeElements = sortedNodes
    .filter(n => !n.hidden)
    .map(n => {
      const isOrganizer = n.type === 'organizer';
      const data = n.data as Record<string, unknown>;
      const color = (data.color as string) ?? (isOrganizer ? '#7c3aed' : '#6b7280');
      const schema = !isOrganizer ? getSchema((data as any).constructType) : null;
      const constructData = data as ConstructNodeData;
      const label = !isOrganizer && schema ? getDisplayName(constructData, schema) : ((data.name as string) ?? (data.label as string) ?? n.id);
      let width = (n.style?.width as number) ?? (isOrganizer ? 300 : 200);
      let height = (n.style?.height as number) ?? (isOrganizer ? 200 : 80);

      // Apply resize deltas if this node is being resized
      if (resizingNodeId === n.id && resizeDeltas) {
        width = Math.max(100, width + resizeDeltas.dw);
        height = Math.max(60, height + resizeDeltas.dh);
      }

      // Compute absolute position (children have relative positions)
      const { x: absX, y: absY } = getAbsolutePosition(n, sortedNodes, dragOffsets);

      const selected = isSelected(n.id);
      const isCovered = coveredNodeIds.includes(n.id);
      const dimmed = (data as any).dimmed;
      const sequenceBadge = (data as any).sequenceBadge;

      // Organizer rendering - delegate to MapV2OrganizerNode
      if (isOrganizer) {
        const collapsed = (data as any).collapsed ?? false;
        const childCount = sortedNodesRef.current.filter(c => c.parentId === n.id).length;
        const layoutPinned = (data as any).layoutPinned ?? false;

        return (
          <MapV2OrganizerNode
            key={n.id}
            node={n}
            absX={absX}
            absY={absY}
            width={width}
            height={height}
            selected={selected}
            collapsed={collapsed}
            label={label}
            color={color}
            dimmed={dimmed}
            childCount={childCount}
            layoutPinned={layoutPinned}
            onPointerDown={(e) => {
              onSelectPointerDown(n.id, e);
              onNodePointerDownDrag(n.id, e);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onNodeContextMenu(e, n.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              toggleOrganizerCollapse(n.id);
            }}
            onResizePointerDown={(e) => {
              e.stopPropagation();
              onResizePointerDown(n.id, { horizontal: 'right', vertical: 'bottom' }, e);
            }}
            chrome={organizerChrome}
          />
        );
      }

      // Construct rendering - delegate to MapV2ConstructNode
      if (schema && constructData) {
        return (
          <MapV2ConstructNode
            key={n.id}
            node={n}
            absX={absX}
            absY={absY}
            width={width}
            height={height}
            selected={selected}
            label={label}
            color={color}
            schema={schema}
            constructData={constructData}
            dimmed={dimmed}
            sequenceBadge={sequenceBadge}
            lodBand={lodBand}
            isCovered={isCovered}
            adapter={adapter}
            onPointerDown={(e) => {
              onSelectPointerDown(n.id, e);
              onNodePointerDownDrag(n.id, e);
            }}
            onPointerEnter={() => {
              setHoveredNodeId(n.id);
              onNodeMouseEnter(n.id);
            }}
            onPointerLeave={() => {
              setHoveredNodeId(null);
              onNodeMouseLeave();
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onNodeContextMenu(e, n.id);
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              onNodeDoubleClick(n.id);
            }}
            onResizePointerDown={(e) => {
              e.stopPropagation();
              onResizePointerDown(n.id, { horizontal: 'right', vertical: 'bottom' }, e);
            }}
            hoveredNodeId={hoveredNodeId}
            connectionDrag={connectionDrag}
            sourcePortType={sourcePortType}
            getPortSchema={getPortSchema}
            startConnection={startConnection}
          />
        );
      }

      // Fallback for constructs without schema
      return null;
    });

  return (
    <>
      {nodeElements}
    </>
  );
}

export default function MapV2({ searchText, onSelectionChange: onSelectionChangeProp }: MapV2Props) {
  const { nodes, setNodes, getNextNodeId } = useNodes();
  const { edges, setEdges } = useEdges();
  const { schemas, getSchema } = useSchemas();
  const { getPortSchema } = usePortSchemas();
  const { narrative, showNarrative, hideNarrative } = useNarrative();
  const { adapter, ydoc } = useDocumentContext();
  const { toggleOrganizerCollapse, createOrganizer, renameOrganizer, updateOrganizerColor } = useOrganizerOperations();
  const { undo, redo, canUndo, canRedo } = useUndoRedo();
  const { constraints: pinConstraints } = usePinConstraints();

  // Track selected IDs for edge pipeline
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);

  // Notify parent of selection changes (for inspector panel)
  useEffect(() => {
    if (!onSelectionChangeProp) return;
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    onSelectionChangeProp(selectedNodes);
  }, [selectedNodeIds, nodes, onSelectionChangeProp]);

  // Drag offsets — lifted to parent so renderEdges can read them
  const [dragOffsets, setDragOffsets] = useState<Map<string, { dx: number; dy: number }>>(new Map());
  const dragOffsetsRef = useRef<Map<string, { dx: number; dy: number }>>(dragOffsets);

  // Selection mode state
  const [selectionModeActive, setSelectionModeActive] = useState(false);

  // MapState for context menus and modals
  const {
    contextMenu,
    addMenu,
    editorState,
    debugNodeId,
    setAddMenu,
    setEditorState,
    setDebugNodeId,
    onPaneContextMenu,
    onNodeContextMenu,
    closeContextMenu,
  } = useMapState();

  // Clipboard state (inlined from useClipboard)
  const [clipboard, setClipboard] = useState<any[]>([]);

  // Organizer interaction state
  const [renamingOrgId, setRenamingOrgId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [colorPickerOrgId, setColorPickerOrgId] = useState<string | null>(null);
  const [layoutMenuOrgId, setLayoutMenuOrgId] = useState<string | null>(null);
  const colorTriggerRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const layoutTriggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const ORGANIZER_COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#6366f1', '#ec4899'];

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

  // Flow trace (Alt+hover)
  const { traceResult, isTraceActive, onNodeMouseEnter, onNodeMouseLeave } = useFlowTrace(edges);

  const { sortedNodes, edgeRemap } = useMapNodePipeline({
    nodes,
    edges,
    renamingNodeId: null,
    renamingOrganizerId: null,
    isTraceActive,
    traceResult,
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
    isTraceActive,
    traceResult,
    nodes,
  });

  // ReactFlow shim for useLayoutActions
  const reactFlowShim = useMemo(() => ({
    getNodes: () => sortedNodes,
    setNodes: (updater: any) => setNodes(updater),
    getEdges: () => displayEdges,
    getIntersectingNodes: () => [], // Not used by attach/detach
  }), [sortedNodes, displayEdges, setNodes]);

  // Layout actions
  const {
    attachNodeToOrganizer,
    detachNodeFromOrganizer,
    fitToChildren,
    spreadAll,
    compactAll,
    flowLayout,
    alignNodes,
    distributeNodes,
    routeEdges,
    clearRoutes,
    applyPinLayout,
    spreadChildren,
    flowLayoutChildren,
    gridLayoutChildren,
    toggleLayoutPin,
    recursiveLayout,
  } = useLayoutActions({
    reactFlow: reactFlowShim as any,
    setNodesLocal: setNodes,
    adapter,
    selectedNodeIds,
    ydoc,
  });

  // Wagon links for leader/follower drag
  const wagonLinks = useMemo(() => {
    return sortedNodes
      .filter(n => n.type === 'organizer' && n.parentId && (n.data as any).attachedToSemanticId)
      .map(n => ({
        id: `wagon-${n.id}`,
        leader: n.parentId!, // the construct
        follower: n.id,      // the wagon organizer
      }));
  }, [sortedNodes]);

  const { getFollowers } = useNodeLinks({ links: wagonLinks });

  // Covered nodes detection (inline, no hook dependency on ReactFlow)
  const coveredNodeIds = useMemo(() => {
    const visibleOrganizers = sortedNodes.filter(n => n.type === 'organizer' && !n.hidden);
    if (visibleOrganizers.length === 0) return [];
    const covered: string[] = [];
    for (const node of sortedNodes) {
      if (node.type === 'organizer' || node.hidden || node.parentId) continue;
      const nodeW = node.measured?.width ?? node.width ?? 200;
      const nodeH = node.measured?.height ?? node.height ?? 100;
      for (const org of visibleOrganizers) {
        const orgW = (org.style?.width as number) ?? org.width ?? 200;
        const orgH = (org.style?.height as number) ?? org.height ?? 200;
        if (nodeContainedInOrganizer(
          node.position, { width: nodeW, height: nodeH },
          org.position, { width: orgW, height: orgH }
        )) {
          covered.push(node.id);
          break;
        }
      }
    }
    return covered;
  }, [sortedNodes]);

  // Organizer action handlers
  const sortedNodesRef = useRef(sortedNodes);
  useEffect(() => {
    sortedNodesRef.current = sortedNodes;
  }, [sortedNodes]);

  const handleOrgRename = useCallback((orgId: string) => {
    const node = sortedNodesRef.current.find(n => n.id === orgId);
    if (node) {
      setRenameValue((node.data as any).name ?? '');
      setRenamingOrgId(orgId);
    }
  }, []);

  const commitOrgRename = useCallback((orgId: string) => {
    const trimmed = renameValue.trim();
    if (trimmed) {
      renameOrganizer(orgId, trimmed);
    }
    setRenamingOrgId(null);
  }, [renameValue, renameOrganizer]);

  const handleOrgColorSelect = useCallback((orgId: string, color: string) => {
    updateOrganizerColor(orgId, color);
    setColorPickerOrgId(null);
  }, [updateOrganizerColor]);

  const getLayoutMenuItems = useCallback((orgId: string, isPinned: boolean): MenuItem[] => [
    { key: 'spread', label: 'Spread apart', onClick: () => { spreadChildren(orgId); setLayoutMenuOrgId(null); } },
    { key: 'flow', label: 'Arrange as flow', onClick: () => { flowLayoutChildren(orgId); setLayoutMenuOrgId(null); } },
    {
      key: 'grid', label: 'Grid',
      children: [
        { key: 'grid-1', label: '1 column', onClick: () => { gridLayoutChildren(orgId, 1); setLayoutMenuOrgId(null); } },
        { key: 'grid-2', label: '2 columns', onClick: () => { gridLayoutChildren(orgId, 2); setLayoutMenuOrgId(null); } },
        { key: 'grid-3', label: '3 columns', onClick: () => { gridLayoutChildren(orgId, 3); setLayoutMenuOrgId(null); } },
        { key: 'grid-4', label: '4 columns', onClick: () => { gridLayoutChildren(orgId, 4); setLayoutMenuOrgId(null); } },
        { key: 'grid-auto', label: 'Auto', onClick: () => { gridLayoutChildren(orgId); setLayoutMenuOrgId(null); } },
      ],
    },
    { key: 'fit', label: 'Fit to contents', onClick: () => { fitToChildren(orgId); setLayoutMenuOrgId(null); } },
    { key: 'pin', label: isPinned ? 'Unpin layout' : 'Pin layout', onClick: () => { toggleLayoutPin(orgId); setLayoutMenuOrgId(null); } },
    { key: 'tidy', label: 'Tidy all nested', onClick: () => { recursiveLayout(orgId, 'spread'); setLayoutMenuOrgId(null); } },
  ], [spreadChildren, flowLayoutChildren, gridLayoutChildren, fitToChildren, toggleLayoutPin, recursiveLayout]);

  // Close color picker and layout menu on outside click
  useEffect(() => {
    if (!colorPickerOrgId && !layoutMenuOrgId) return;
    const handleClick = (e: MouseEvent) => {
      // Close color picker if click is outside
      if (colorPickerOrgId) {
        const trigger = colorTriggerRefs.current.get(colorPickerOrgId);
        if (trigger && !trigger.contains(e.target as Node)) {
          setColorPickerOrgId(null);
        }
      }
      // Close layout menu if click is outside
      if (layoutMenuOrgId) {
        const trigger = layoutTriggerRefs.current.get(layoutMenuOrgId);
        if (trigger && !trigger.contains(e.target as Node)) {
          setLayoutMenuOrgId(null);
        }
      }
    };
    // Delay to avoid closing immediately from the triggering click
    const timer = setTimeout(() => document.addEventListener('mousedown', handleClick), 0);
    return () => { clearTimeout(timer); document.removeEventListener('mousedown', handleClick); };
  }, [colorPickerOrgId, layoutMenuOrgId]);

  // Clipboard operations (inlined from useClipboard to avoid RF dependency)
  const copyNodes = useCallback((ids?: string[]) => {
    const idsToCopy = ids || selectedNodeIds;
    if (idsToCopy.length === 0) return;
    const toCopy = sortedNodes.filter(n => idsToCopy.includes(n.id));
    setClipboard(JSON.parse(JSON.stringify(toCopy)));
  }, [sortedNodes, selectedNodeIds]);

  const pasteNodes = useCallback((x?: number, y?: number) => {
    if (clipboard.length === 0) return;
    const minX = Math.min(...clipboard.map(n => n.position.x));
    const minY = Math.min(...clipboard.map(n => n.position.y));

    let basePosition = { x: minX + 50, y: minY + 50 };
    if (x !== undefined && y !== undefined) {
      const canvasPos = canvasRef.current?.screenToCanvas(x, y);
      if (canvasPos) {
        basePosition = canvasPos;
      }
    }

    const newNodes = clipboard.map(clipNode => ({
      ...clipNode,
      id: getNextNodeId(),
      position: { x: basePosition.x + (clipNode.position.x - minX), y: basePosition.y + (clipNode.position.y - minY) },
      selected: true,
      data: { ...clipNode.data, semanticId: generateSemanticId(clipNode.data.constructType) },
    }));

    setNodes(nds => [...nds.map(n => ({ ...n, selected: false })), ...newNodes]);
  }, [clipboard, setNodes, getNextNodeId]);

  // Graph operations (inlined from useGraphOperations to avoid RF dependency)
  const addConstruct = useCallback((schema: ConstructSchema, x: number, y: number) => {
    const canvasPos = canvasRef.current?.screenToCanvas(x, y);
    if (!canvasPos) return;

    const id = getNextNodeId();
    const values: any = {};
    if (Array.isArray(schema.fields)) {
      schema.fields.forEach((field) => {
        if (field.default !== undefined) {
          values[field.name] = field.default;
        }
      });
    }

    const semanticId = generateSemanticId(schema.type);
    const newNode: any = {
      id,
      type: 'construct',
      position: canvasPos,
      data: {
        constructType: schema.type,
        semanticId,
        values,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, getNextNodeId]);

  const addNode = useCallback((x?: number, y?: number) => {
    if (x !== undefined && y !== undefined) {
      setAddMenu({ x, y });
    } else {
      setAddMenu({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    }
  }, [setAddMenu]);

  const deleteNode = useCallback((nodeIdToDelete: string) => {
    setNodes((nds) => {
      const idsToDelete = new Set([nodeIdToDelete]);
      const findDescendants = (parentId: string, depth = 0) => {
        if (depth > 20) return;
        for (const n of nds) {
          if (n.parentId === parentId && !idsToDelete.has(n.id)) {
            idsToDelete.add(n.id);
            findDescendants(n.id, depth + 1);
          }
        }
      };
      findDescendants(nodeIdToDelete);
      return nds.filter((n) => !idsToDelete.has(n.id));
    });
    setEdges((eds) => eds.filter((e) => !nodeIdToDelete || (e.source !== nodeIdToDelete && e.target !== nodeIdToDelete)));
  }, [setNodes, setEdges]);

  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    setNodes((nds) => {
      const idsToDelete = new Set(selectedNodeIds);
      for (const id of selectedNodeIds) {
        const findDescendants = (parentId: string, depth = 0) => {
          if (depth > 20) return;
          for (const n of nds) {
            if (n.parentId === parentId && !idsToDelete.has(n.id)) {
              idsToDelete.add(n.id);
              findDescendants(n.id, depth + 1);
            }
          }
        };
        findDescendants(id);
      }
      return nds.filter((n) => !idsToDelete.has(n.id));
    });
    setEdges((eds) => eds.filter((e) => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target)));
    setSelectedNodeIds([]);
  }, [selectedNodeIds, setNodes, setEdges]);

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((eds) => eds.filter((e) => e.id !== edgeId));
  }, [setEdges]);

  // Keyboard shortcuts
  useKeyboardShortcuts({
    shortcuts: [
      { key: 'z', mod: true, action: undo },
      { key: 'y', mod: true, action: redo },
      { key: 'z', mod: true, shift: true, action: redo },
      { key: 'c', mod: true, action: () => copyNodes() },
      { key: 'v', mod: true, action: () => pasteNodes() },
      { key: 'a', mod: true, action: () => {
        const selectableIds = sortedNodes.filter(n => !n.hidden && n.type !== 'organizer').map(n => n.id);
        setSelectedNodeIds(selectableIds);
      }},
      { key: 'F2', action: () => {
        if (selectedNodeIds.length === 1) {
          handleNodeDoubleClick(selectedNodeIds[0]);
        }
      }},
      { key: 'g', mod: true, action: () => {
        if (selectedNodeIds.length > 0) {
          createOrganizer(selectedNodeIds);
        }
      }},
      { key: ['Delete', 'Backspace'], action: deleteSelectedNodes },
      { key: 'v', action: () => setSelectionModeActive(prev => !prev) },
    ],
  });

  // Canvas ref + fit view on mount
  const canvasRef = useRef<CanvasRef>(null);

  // Fit view handler
  const handleFitView = useCallback(() => {
    const rects = sortedNodes
      .filter(n => !n.hidden && !n.parentId) // top-level only
      .map(n => ({
        x: n.position.x,
        y: n.position.y,
        width: (n.style?.width as number) ?? (n.type === 'organizer' ? 300 : 200),
        height: (n.style?.height as number) ?? (n.type === 'organizer' ? 200 : 80),
      }));
    canvasRef.current?.fitView(rects, 0.1);
  }, [sortedNodes]);

  // Fit view after first render
  const fitDone = useRef(false);
  useEffect(() => {
    if (sortedNodes.length > 0 && !fitDone.current && canvasRef.current) {
      handleFitView();
      fitDone.current = true;
    }
  }, [sortedNodes, handleFitView]);

  // Empty drag offsets map for box select (uses static positions, not dragging state)
  const emptyDragOffsets = useMemo(() => new Map<string, { dx: number; dy: number }>(), []);

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

  // Node double-click handler
  const handleNodeDoubleClick = useCallback((nodeId: string) => {
    const node = sortedNodes.find(n => n.id === nodeId);
    if (!node || node.type === 'organizer') return;
    const schema = getSchema((node.data as any).constructType);
    if (schema) {
      setEditorState({ open: true, editSchema: schema });
    }
  }, [sortedNodes, getSchema, setEditorState]);

  // Node context menu handler
  const handleNodeContextMenu = useCallback((e: React.MouseEvent, nodeId: string) => {
    onNodeContextMenu(e, { id: nodeId } as any);
  }, [onNodeContextMenu]);

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
    // Build node rect lookup (includes drag offsets so edges follow nodes during drag)
    const nodeRects = new Map<string, { x: number; y: number; width: number; height: number }>();
    for (const n of sortedNodes) {
      if (n.hidden) continue;
      const w = (n.style?.width as number) ?? (n.type === 'organizer' ? 300 : 200);
      const h = (n.style?.height as number) ?? (n.type === 'organizer' ? 200 : 80);
      const { x, y } = getAbsolutePosition(n, sortedNodes, dragOffsets);
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
  }, [sortedNodes, displayEdges, dragOffsets, handleEdgeClick]);

  // Connection preview rendering
  const renderConnectionPreview = useCallback((drag: any, transform: any) => {
    const sourceNode = sortedNodes.find(n => n.id === drag.sourceNodeId);
    if (!sourceNode) return null;
    const { x: absX, y: absY } = getAbsolutePosition(sourceNode, sortedNodes, dragOffsets);
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
  }, [sortedNodes, dragOffsets, canvasRef]);

  return (
    <div
      style={{ width: '100%', height: '100%', backgroundColor: 'var(--color-canvas)', position: 'relative' }}
      onContextMenu={(e) => {
        // Only fire pane context menu if clicking on the background (not on nodes/edges)
        const target = e.target as HTMLElement;
        if (target.closest('[data-node-id]') || target.closest('path')) return;
        onPaneContextMenu(e);
      }}
    >
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
            const { x, y } = getAbsolutePosition(n, sortedNodes, emptyDragOffsets);
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
        <MapV2Content
          sortedNodes={sortedNodes}
          sortedNodesRef={sortedNodesRef}
          getSchema={getSchema}
          getPortSchema={getPortSchema}
          adapter={adapter}
          dragOffsets={dragOffsets}
          setDragOffsets={setDragOffsets}
          dragOffsetsRef={dragOffsetsRef}
          getFollowers={getFollowers}
          fitToChildren={fitToChildren}
          attachNodeToOrganizer={attachNodeToOrganizer}
          detachNodeFromOrganizer={detachNodeFromOrganizer}
          toggleOrganizerCollapse={toggleOrganizerCollapse}
          showNarrative={showNarrative}
          hideNarrative={hideNarrative}
          onNodeContextMenu={handleNodeContextMenu}
          onNodeDoubleClick={handleNodeDoubleClick}
          onNodeMouseEnter={(nodeId: string) => onNodeMouseEnter({} as any, { id: nodeId } as any)}
          onNodeMouseLeave={() => onNodeMouseLeave({} as any, {} as any)}
          onSelectionChange={setSelectedNodeIds}
          organizerChrome={{
            renamingOrgId,
            renameValue,
            setRenameValue,
            setRenamingOrgId,
            handleOrgRename,
            commitOrgRename,
            colorTriggerRefs,
            layoutTriggerRefs,
            setColorPickerOrgId,
            setLayoutMenuOrgId,
          }}
          coveredNodeIds={coveredNodeIds}
        />
      </Canvas>
      <MapV2Toolbar
        undo={undo}
        redo={redo}
        canUndo={canUndo}
        canRedo={canRedo}
        onZoomIn={() => canvasRef.current?.zoomIn()}
        onZoomOut={() => canvasRef.current?.zoomOut()}
        onFitView={handleFitView}
        onSpreadAll={spreadAll}
        onCompactAll={compactAll}
        onFlowLayout={flowLayout}
        onAlignNodes={alignNodes}
        onDistributeNodes={distributeNodes}
        onRouteEdges={routeEdges}
        onClearRoutes={clearRoutes}
        onApplyPinLayout={applyPinLayout}
        selectionModeActive={selectionModeActive}
        onToggleSelectionMode={() => setSelectionModeActive(prev => !prev)}
        hasSelection={selectedNodeIds.length > 0}
        hasPinConstraints={pinConstraints.length > 0}
      />
      <Narrative narrative={narrative} onDismiss={hideNarrative} />

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          nodeId={contextMenu.nodeId}
          edgeId={contextMenu.edgeId}
          selectedCount={selectedNodeIds.length}
          onAddNode={addNode}
          onAddConstruct={(constructType, x, y) => {
            const schema = getSchema(constructType);
            if (schema) addConstruct(schema, x, y);
          }}
          onDeleteNode={deleteNode}
          onDeleteSelected={deleteSelectedNodes}
          onDeleteEdge={deleteEdge}
          onCopyNodes={copyNodes}
          onPasteNodes={pasteNodes}
          canPaste={clipboard.length > 0}
          onClose={closeContextMenu}
          onNewConstructSchema={() => setEditorState({ open: true })}
          onEditSchema={(schemaType) => {
            const schema = getSchema(schemaType);
            if (schema) setEditorState({ open: true, editSchema: schema });
          }}
          constructType={(() => {
            if (!contextMenu.nodeId) return undefined;
            const node = nodes.find(n => n.id === contextMenu.nodeId);
            return node?.type === 'construct' ? (node.data as any).constructType : undefined;
          })()}
          nodeIsConstruct={(() => {
            if (!contextMenu.nodeId) return false;
            const node = nodes.find(n => n.id === contextMenu.nodeId);
            return node?.type === 'construct';
          })()}
          nodeInOrganizer={(() => {
            if (!contextMenu.nodeId) return false;
            const node = nodes.find(n => n.id === contextMenu.nodeId);
            if (!node?.parentId) return false;
            const parent = nodes.find(n => n.id === node.parentId);
            return parent?.type === 'organizer';
          })()}
          nodeIsOrganizer={(() => {
            if (!contextMenu.nodeId) return false;
            const node = nodes.find(n => n.id === contextMenu.nodeId);
            return node?.type === 'organizer';
          })()}
          onDebugInfo={(nodeId) => { setDebugNodeId(nodeId); closeContextMenu(); }}
        />
      )}

      {/* Add Construct Menu */}
      {addMenu && (
        <AddConstructMenu
          x={addMenu.x}
          y={addMenu.y}
          onAdd={addConstruct}
          onClose={() => setAddMenu(null)}
        />
      )}

      {/* Construct Editor (Schema Editor) */}
      {editorState.open && (
        <ConstructEditor
          editSchema={editorState.editSchema}
          onClose={() => setEditorState({ open: false })}
        />
      )}

      {/* Debug Modal */}
      {debugNodeId && (() => {
        const node = nodes.find(n => n.id === debugNodeId);
        if (!node || node.type === 'organizer') return null;
        const data = node.data as any;
        const schema = schemas.find(s => s.type === data.constructType);
        return (
          <ConstructDebugModal
            node={node}
            schema={schema}
            onClose={() => setDebugNodeId(null)}
          />
        );
      })()}

      {/* Color picker popover */}
      {colorPickerOrgId && createPortal(
        <div style={{
          position: 'fixed', zIndex: 999, padding: 8, borderRadius: 8,
          display: 'flex', gap: 6,
          backgroundColor: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border)',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          top: (() => { const el = colorTriggerRefs.current.get(colorPickerOrgId); return el ? el.getBoundingClientRect().bottom + 4 : 0; })(),
          left: (() => { const el = colorTriggerRefs.current.get(colorPickerOrgId); return el ? el.getBoundingClientRect().left : 0; })(),
        }}
        onClick={(e) => e.stopPropagation()}
        >
          {ORGANIZER_COLORS.map(c => (
            <button key={c} style={{ width: 20, height: 20, borderRadius: '50%', backgroundColor: c, border: '2px solid transparent', cursor: 'pointer' }}
              onClick={() => handleOrgColorSelect(colorPickerOrgId, c)}
            />
          ))}
        </div>,
        document.body
      )}

      {/* Layout menu popover */}
      {layoutMenuOrgId && createPortal(
        <div style={{
          position: 'fixed', zIndex: 999,
          top: (() => { const el = layoutTriggerRefs.current.get(layoutMenuOrgId); return el ? el.getBoundingClientRect().bottom + 4 : 0; })(),
          left: (() => { const el = layoutTriggerRefs.current.get(layoutMenuOrgId); return el ? el.getBoundingClientRect().right - 160 : 0; })(),
        }}>
          <MenuLevel
            items={getLayoutMenuItems(
              layoutMenuOrgId,
              !!(sortedNodesRef.current.find(n => n.id === layoutMenuOrgId)?.data as any)?.layoutPinned
            )}
            onClose={() => setLayoutMenuOrgId(null)}
          />
        </div>,
        document.body
      )}
    </div>
  );
}
