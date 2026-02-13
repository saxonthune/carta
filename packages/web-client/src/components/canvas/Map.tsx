import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  ControlButton,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  SelectionMode,
  useReactFlow,
  type Node,
  type Edge,
  type OnSelectionChangeParams,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
} from '@xyflow/react';
import {
  ArrowUUpLeft,
  ArrowUUpRight,
  Plus,
  Minus,
  CornersOut,
  CursorClick,
  PencilSimple,
  CopySimple,
  Trash,
  Warning,
  GridFour,
} from '@phosphor-icons/react';
import { useNodes } from '../../hooks/useNodes';
import { useEdges } from '../../hooks/useEdges';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useSchemas } from '../../hooks/useSchemas';
import { useSchemaGroups } from '../../hooks/useSchemaGroups';
import { usePortSchemas } from '../../hooks/usePortSchemas';
import { usePages } from '../../hooks/usePages';
import { usePinConstraints } from '../../hooks/usePinConstraints';
import CustomNode from './CustomNode';
import ConstructNode from './ConstructNode';
import OrganizerNode from './OrganizerNode';
import ContextMenu, { type RelatedConstructOption } from '../ui/ContextMenu';
import { Tooltip } from '../ui';
import { useMapState } from '../../hooks/useMapState';
import AddConstructMenu from './AddConstructMenu';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useGraphOperations } from '../../hooks/useGraphOperations';
import { useConnections } from '../../hooks/useConnections';
import { useClipboard } from '../../hooks/useClipboard';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import { useEdgeCleanup } from '../../hooks/useEdgeCleanup';
import type { ConstructValues, ConstructNodeData, OrganizerNodeData } from '@carta/domain';
import { nodeContainedInOrganizer, getDisplayName, resolveNodeColor } from '@carta/domain';
import { usePresentation } from '../../hooks/usePresentation';
import { computeEdgeAggregation, filterInvalidEdges } from '../../presentation/index';
import { useOrganizerOperations } from '../../hooks/useOrganizerOperations';
// getNodeDimensions unused after disabling orthogonal routing
import ConstructEditor from '../ConstructEditor';
import DynamicAnchorEdge from './DynamicAnchorEdge';
import ConstructDebugModal from '../modals/ConstructDebugModal';
import { useEdgeBundling, type BundleData } from '../../hooks/useEdgeBundling';
import { useFlowTrace } from '../../hooks/useFlowTrace';
// useLodBand only needed inside ConstructNode, not at Map level
// ZoomDebug disabled — causes re-renders on every zoom/pan frame (useStore + mousemove listener)
// import { ZoomDebug } from '../ui/ZoomDebug';
import { useNarrative } from '../../hooks/useNarrative';
import Narrative from './Narrative';
import { useLayoutActions } from '../../hooks/useLayoutActions';
import ToolbarLayoutFlyouts from './ToolbarLayoutFlyouts';
import LayoutView from './LayoutView';

const nodeTypes = {
  custom: CustomNode,
  construct: ConstructNode,
  'organizer': OrganizerNode,
};

const edgeTypes = {
  bundled: DynamicAnchorEdge,
};

// Restrict dragging to header only - allows clicking fields to edit
const NODE_DRAG_HANDLE = '.node-drag-handle';

// Edge color from CSS variable, updated on theme change
function useEdgeColor() {
  const [color, setColor] = useState(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--edge-default-color').trim() || '#94a3b8'
  );
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setColor(getComputedStyle(document.documentElement).getPropertyValue('--edge-default-color').trim() || '#94a3b8');
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return color;
}

export interface MapProps {
  title: string;
  onNodesEdgesChange: (nodes: Node[], edges: Edge[]) => void;
  onSelectionChange?: (selectedNodes: Node[]) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  searchText?: string;
}

export default function Map({ title, onNodesEdgesChange, onSelectionChange, onNodeDoubleClick, searchText }: MapProps) {
  const { adapter, ydoc } = useDocumentContext();
  const { nodes, setNodes, setNodesLocal, suppressUpdates } = useNodes();
  const { edges, setEdges } = useEdges();
  const { schemas, getSchema } = useSchemas();
  const { getPortSchema } = usePortSchemas();

  // Auto-cleanup edges when schemas change (port definitions may have changed)
  const { revalidateEdges } = useEdgeCleanup();
  const schemasRef = useRef(schemas);
  useEffect(() => {
    if (schemasRef.current !== schemas) {
      schemasRef.current = schemas;
      // Defer to next frame to let node handles update first
      requestAnimationFrame(() => {
        const removed = revalidateEdges();
        if (removed > 0) {
          console.debug(`[edge-cleanup] Auto-removed ${removed} edges with invalid port references`);
        }
      });
    }
  }, [schemas, revalidateEdges]);
  const { pages, activePage, setActivePage, createPage, copyNodesToPage } = usePages();
  const reactFlow = useReactFlow();
  const { constraints: pinConstraints } = usePinConstraints();

  const edgeColor = useEdgeColor();
  const defaultEdgeOptions = useMemo(() => ({
    type: 'bundled',
    style: {
      strokeWidth: 1.5,
      stroke: edgeColor,
    },
  }), [edgeColor]);
  const { schemaGroups } = useSchemaGroups();
  const { getViewport, setViewport } = useReactFlow();

  // Save/restore viewport per page across page switches
  const pageViewports = useRef(new globalThis.Map<string, { x: number; y: number; zoom: number }>());
  const prevPageRef = useRef<string | undefined>(activePage);

  useEffect(() => {
    if (activePage && prevPageRef.current !== activePage) {
      // Save viewport of the page we're leaving
      if (prevPageRef.current) {
        pageViewports.current.set(prevPageRef.current, getViewport());
      }
      prevPageRef.current = activePage;

      // Restore saved viewport or fit to view
      const saved = pageViewports.current.get(activePage);
      if (saved) {
        setViewport(saved, { duration: 0 });
      } else {
        // Small delay so React Flow has the new nodes before fitting
        requestAnimationFrame(() => {
          reactFlow.fitView({ duration: 0 });
        });
      }
    }
  }, [activePage, getViewport, setViewport, reactFlow]);

  // Presentation model for collapse/hide logic and edge remapping
  const { processedNodes: nodesWithHiddenFlags, edgeRemap } = usePresentation(nodes, edges);

  // Flow trace: Alt+hover to highlight forward flow
  const { traceResult, isTraceActive, onNodeMouseEnter, onNodeMouseLeave } = useFlowTrace(edges);


  // Narrative pill for edge click info
  const { narrative, showNarrative, hideNarrative } = useNarrative();

  // Custom zoom with smaller step (1.15x instead of default 1.2x)
  const customZoomIn = useCallback(() => {
    const { x, y, zoom } = getViewport();
    setViewport({ x, y, zoom: Math.min(zoom * 1.15, 2) }, { duration: 200 });
  }, [getViewport, setViewport]);

  const customZoomOut = useCallback(() => {
    const { x, y, zoom } = getViewport();
    setViewport({ x, y, zoom: Math.max(zoom / 1.15, 0.15) }, { duration: 200 });
  }, [getViewport, setViewport]);

  // Create React Flow change handlers that work with the store
  const isDraggingRef = useRef(false);
  const draggedNodesRef = useRef<Set<string>>(new Set());
  const resizingNodeIds = useRef<Set<string>>(new Set());
  // Suppress expandParent→Yjs writeback during layout actions (fitToChildren, etc.)
  const suppressExpandParentWritebackRef = useRef<Set<string>>(new Set());

  // Ctrl+drag visual feedback (DOM class toggle, no re-renders)
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const ctrlDragActiveRef = useRef(false);


  const onNodesChange = useCallback((changes: NodeChange[]) => {
    const dragEndChanges: NodeChange[] = [];
    const commitPositions: { id: string; position: { x: number; y: number } }[] = [];
    const dimensionChanges: NodeChange[] = [];

    for (const change of changes) {
      if (change.type === 'position' && change.dragging) {
        // RF already updated its internal store in uncontrolled mode — skip
        continue;
      } else if (change.type === 'position' && !change.dragging && change.position) {
        // Drag end — sync final position to local state + Yjs
        dragEndChanges.push(change);
        commitPositions.push({ id: change.id, position: change.position });
      } else if (change.type === 'dimensions') {
        if (change.resizing) {
          resizingNodeIds.current.add(change.id);
        } else if (resizingNodeIds.current.has(change.id)) {
          // Manual resize ended — persist dimensions to Yjs
          resizingNodeIds.current.delete(change.id);
          const node = reactFlow.getNode(change.id);
          const style = node?.style as Record<string, unknown> | undefined;
          if (style && (style.width != null || style.height != null)) {
            adapter.patchNodes?.([{ id: change.id, style: { width: style.width, height: style.height } }]);
          }
        } else if (organizerIdsRef.current.has(change.id) && change.dimensions) {
          // expandParent (or other source) grew an organizer — persist to Yjs
          // BUT skip entirely if a layout action just explicitly set this organizer's size
          if (suppressExpandParentWritebackRef.current.has(change.id)) {
            suppressExpandParentWritebackRef.current.delete(change.id);
            continue; // skip both Yjs writeback AND local dimension update
          }
          adapter.patchNodes?.([{
            id: change.id,
            style: { width: change.dimensions.width, height: change.dimensions.height },
          }]);
        }
        // Apply dimension changes locally (unless skipped by continue above)
        dimensionChanges.push(change);
      }
      // Selection handled by RF internally + onSelectionChange callback
    }

    if (dragEndChanges.length > 0) {
      setNodesLocal(nds => applyNodeChanges(dragEndChanges, nds));
    }
    if (dimensionChanges.length > 0) {
      setNodesLocal(nds => applyNodeChanges(dimensionChanges, nds));
    }
    if (commitPositions.length > 0) {
      adapter.patchNodes?.(commitPositions);

      // Clear routed waypoints for edges connected to moved nodes
      // Also resolve child-to-parent: if a node inside an organizer moves, clear edges connected to the organizer
      const movedIds = new Set(commitPositions.map(p => p.id));
      const rfNodes = reactFlow.getNodes();
      const affectedIds = new Set<string>();

      // Add moved node IDs and their parent organizers (if any)
      for (const id of movedIds) {
        affectedIds.add(id);
        const node = rfNodes.find(n => n.id === id);
        if (node?.parentId) {
          affectedIds.add(node.parentId);
        }
      }

      // Clear waypoints from Yjs (sync effect will propagate to React Flow)
      // Skip synthetic edges that don't exist in Yjs
      const clearedEdgePatches = reactFlow.getEdges()
        .filter(e =>
          (affectedIds.has(e.source) || affectedIds.has(e.target)) &&
          e.data?.waypoints &&
          !e.id.startsWith('agg-') && !e.id.startsWith('wagon-')
        )
        .map(e => ({ id: e.id, data: { waypoints: null } }));

      if (clearedEdgePatches.length > 0) {
        adapter.patchEdgeData?.(clearedEdgePatches);
      }
    }
  }, [setNodesLocal, adapter, reactFlow]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    // RF handles edge changes internally. Only persist removals to Yjs.
    const removals = changes.filter(c => c.type === 'remove');
    if (removals.length > 0) {
      setEdges(eds => applyEdgeChanges(removals, eds));
    }
  }, [setEdges]);

  // UI state (menus, modals, mouse tracking)
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
    onSelectionContextMenu,
    onEdgeContextMenu,
    onMouseDown,
    closeContextMenu,
    onPaneClick,
  } = useMapState();

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [selectionModeActive, setSelectionModeActive] = useState(false);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [renamingOrganizerId, setRenamingOrganizerId] = useState<string | null>(null);
  const [showLayoutView, setShowLayoutView] = useState(false);
  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  // Suppress unused variable warning
  void title; // Title is now managed by the document store

  // Use extracted hooks
  const {
    isValidConnection,
    onConnect,
    handleEdgesDelete
  } = useConnections();

  const {
    copyNodes,
    pasteNodes,
    canPaste
  } = useClipboard({ selectedNodeIds });

  const {
    addConstruct,
    addRelatedConstruct,
    addNode,
    deleteNode,
    deleteSelectedNodes,
    renameNode,
    updateNodeValues,
    updateNodeInstanceColor,
  } = useGraphOperations({
    selectedNodeIds,
    setSelectedNodeIds,
    setRenamingNodeId,
    setAddMenu,
  });

  const startRename = useCallback(() => {
    if (selectedNodeIds.length === 1) {
      setRenamingNodeId(selectedNodeIds[0]);
    }
  }, [selectedNodeIds]);

  // Organizer operations from dedicated hook (uses pure geometry functions)
  const {
    createOrganizer: createOrganizerFromIds,
    createAttachedOrganizer,
    detachFromOrganizer,
    toggleOrganizerCollapse,
    updateOrganizerColor,
    renameOrganizer,
  } = useOrganizerOperations();

  // Wrapper for createOrganizer that uses current selectedNodeIds
  const createOrganizer = useCallback(() => {
    createOrganizerFromIds(selectedNodeIds);
  }, [createOrganizerFromIds, selectedNodeIds]);

  // Remove a node from its organizer (same as detach)
  const removeFromOrganizer = useCallback((nodeId: string) => {
    detachFromOrganizer(nodeId);
  }, [detachFromOrganizer]);

  // Attach an organizer (wagon) to a construct
  const handleAttachOrganizer = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'construct') return;
    const data = node.data as ConstructNodeData;
    const schema = schemas.find(s => s.type === data.constructType);
    const resolvedColor = schema ? resolveNodeColor(schema, data) : undefined;
    createAttachedOrganizer(nodeId, data.semanticId, resolvedColor);
  }, [nodes, createAttachedOrganizer, schemas]);

  // Select all construct nodes on current level
  const selectAll = useCallback(() => {
    const allIds = nodes.filter(n => n.type === 'construct' && !n.hidden).map(n => n.id);
    reactFlow.setNodes(nds => nds.map(n => ({
      ...n,
      selected: allIds.includes(n.id),
    })));
    setSelectedNodeIds(allIds);
  }, [nodes, reactFlow, setSelectedNodeIds]);

  // Toggle selection mode
  const toggleSelectionMode = useCallback(() => {
    setSelectionModeActive(prev => {
      if (prev) {
        // Turning off — clear selection
        reactFlow.setNodes(nds => nds.map(n => ({ ...n, selected: false })));
        setSelectedNodeIds([]);
      }
      return !prev;
    });
  }, [reactFlow]);

  // Use keyboard shortcuts hook
  useKeyboardShortcuts({
    selectedNodeIds,
    canPaste,
    undo,
    redo,
    copyNodes,
    pasteNodes,
    deleteSelectedNodes,
    startRename,
    createOrganizer,
    selectAll,
    toggleSelectionMode,
  });

  // Notify parent of nodes/edges changes for export
  useEffect(() => {
    onNodesEdgesChange(nodes, edges);
  }, [nodes, edges, onNodesEdgesChange]);

  // Get related constructs options for a node (context menu specific)
  const getRelatedConstructsForNode = useCallback(
    (nodeIdToCheck: string): RelatedConstructOption[] => {
      const node = nodes.find(n => n.id === nodeIdToCheck);
      if (!node || node.type !== 'construct') return [];

      const data = node.data as ConstructNodeData;
      const schema = getSchema(data.constructType);
      if (!schema || !schema.suggestedRelated || schema.suggestedRelated.length === 0) return [];

      const result: RelatedConstructOption[] = [];
      for (const related of schema.suggestedRelated) {
        const relatedSchema = getSchema(related.constructType);
        if (relatedSchema) {
          result.push({
            constructType: related.constructType,
            displayName: relatedSchema.displayName,
            color: relatedSchema.color,
            fromPortId: related.fromPortId,
            toPortId: related.toPortId,
            label: related.label,
            groupId: relatedSchema.groupId,
          });
        }
      }
      return result;
    },
    [nodes, getSchema]
  );

  // Get all construct options for pane menu
  const allConstructOptions = useMemo(() => {
    return schemas.map(schema => ({
      constructType: schema.type,
      displayName: schema.displayName,
      color: schema.color,
      groupId: schema.groupId,
    }));
  }, [schemas]);

  // Context menu specific edge deletion
  const deleteEdge = useCallback(
    (edgeIdToDelete: string) => {
      const edgeToDelete = edges.find((e) => e.id === edgeIdToDelete);
      if (edgeToDelete) {
        // Remove from edges array
        setEdges((eds) => eds.filter((e) => e.id !== edgeIdToDelete));
        // Remove connection data from nodes
        handleEdgesDelete([edgeToDelete]);
      }
    },
    [edges, setEdges, handleEdgesDelete]
  );

  // Copy selected nodes to a newly created page
  const handleCopyNodesToNewPage = useCallback(
    (nodeIds: string[]) => {
      const sourcePageName = pages.find(l => l.id === activePage)?.name ?? 'Unknown';
      const newPage = createPage(`Copied selection from ${sourcePageName}`);
      copyNodesToPage(nodeIds, newPage.id);
      setActivePage(newPage.id);
    },
    [createPage, copyNodesToPage, setActivePage, pages, activePage]
  );

  // Layout operations (both organizer-scoped and top-level)
  const {
    spreadChildren,
    flowLayoutChildren,
    gridLayoutChildren,
    fitToChildren,
    attachNodeToOrganizer,
    detachNodeFromOrganizer,
    spreadSelected,
    spreadAll,
    compactAll,
    alignNodes,
    distributeNodes,
    flowLayout,
    routeEdges,
    clearRoutes,
    applyPinLayout,
    recursiveLayout,
    toggleLayoutPin,
  } = useLayoutActions({
    reactFlow,
    setNodesLocal,
    adapter,
    selectedNodeIds,
    ydoc,
    suppressExpandParentWriteback: suppressExpandParentWritebackRef,
  });

  // Handle adding construct from pane context menu
  const handleAddConstructFromMenu = useCallback(
    (constructType: string, x: number, y: number) => {
      const schema = getSchema(constructType);
      if (schema) {
        addConstruct(schema, x, y);
      }
    },
    [getSchema, addConstruct]
  );

  const handleSelectionChange = useCallback(
    ({ nodes: selectedNodes }: OnSelectionChangeParams) => {
      setSelectedNodeIds(selectedNodes.map((n) => n.id));
      if (selectedNodes.length !== 1) {
        setRenamingNodeId(null);
      }
      onSelectionChange?.(selectedNodes);
    },
    [onSelectionChange]
  );

  const handleNodeDoubleClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      onNodeDoubleClick?.(node.id);
    },
    [onNodeDoubleClick]
  );

  // Build narrative endpoints for a single edge
  const buildEdgeEndpoints = useCallback((edge: Edge) => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const targetNode = nodes.find(n => n.id === edge.target);
    if (!sourceNode || !targetNode) return null;

    const sourceData = sourceNode.data as ConstructNodeData;
    const targetData = targetNode.data as ConstructNodeData;
    const sourceSchema = sourceNode.type === 'construct' ? getSchema(sourceData.constructType) : undefined;
    const targetSchema = targetNode.type === 'construct' ? getSchema(targetData.constructType) : undefined;

    const sourceName = sourceNode.type === 'construct' ? getDisplayName(sourceData, sourceSchema) : (sourceData.label as string ?? edge.source);
    const targetName = targetNode.type === 'construct' ? getDisplayName(targetData, targetSchema) : (targetData.label as string ?? edge.target);
    const sourceType = sourceSchema?.displayName ?? sourceNode.type ?? '';
    const targetType = targetSchema?.displayName ?? targetNode.type ?? '';

    const isRemapped = edge.sourceHandle === 'group-connect' || edge.targetHandle === 'group-connect';
    const sourcePortConfig = !isRemapped ? sourceSchema?.ports?.find(p => p.id === edge.sourceHandle) : undefined;
    const targetPortConfig = !isRemapped ? targetSchema?.ports?.find(p => p.id === edge.targetHandle) : undefined;
    const sourcePortSchema = sourcePortConfig ? getPortSchema(sourcePortConfig.portType) : undefined;
    const targetPortSchema = targetPortConfig ? getPortSchema(targetPortConfig.portType) : undefined;
    const sourcePortLabel = sourcePortConfig?.label ?? edge.sourceHandle ?? '';
    const targetPortLabel = targetPortConfig?.label ?? edge.targetHandle ?? '';
    const sourcePortColor = sourcePortSchema?.color ?? '#94a3b8';
    const targetPortColor = targetPortSchema?.color ?? '#94a3b8';

    const sourcePortPolarity = sourcePortSchema?.polarity;
    const isSourceOutput = sourcePortPolarity === 'source' || sourcePortPolarity === 'relay';

    const from = isSourceOutput || !sourcePortPolarity ? {
      name: sourceName, schemaType: sourceType, portLabel: sourcePortLabel, portColor: sourcePortColor,
    } : {
      name: targetName, schemaType: targetType, portLabel: targetPortLabel, portColor: targetPortColor,
    };
    const to = isSourceOutput || !sourcePortPolarity ? {
      name: targetName, schemaType: targetType, portLabel: targetPortLabel, portColor: targetPortColor,
    } : {
      name: sourceName, schemaType: sourceType, portLabel: sourcePortLabel, portColor: sourcePortColor,
    };

    return { from, to };
  }, [nodes, getSchema, getPortSchema]);

  // Ref for bundleMap — populated after useEdgeBundling below, accessed in click handler
  const bundleMapRef = useRef<globalThis.Map<string, Edge[]>>(new globalThis.Map());

  // Edge click: select both source and target nodes + show narrative
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      const endpointIds = [edge.source, edge.target];
      reactFlow.setNodes(nds => nds.map(n => ({
        ...n,
        selected: endpointIds.includes(n.id),
      })));
      setSelectedNodeIds(endpointIds);

      const bundleData = edge.data as BundleData | undefined;
      const bundledEdgeIds = bundleData?.bundledEdgeIds;

      // Bundled edge: show all connections
      if (bundledEdgeIds && bundledEdgeIds.length > 1) {
        // Look up original edges from the bundle map
        const originalEdges: Edge[] = [];
        for (const [, edgeGroup] of bundleMapRef.current) {
          for (const e of edgeGroup) {
            if (bundledEdgeIds.includes(e.id)) {
              originalEdges.push(e);
            }
          }
        }

        const connections = originalEdges
          .map(e => buildEdgeEndpoints(e))
          .filter((ep): ep is NonNullable<typeof ep> => ep !== null);

        if (connections.length > 0) {
          showNarrative({
            kind: 'bundle',
            connections,
            position: { x: event.clientX, y: event.clientY },
            anchor: 'above',
          });
        }
        return;
      }

      // Single edge narrative
      const endpoints = buildEdgeEndpoints(edge);
      if (!endpoints) return;

      showNarrative({
        kind: 'edge',
        from: endpoints.from, to: endpoints.to,
        position: { x: event.clientX, y: event.clientY },
        anchor: 'above',
      });
    },
    [reactFlow, setSelectedNodeIds, buildEdgeEndpoints, showNarrative]
  );

  // Pane click: dismiss narrative + original handler
  const handlePaneClick = useCallback(() => {
    hideNarrative();
    onPaneClick();
  }, [hideNarrative, onPaneClick]);

  // Update parent with fresh node data whenever nodes change (to keep InstanceEditor in sync)
  useEffect(() => {
    if (selectedNodeIds.length > 0) {
      const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
      onSelectionChange?.(selectedNodes);
    }
  }, [nodes, selectedNodeIds, onSelectionChange]);

  // Count children per parent node (organizers)
  const childCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of nodes) {
      if (node.parentId) {
        counts[node.parentId] = (counts[node.parentId] || 0) + 1;
      }
    }
    return counts;
  }, [nodes]);

  // Set of organizer IDs for expandParent assignment
  const organizerIds = useMemo(() => new Set(
    nodesWithHiddenFlags.filter(n => n.type === 'organizer').map(n => n.id)
  ), [nodesWithHiddenFlags]);

  const organizerIdsRef = useRef(organizerIds);
  organizerIdsRef.current = organizerIds;

  // Stable callback refs — update every render without triggering re-render
  const renameNodeRef = useRef(renameNode);
  renameNodeRef.current = renameNode;
  const updateNodeValuesRef = useRef(updateNodeValues);
  updateNodeValuesRef.current = updateNodeValues;
  const updateNodeInstanceColorRef = useRef(updateNodeInstanceColor);
  updateNodeInstanceColorRef.current = updateNodeInstanceColor;
  const toggleOrganizerCollapseRef = useRef(toggleOrganizerCollapse);
  toggleOrganizerCollapseRef.current = toggleOrganizerCollapse;
  const spreadChildrenRef = useRef(spreadChildren);
  spreadChildrenRef.current = spreadChildren;
  const flowLayoutChildrenRef = useRef(flowLayoutChildren);
  flowLayoutChildrenRef.current = flowLayoutChildren;
  const gridLayoutChildrenRef = useRef(gridLayoutChildren);
  gridLayoutChildrenRef.current = gridLayoutChildren;
  const fitToChildrenRef = useRef(fitToChildren);
  fitToChildrenRef.current = fitToChildren;
  const updateOrganizerColorRef = useRef(updateOrganizerColor);
  updateOrganizerColorRef.current = updateOrganizerColor;
  const renameOrganizerRef = useRef(renameOrganizer);
  renameOrganizerRef.current = renameOrganizer;
  const recursiveLayoutRef = useRef(recursiveLayout);
  recursiveLayoutRef.current = recursiveLayout;
  const toggleLayoutPinRef = useRef(toggleLayoutPin);
  toggleLayoutPinRef.current = toggleLayoutPin;

  // One stable dispatch object shared by ALL nodes (never changes identity)
  const nodeActions = useMemo(() => ({
    onRename: (nodeId: string, newName: string) => renameNodeRef.current(nodeId, newName),
    onValuesChange: (nodeId: string, values: ConstructValues) => updateNodeValuesRef.current(nodeId, values),
    onInstanceColorChange: (nodeId: string, color: string | null) => updateNodeInstanceColorRef.current(nodeId, color),
    onToggleCollapse: (nodeId: string) => toggleOrganizerCollapseRef.current(nodeId),
    onSpreadChildren: (nodeId: string) => spreadChildrenRef.current(nodeId),
    onFlowLayoutChildren: (nodeId: string) => flowLayoutChildrenRef.current(nodeId),
    onGridLayoutChildren: (nodeId: string, cols?: number) => gridLayoutChildrenRef.current(nodeId, cols),
    onFitToChildren: (nodeId: string) => fitToChildrenRef.current(nodeId),
    onUpdateOrganizerColor: (nodeId: string, color: string) => updateOrganizerColorRef.current(nodeId, color),
    onRenameOrganizer: (nodeId: string, newName: string) => renameOrganizerRef.current(nodeId, newName),
    onRecursiveLayout: (nodeId: string, strategy: 'spread' | 'grid' | 'flow') => recursiveLayoutRef.current(nodeId, strategy),
    onToggleLayoutPin: (nodeId: string) => toggleLayoutPinRef.current(nodeId),
  }), []);

  // Cache previous output so we can reuse node references when overlay data hasn't changed.
  // This prevents RF from re-rendering all 50 nodes when only 1-2 actually changed.
  const prevNodesCache = useRef<globalThis.Map<string, Node>>(new globalThis.Map());
  // Stable rename callbacks for organizers — avoids new closures per render
  const setRenamingOrganizerIdRef = useRef(setRenamingOrganizerId);
  setRenamingOrganizerIdRef.current = setRenamingOrganizerId;
  const orgRenameStart = useMemo(() => (id: string) => setRenamingOrganizerIdRef.current(id), []);
  const orgRenameStop = useMemo(() => () => setRenamingOrganizerIdRef.current(null), []);

  const nodesWithCallbacks = useMemo(() => {
    // Pre-compute which nodes should expand their parent
    // Includes: nodes directly in organizers, AND wagons whose construct is in an organizer
    const nodeById = new globalThis.Map(nodesWithHiddenFlags.map(n => [n.id, n] as [string, Node]));
    const shouldExpandParent = (node: Node): boolean => {
      if (!node.parentId) return false;
      if (organizerIds.has(node.parentId)) return true;
      const parent = nodeById.get(node.parentId);
      if (parent?.parentId && organizerIds.has(parent.parentId)) return true;
      return false;
    };

    const cache = prevNodesCache.current;
    const newCache = new globalThis.Map<string, Node>();

    const result = nodesWithHiddenFlags.map((node) => {
      const prev = cache.get(node.id);
      const prevData = prev?.data as Record<string, unknown> | undefined;

      if (node.type === 'organizer') {
        const childCount = childCountMap[node.id] || 0;
        const isDimmed = isTraceActive && !traceResult?.nodeDistances.has(node.id);
        const isRenaming = renamingOrganizerId === node.id;

        // Reuse previous reference if overlay data unchanged and base node unchanged
        if (prev && prev.type === 'organizer' &&
            prevData?.childCount === childCount &&
            prevData?.isDimmed === isDimmed &&
            prevData?.isRenaming === isRenaming &&
            (prev as unknown as { _baseRef: unknown })._baseRef === node) {
          newCache.set(node.id, prev);
          return prev;
        }

        const newNode = {
          ...node,
          dragHandle: NODE_DRAG_HANDLE,
          _baseRef: node, // track base node identity for cache hit detection
          data: {
            ...node.data,
            childCount,
            isDimmed,
            nodeActions,
            isRenaming,
            onStartRenaming: orgRenameStart.bind(null, node.id),
            onStopRenaming: orgRenameStop,
          },
        } as Node;
        newCache.set(node.id, newNode);
        return newNode;
      }

      // Construct node
      const isRenaming = node.id === renamingNodeId;
      const dimmed = isTraceActive && !traceResult?.nodeDistances.has(node.id);
      const expandParent = shouldExpandParent(node) ? true : undefined;

      if (prev && prev.type !== 'organizer' &&
          prevData?.isRenaming === isRenaming &&
          prevData?.dimmed === dimmed &&
          prev.expandParent === expandParent &&
          (prev as unknown as { _baseRef: unknown })._baseRef === node) {
        newCache.set(node.id, prev);
        return prev;
      }

      const newNode = {
        ...node,
        dragHandle: NODE_DRAG_HANDLE,
        expandParent,
        _baseRef: node,
        data: {
          ...node.data,
          nodeId: node.id,
          isRenaming,
          dimmed,
          nodeActions,
        },
      } as Node;
      newCache.set(node.id, newNode);
      return newNode;
    });

    prevNodesCache.current = newCache;
    return result;
  }, [nodesWithHiddenFlags, childCountMap, organizerIds, renamingNodeId, renamingOrganizerId, nodeActions, isTraceActive, traceResult, orgRenameStart, orgRenameStop]);

  // Sort nodes: parents must come before their children (React Flow requirement)
  const sortedNodes = useMemo(() => {
    const result: Node[] = [];
    const added = new Set<string>();
    const nodeById = new globalThis.Map(nodesWithCallbacks.map(n => [n.id, n] as [string, Node]));

    // Recursive function to add a node and its ancestors first
    const addNode = (node: Node, depth = 0) => {
      if (added.has(node.id) || depth > 20) return;

      // If this node has a parent, add the parent first
      if (node.parentId && !added.has(node.parentId)) {
        const parent = nodeById.get(node.parentId);
        if (parent) addNode(parent, depth + 1);
      }

      added.add(node.id);
      result.push(node);
    };

    // Add all nodes, ensuring parent-first ordering
    for (const node of nodesWithCallbacks) {
      addNode(node);
    }

    // Filter by search text if present
    if (!searchText?.trim()) return result;

    const lowerSearch = searchText.toLowerCase();
    return result.filter((node) => {
      // Organizers always show if any children match
      if (node.type === 'organizer') return true;

      // Only filter construct nodes - type guard
      if (!('constructType' in node.data) || !('semanticId' in node.data) || !('values' in node.data)) {
        return true;
      }

      const constructType = node.data.constructType as string;
      const semanticId = node.data.semanticId as string;
      const values = node.data.values as ConstructValues;

      const schema = getSchema(constructType);
      if (!schema) return false;

      // Match against semantic ID
      if (semanticId?.toLowerCase().includes(lowerSearch)) return true;

      // Match against display name (derived from pill field or semanticId)
      const pillField = schema.fields.find(f => f.displayTier === 'pill');
      if (pillField) {
        const pillValue = String(values[pillField.name] || '');
        if (pillValue.toLowerCase().includes(lowerSearch)) return true;
      }

      // Match against any field values
      for (const field of schema.fields) {
        const value = String(values[field.name] || '');
        if (value.toLowerCase().includes(lowerSearch)) return true;
      }

      return false;
    });
  }, [nodesWithCallbacks, searchText, getSchema]);

  // Aggregate cross-organizer edges and remap collapsed edges
  const selectedNodeIdsSet = useMemo(() => new Set(selectedNodeIds), [selectedNodeIds]);
  const filteredEdges = useMemo(() => {
    // Aggregate edges crossing organizer boundaries (replaces collapse remap + dedup)
    let result = computeEdgeAggregation(edges, sortedNodes, edgeRemap, selectedNodeIdsSet);

    // Remove edges whose resolved source or target is hidden (not in visible nodes)
    const visibleNodeIds = new Set(
      sortedNodes.filter(n => !n.hidden).map(n => n.id)
    );
    result = result.filter(edge =>
      visibleNodeIds.has(edge.source) && visibleNodeIds.has(edge.target)
    );

    // Filter edges with invalid handle references (defensive layer against stale port refs)
    result = filterInvalidEdges(result, sortedNodes, getSchema);

    // Inject wagon attachment edges (thick dotted lines from construct to its attached organizer)
    const wagonEdges: Edge[] = [];
    for (const node of sortedNodes) {
      if (node.type !== 'organizer' || node.hidden) continue;
      const orgData = node.data as OrganizerNodeData;
      if (!orgData.attachedToSemanticId) continue;
      const owner = sortedNodes.find(n =>
        n.type === 'construct' && !n.hidden &&
        (n.data as ConstructNodeData).semanticId === orgData.attachedToSemanticId
      );
      if (!owner) continue;
      wagonEdges.push({
        id: `wagon-${node.id}`,
        source: owner.id,
        target: node.id,
        sourceHandle: null,
        targetHandle: 'group-connect',
        type: 'bundled',
        data: { isAttachmentEdge: true },
        style: { strokeDasharray: '8 4', strokeWidth: 3, stroke: orgData.color },
      });
    }
    if (wagonEdges.length > 0) {
      result = [...result, ...wagonEdges];
    }

    // Augment edges with flow trace data
    if (isTraceActive && traceResult) {
      result = result.map(edge => {
        const hopDistance = traceResult.edgeDistances.get(edge.id);
        return {
          ...edge,
          data: {
            ...edge.data,
            hopDistance,
            dimmed: hopDistance === undefined,
          },
        };
      });
    }

    return result;
  }, [edges, edgeRemap, sortedNodes, selectedNodeIdsSet, isTraceActive, traceResult, getSchema]);

  // Stable node type map — only changes when nodes are added/removed/type changed
  const nodeTypeMap = useMemo(
    () => new globalThis.Map(nodes.map(n => [n.id, n.type ?? 'construct'] as [string, string])),
    [nodes]
  );

  // Build a stable polarity lookup: constructType → portId → polarity
  // Only recalculates when schemas change, not on every node movement.
  const polarityLookup = useMemo(() => {
    const lookup = new globalThis.Map<string, globalThis.Map<string, string>>();
    for (const schema of schemas) {
      if (!schema.ports) continue;
      const portMap = new globalThis.Map<string, string>();
      for (const port of schema.ports) {
        const portSchema = getPortSchema(port.portType);
        if (portSchema?.polarity) {
          portMap.set(port.id, portSchema.polarity);
        }
      }
      if (portMap.size > 0) lookup.set(schema.type, portMap);
    }
    return lookup;
  }, [schemas, getPortSchema]);

  // Stable map: nodeId → constructType (only changes when nodes are added/removed/type changed)
  const nodeConstructTypeMap = useMemo(() => {
    const map = new globalThis.Map<string, string>();
    for (const n of nodes) {
      if (n.type === 'construct') {
        map.set(n.id, (n.data as ConstructNodeData).constructType);
      }
    }
    return map;
  }, [nodes]);

  // Enrich edges with polarity data for arrowhead rendering and waypoints from Yjs
  // Uses stable lookup maps to avoid depending on raw `nodes` reference
  const polarityEdges = useMemo(() => {
    return filteredEdges.map(edge => {
      // Read waypoints from the raw edge (top-level property from Yjs)
      const rawWaypoints = (edge as any).waypoints;

      if ((edge.data as Record<string, unknown>)?.isAttachmentEdge) {
        // Clean up top-level waypoints and optionally enrich data
        const { waypoints: _wp, ...cleanEdge } = edge as any;
        return rawWaypoints
          ? { ...cleanEdge, data: { ...edge.data, waypoints: rawWaypoints } }
          : cleanEdge;
      }

      const constructType = nodeConstructTypeMap.get(edge.source);
      if (!constructType) {
        const { waypoints: _wp, ...cleanEdge } = edge as any;
        return rawWaypoints
          ? { ...cleanEdge, data: { ...edge.data, waypoints: rawWaypoints } }
          : cleanEdge;
      }

      const portMap = polarityLookup.get(constructType);
      if (!portMap) {
        const { waypoints: _wp, ...cleanEdge } = edge as any;
        return rawWaypoints
          ? { ...cleanEdge, data: { ...edge.data, waypoints: rawWaypoints } }
          : cleanEdge;
      }

      const polarity = edge.sourceHandle ? portMap.get(edge.sourceHandle) : undefined;

      // Clean up top-level waypoints and enrich data with both polarity and waypoints
      const { waypoints: _wp, ...cleanEdge } = edge as any;
      return {
        ...cleanEdge,
        data: {
          ...edge.data,
          ...(polarity ? { polarity } : {}),
          ...(rawWaypoints ? { waypoints: rawWaypoints } : {}),
        },
      };
    });
  }, [filteredEdges, nodeConstructTypeMap, polarityLookup]);

  // Edge bundling: collapse parallel edges between same node pairs
  const { displayEdges, bundleMap } = useEdgeBundling(polarityEdges, nodeTypeMap);
  bundleMapRef.current = bundleMap;

  // Orthogonal routing disabled — A* per-edge is O(edges * obstacles²) and fires
  // on every state change because sortedNodes creates new references.
  // TODO: re-enable with debounced/incremental routing that doesn't block the main thread.
  const routedEdges = displayEdges;

  // Sync cascade output to RF's internal store (uncontrolled mode)
  const initialRender = useRef(true);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return; // defaultNodes/defaultEdges handle initial render
    }
    // Functional update: merge new data while preserving RF-managed selection state.
    // Only creates new objects for nodes where selection actually differs.
    reactFlow.setNodes(prevNodes => {
      const prevMap = new globalThis.Map(prevNodes.map(n => [n.id, n] as [string, Node]));
      return sortedNodes.map(n => {
        const prev = prevMap.get(n.id);
        if (!prev) return n;
        // If the node reference is the same (from cache) and selection matches, keep prev
        if (prev === n) return prev;
        // Preserve selection from RF's internal state
        if (prev.selected) return { ...n, selected: true };
        return n;
      });
    });
  }, [sortedNodes, reactFlow]);

  useEffect(() => {
    if (initialRender.current) return;
    reactFlow.setEdges(routedEdges);
  }, [routedEdges, reactFlow]);

  // Detect non-parented nodes visually covered by organizers they don't belong to
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

  // Rescue covered nodes by moving them just outside the covering organizer
  const rescueCoveredNodes = useCallback(() => {
    const visibleOrganizers = sortedNodes.filter(n => n.type === 'organizer' && !n.hidden);
    const margin = 20;
    const rescuedIds: string[] = [];

    setNodes(nds => nds.map(n => {
      if (!coveredNodeIds.includes(n.id)) return n;

      const nodeW = n.measured?.width ?? n.width ?? 200;
      const nodeH = n.measured?.height ?? n.height ?? 100;

      // Find the covering organizer
      const coveringOrg = visibleOrganizers.find(org => {
        const orgW = (org.style?.width as number) ?? org.width ?? 200;
        const orgH = (org.style?.height as number) ?? org.height ?? 200;
        return nodeContainedInOrganizer(
          n.position, { width: nodeW, height: nodeH },
          org.position, { width: orgW, height: orgH }
        );
      });
      if (!coveringOrg) return n;

      const orgW = (coveringOrg.style?.width as number) ?? coveringOrg.width ?? 200;
      const orgH = (coveringOrg.style?.height as number) ?? coveringOrg.height ?? 200;

      // Find nearest edge to node center
      const cx = n.position.x + nodeW / 2;
      const cy = n.position.y + nodeH / 2;
      const distLeft = cx - coveringOrg.position.x;
      const distRight = (coveringOrg.position.x + orgW) - cx;
      const distTop = cy - coveringOrg.position.y;
      const distBottom = (coveringOrg.position.y + orgH) - cy;
      const minDist = Math.min(distLeft, distRight, distTop, distBottom);

      let newPos = { ...n.position };
      if (minDist === distLeft) {
        newPos = { x: coveringOrg.position.x - nodeW - margin, y: n.position.y };
      } else if (minDist === distRight) {
        newPos = { x: coveringOrg.position.x + orgW + margin, y: n.position.y };
      } else if (minDist === distTop) {
        newPos = { x: n.position.x, y: coveringOrg.position.y - nodeH - margin };
      } else {
        newPos = { x: n.position.x, y: coveringOrg.position.y + orgH + margin };
      }

      rescuedIds.push(n.id);
      return { ...n, position: newPos };
    }));

    // Select rescued nodes (visual only, use RF store directly)
    if (rescuedIds.length > 0) {
      reactFlow.setNodes(nds => nds.map(n => ({
        ...n,
        selected: rescuedIds.includes(n.id),
      })));
      setSelectedNodeIds(rescuedIds);
    }
  }, [sortedNodes, coveredNodeIds, setNodes, reactFlow, setSelectedNodeIds]);

  // Handle drag start/drag/stop for organizer attach/detach
  const rafIdRef = useRef<number | null>(null);

  const onNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    isDraggingRef.current = true;
    draggedNodesRef.current.add(node.id);
    suppressUpdates.current = true;
  }, [suppressUpdates]);

  const onNodeDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    // Toggle Ctrl+drag visual class (no re-render, direct DOM)
    const isCtrl = _event.ctrlKey || _event.metaKey;
    if (isCtrl !== ctrlDragActiveRef.current) {
      ctrlDragActiveRef.current = isCtrl;
      mapWrapperRef.current?.classList.toggle('ctrl-dragging', isCtrl);
    }

    // Don't process organizer nodes themselves
    if (node.type === 'organizer') return;

    // Cancel previous rAF to throttle
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    const mouseX = _event.clientX;
    const mouseY = _event.clientY;

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;

      // Detect organizer hover for narrative hint
      const intersecting = reactFlow.getIntersectingNodes(node);
      const hoverOrganizer = intersecting.find(n => n.type === 'organizer' && n.id !== node.id);

      if (hoverOrganizer) {
        const orgData = hoverOrganizer.data as OrganizerNodeData;
        const alreadyMember = node.parentId === hoverOrganizer.id;
        if (isCtrl && !alreadyMember) {
          showNarrative({ kind: 'hint', text: `Release to add to ${orgData.name}`, variant: 'attach', position: { x: mouseX, y: mouseY } });
        } else if (isCtrl && alreadyMember) {
          showNarrative({ kind: 'hint', text: `Release to detach from ${orgData.name}`, variant: 'detach', position: { x: mouseX, y: mouseY } });
        } else if (!isCtrl && !alreadyMember) {
          showNarrative({ kind: 'hint', text: `Hold Ctrl to add to ${orgData.name}`, variant: 'neutral', position: { x: mouseX, y: mouseY } });
        } else {
          hideNarrative();
        }
      } else if (isCtrl && node.parentId) {
        // Over empty space with Ctrl, currently in an organizer → will detach
        const allNodes = reactFlow.getNodes();
        const parentOrg = allNodes.find(n => n.id === node.parentId);
        const parentName = parentOrg ? (parentOrg.data as OrganizerNodeData).name : 'organizer';
        showNarrative({ kind: 'hint', text: `Release to detach from ${parentName}`, variant: 'detach', position: { x: mouseX, y: mouseY } });
      } else {
        hideNarrative();
      }
    });
  }, [reactFlow, showNarrative, hideNarrative]);

  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    isDraggingRef.current = false;
    draggedNodesRef.current.clear();

    // Re-enable Yjs → React state sync before any commits
    suppressUpdates.current = false;

    // Clear drag narrative hint
    hideNarrative();

    // Clear Ctrl+drag visual feedback
    ctrlDragActiveRef.current = false;
    mapWrapperRef.current?.classList.remove('ctrl-dragging');

    // Cancel any pending rAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Don't process organizer nodes themselves
    if (node.type === 'organizer') return;

    const isModifier = event.ctrlKey || event.metaKey;

    if (isModifier) {
      // Ctrl+release = change organizer membership
      const intersecting = reactFlow.getIntersectingNodes(node);
      const targetOrganizer = intersecting.find(n => n.type === 'organizer' && n.id !== node.id);

      if (targetOrganizer && targetOrganizer.id !== node.parentId) {
        // Use fresh-state attach from useLayoutActions (not useOrganizerOperations)
        attachNodeToOrganizer(node.id, targetOrganizer.id);
      } else if (node.parentId) {
        // Use fresh-state detach from useLayoutActions (not useOrganizerOperations)
        detachNodeFromOrganizer(node.id);
      }
    }
  }, [reactFlow, suppressUpdates, attachNodeToOrganizer, detachNodeFromOrganizer, hideNarrative]);

  // Handle organizer selection (click on organizer selects all nodes in it)
  const handleSelectOrganizer = useCallback((organizerId: string) => {
    const memberNodes = nodes.filter(n => n.parentId === organizerId);
    const nodeIds = memberNodes.map(n => n.id);
    reactFlow.setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: nodeIds.includes(n.id),
      }))
    );
    setSelectedNodeIds(nodeIds);
  }, [nodes, reactFlow, setSelectedNodeIds]);

  // Suppress unused - will be used for organizer selection via context menu
  void handleSelectOrganizer;

  // Debug display disabled for performance (ZoomDebug re-renders on every zoom/pan frame)

  return (
    <div ref={mapWrapperRef} className="w-full h-full relative" style={{ backgroundColor: 'var(--color-canvas)' }}>
      {/* ZoomDebug removed — re-renders every frame during zoom/pan */}
      <ReactFlow
        defaultNodes={sortedNodes}
        defaultEdges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
        onNodeDrag={onNodeDrag}
        onNodeDragStop={onNodeDragStop}
        onEdgesDelete={handleEdgesDelete}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onSelectionChange={handleSelectionChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onSelectionContextMenu={onSelectionContextMenu}
        onEdgeContextMenu={onEdgeContextMenu}
        onEdgeClick={handleEdgeClick}
        onPaneClick={handlePaneClick}
        onNodeMouseEnter={onNodeMouseEnter}
        onNodeMouseLeave={onNodeMouseLeave}
        onMoveStart={hideNarrative}
        onMouseDown={onMouseDown}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        minZoom={0.15}
        nodeDragThreshold={5}
        panOnDrag={selectionModeActive ? [1, 2] : [0, 1, 2]}
        selectionOnDrag={selectionModeActive}
        selectionMode={SelectionMode.Full}
        connectionRadius={50}
        elevateNodesOnSelect={false}
        fitView
      >
        <Controls position="top-left" showZoom={false}>
          <Tooltip content="Undo (Ctrl+Z)">
            <ControlButton
              onClick={undo}
              disabled={!canUndo}
              className={!canUndo ? 'disabled' : ''}
            >
              <ArrowUUpLeft weight="bold" />
            </ControlButton>
          </Tooltip>
          <Tooltip content="Redo (Ctrl+Shift+Z)">
            <ControlButton
              onClick={redo}
              disabled={!canRedo}
              className={!canRedo ? 'disabled' : ''}
            >
              <ArrowUUpRight weight="bold" />
            </ControlButton>
          </Tooltip>
          <Tooltip content="Zoom In">
            <ControlButton onClick={customZoomIn}>
              <Plus weight="bold" />
            </ControlButton>
          </Tooltip>
          <Tooltip content="Zoom Out">
            <ControlButton onClick={customZoomOut}>
              <Minus weight="bold" />
            </ControlButton>
          </Tooltip>
          <Tooltip content="Fit to View">
            <ControlButton onClick={() => reactFlow.fitView({ duration: 300 })}>
              <CornersOut weight="bold" />
            </ControlButton>
          </Tooltip>
          <ToolbarLayoutFlyouts
            spreadAll={spreadAll}
            compactAll={compactAll}
            flowLayout={flowLayout}
            alignNodes={alignNodes}
            distributeNodes={distributeNodes}
            routeEdges={routeEdges}
            clearRoutes={clearRoutes}
            applyPinLayout={applyPinLayout}
            hasPinConstraints={pinConstraints.length > 0}
            selectedCount={selectedNodeIds.length}
          />
          <Tooltip content={selectionModeActive ? "Exit Selection Mode (V)" : "Selection Mode (V)"}>
            <ControlButton
              onClick={toggleSelectionMode}
              className={selectionModeActive ? 'active' : ''}
              style={selectionModeActive ? { backgroundColor: 'var(--xy-controls-button-background-color-hover, #f0f0f0)' } : undefined}
            >
              <CursorClick weight="bold" />
            </ControlButton>
          </Tooltip>
          {selectedNodeIds.length > 0 && (
            <>
              <Tooltip content={selectedNodeIds.length === 1 ? "Rename (F2)" : "Select single node to rename"}>
                <ControlButton
                  onClick={startRename}
                  disabled={selectedNodeIds.length !== 1}
                  className={selectedNodeIds.length !== 1 ? 'disabled' : ''}
                >
                  <PencilSimple weight="bold" />
                </ControlButton>
              </Tooltip>
              <Tooltip content="Copy (Ctrl+C)">
                <ControlButton onClick={() => copyNodes()}>
                  <CopySimple weight="bold" />
                </ControlButton>
              </Tooltip>
              <Tooltip content="Delete (Del)">
                <ControlButton onClick={deleteSelectedNodes} className="text-red-600">
                  <Trash weight="bold" />
                </ControlButton>
              </Tooltip>
            </>
          )}
        </Controls>

        {/* Layout view toggle — bottom left */}
        <Tooltip content="Layout View">
          <button
            onClick={() => setShowLayoutView(true)}
            className="absolute bottom-4 left-4 z-10 w-10 h-10 rounded-full bg-surface shadow-lg border border-border flex items-center justify-center text-content-muted hover:text-content hover:bg-surface-elevated transition-colors"
          >
            <GridFour weight="bold" size={18} />
          </button>
        </Tooltip>

        {/* Covered nodes warning badge */}
        {coveredNodeIds.length > 0 && (
          <div className="absolute top-[14px] left-[52px]">
            <Tooltip content={`${coveredNodeIds.length} node${coveredNodeIds.length > 1 ? 's' : ''} covered by organizers — click to rescue`}>
              <button
                onClick={rescueCoveredNodes}
                className="h-[32px] px-3 bg-amber-100 border border-amber-300 rounded cursor-pointer flex items-center gap-1.5 hover:bg-amber-200 transition-colors shadow-sm text-amber-800 text-xs font-medium"
              >
                <Warning weight="bold" size={14} />
                {coveredNodeIds.length} covered
              </button>
            </Tooltip>
          </div>
        )}

        <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="var(--color-dot-grid)" />
        {/* Arrow marker definitions for directional edges */}
        <svg style={{ position: 'absolute', width: 0, height: 0 }}>
          <defs>
            <marker id="carta-arrow-end" viewBox="0 0 10 10" refX="10" refY="5"
                    markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--edge-default-color, #94a3b8)" />
            </marker>
          </defs>
        </svg>
      </ReactFlow>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          type={contextMenu.type}
          nodeId={contextMenu.nodeId}
          edgeId={contextMenu.edgeId}
          selectedCount={selectedNodeIds.length}
          relatedConstructs={contextMenu.nodeId ? getRelatedConstructsForNode(contextMenu.nodeId) : undefined}
          constructOptions={contextMenu.type === 'pane' ? allConstructOptions : undefined}
          schemaGroups={schemaGroups}
          onAddNode={addNode}
          onAddConstruct={handleAddConstructFromMenu}
          onDeleteNode={deleteNode}
          onDeleteSelected={deleteSelectedNodes}
          onDeleteEdge={deleteEdge}
          onCopyNodes={copyNodes}
          onPasteNodes={pasteNodes}
          onAddRelatedConstruct={contextMenu.nodeId ? (constructType, fromPortId, toPortId) => addRelatedConstruct(contextMenu.nodeId!, constructType, fromPortId, toPortId) : undefined}
          canPaste={canPaste}
          onClose={closeContextMenu}
          onNewConstructSchema={() => setEditorState({ open: true })}
          onEditSchema={(schemaType) => {
            const schema = getSchema(schemaType);
            if (schema) setEditorState({ open: true, editSchema: schema });
          }}
          constructType={(() => {
            if (!contextMenu.nodeId) return undefined;
            const node = nodes.find(n => n.id === contextMenu.nodeId);
            return node?.type === 'construct' ? (node.data as ConstructNodeData).constructType : undefined;
          })()}
          pages={pages}
          activePage={activePage}
          selectedNodeIds={selectedNodeIds}
          onCopyNodesToPage={copyNodesToPage}
          onCopyNodesToNewPage={handleCopyNodesToNewPage}
          onSpreadSelected={spreadSelected}
          onOrganizeSelected={createOrganizer}
          onRemoveFromOrganizer={removeFromOrganizer}
          onAttachOrganizer={handleAttachOrganizer}
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
          onRenameOrganizer={(nodeId: string) => {
            setRenamingOrganizerId(nodeId);
            closeContextMenu();
          }}
          onDebugInfo={(nodeId) => { setDebugNodeId(nodeId); closeContextMenu(); }}
          onRevalidateEdges={() => { revalidateEdges(); closeContextMenu(); }}
        />
      )}

      {addMenu && (
        <AddConstructMenu
          x={addMenu.x}
          y={addMenu.y}
          onAdd={addConstruct}
          onClose={() => setAddMenu(null)}
        />
      )}

      {editorState.open && (
        <ConstructEditor
          editSchema={editorState.editSchema}
          onClose={() => setEditorState({ open: false })}
        />
      )}

      {debugNodeId && (() => {
        const node = nodes.find(n => n.id === debugNodeId);
        if (!node || node.type === 'organizer') return null;
        const data = node.data as ConstructNodeData;
        const schema = schemas.find(s => s.type === data.constructType);
        return (
          <ConstructDebugModal
            node={node}
            schema={schema}
            onClose={() => setDebugNodeId(null)}
          />
        );
      })()}

      <Narrative narrative={narrative} onDismiss={hideNarrative} />

      {/* Layout View Overlay */}
      {showLayoutView && (
        <div className="absolute inset-0 z-50 bg-canvas">
          <LayoutView onClose={() => setShowLayoutView(false)} />
        </div>
      )}
    </div>
  );
}
