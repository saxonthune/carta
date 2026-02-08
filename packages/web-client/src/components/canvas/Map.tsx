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
  useUpdateNodeInternals,
  type Node,
  type Edge,
  type OnSelectionChangeParams,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
} from '@xyflow/react';
import { useNodes } from '../../hooks/useNodes';
import { useEdges } from '../../hooks/useEdges';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { useSchemas } from '../../hooks/useSchemas';
import { useSchemaGroups } from '../../hooks/useSchemaGroups';
import { usePortSchemas } from '../../hooks/usePortSchemas';
import { usePages } from '../../hooks/usePages';
import CustomNode from './CustomNode';
import ConstructNode from './ConstructNode';
import OrganizerNode from './OrganizerNode';
import ContextMenu, { type RelatedConstructOption } from '../ui/ContextMenu';
import { useMapState } from '../../hooks/useMapState';
import AddConstructMenu from './AddConstructMenu';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useGraphOperations } from '../../hooks/useGraphOperations';
import { useConnections } from '../../hooks/useConnections';
import { useClipboard } from '../../hooks/useClipboard';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import type { ConstructValues, ConstructNodeData, OrganizerNodeData } from '@carta/domain';
import { nodeContainedInOrganizer, getDisplayName } from '@carta/domain';
import { usePresentation } from '../../hooks/usePresentation';
import { computeEdgeAggregation } from '../../presentation/index';
import { useOrganizerOperations } from '../../hooks/useOrganizerOperations';
import ConstructEditor from '../ConstructEditor';
import DynamicAnchorEdge from './DynamicAnchorEdge';
import ConstructFullViewModal from '../modals/ConstructFullViewModal';
import { useEdgeBundling, type BundleData } from '../../hooks/useEdgeBundling';
import { useFlowTrace } from '../../hooks/useFlowTrace';
import { useLodBand } from './lod/useLodBand';
import { ZoomDebug } from '../ui/ZoomDebug';
import { useNarrative } from '../../hooks/useNarrative';
import Narrative from './Narrative';
import { spreadNodes } from '../../utils/spreadNodes';
import { compactNodes } from '../../utils/compactNodes';
import { hierarchicalLayout } from '../../utils/hierarchicalLayout';

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
  const { adapter } = useDocumentContext();
  const { nodes, setNodes, setNodesLocal, suppressUpdates } = useNodes();
  const { edges, setEdges } = useEdges();
  const { schemas, getSchema } = useSchemas();
  const { getPortSchema } = usePortSchemas();
  const { pages, activePage, setActivePage, createPage, copyNodesToPage } = usePages();
  const reactFlow = useReactFlow();

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

  // Presentation model for collapse/hide logic and edge remapping
  const { processedNodes: nodesWithHiddenFlags, edgeRemap } = usePresentation(nodes, edges);

  // Flow trace: Alt+hover to highlight forward flow
  const { traceResult, isTraceActive, onNodeMouseEnter, onNodeMouseLeave } = useFlowTrace(edges);

  // LOD band for debug display
  const lod = useLodBand();

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
        // Sync measured dimensions to our state (no Yjs write needed).
        // Skip during drag — content dimensions don't change while dragging,
        // and processing them feeds the ResizeObserver loop.
        if (!isDraggingRef.current) {
          dimensionChanges.push(change);
        }
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
    }
  }, [setNodesLocal, adapter]);

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
    fullViewNodeId,
    setAddMenu,
    setEditorState,
    setFullViewNodeId,
    onPaneContextMenu,
    onNodeContextMenu,
    onEdgeContextMenu,
    onMouseDown,
    closeContextMenu,
    onPaneClick,
  } = useMapState();

  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
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
    setNodeViewLevel,
    toggleNodeDetailsPin,
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
    attachToOrganizer,
    detachFromOrganizer,
    toggleOrganizerCollapse,
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
    createAttachedOrganizer(nodeId, data.semanticId);
  }, [nodes, createAttachedOrganizer]);

  // Select all construct nodes on current level
  const selectAll = useCallback(() => {
    const allIds = nodes.filter(n => n.type === 'construct' && !n.hidden).map(n => n.id);
    reactFlow.setNodes(nds => nds.map(n => ({
      ...n,
      selected: allIds.includes(n.id),
    })));
    setSelectedNodeIds(allIds);
  }, [nodes, reactFlow, setSelectedNodeIds]);

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

  // Spread selected nodes into a non-overlapping grid
  const handleSpreadSelected = useCallback(() => {
    const rfNodes = reactFlow.getNodes();
    const selected = rfNodes.filter(n => selectedNodeIds.includes(n.id));
    if (selected.length < 2) return;

    const inputs = selected.map(n => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      width: n.measured?.width ?? n.width ?? 200,
      height: n.measured?.height ?? n.height ?? 100,
    }));
    const newPositions = spreadNodes(inputs);

    const applyPositions = (nds: Node[]) => nds.map(n => {
      const pos = newPositions.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });

    // Update all three layers: RF internal, local state, and Yjs
    reactFlow.setNodes(applyPositions);
    setNodesLocal(applyPositions);
    const patches = [...newPositions].map(([id, position]) => ({ id, position }));
    if (patches.length > 0) {
      adapter.patchNodes?.(patches);
    }
  }, [reactFlow, selectedNodeIds, adapter, setNodesLocal]);

  // Spread all nodes on current level (within each organizer independently)
  const handleSpreadAll = useCallback(() => {
    const rfNodes = reactFlow.getNodes();

    // Group nodes by parentId (null = top-level)
    const groups = new globalThis.Map<string | null, typeof rfNodes>();
    for (const n of rfNodes) {
      if (n.type === 'organizer') continue;
      const key = n.parentId ?? null;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(n);
    }

    const allNewPositions = new globalThis.Map<string, { x: number; y: number }>();
    for (const [, groupNodes] of groups) {
      if (groupNodes.length < 2) continue;
      const inputs = groupNodes.map(n => ({
        id: n.id,
        x: n.position.x,
        y: n.position.y,
        width: n.measured?.width ?? n.width ?? 200,
        height: n.measured?.height ?? n.height ?? 100,
      }));
      const positions = spreadNodes(inputs);
      for (const [id, pos] of positions) {
        allNewPositions.set(id, pos);
      }
    }

    if (allNewPositions.size === 0) return;

    const applyPositions = (nds: Node[]) => nds.map(n => {
      const pos = allNewPositions.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });

    // Update all three layers: RF internal, local state, and Yjs
    reactFlow.setNodes(applyPositions);
    setNodesLocal(applyPositions);
    const patches = [...allNewPositions].map(([id, position]) => ({ id, position }));
    if (patches.length > 0) {
      adapter.patchNodes?.(patches);
    }
  }, [reactFlow, adapter, setNodesLocal]);

  // Compact all top-level nodes (remove whitespace, preserve spatial order)
  const handleCompactAll = useCallback(() => {
    const rfNodes = reactFlow.getNodes();
    const topLevel = rfNodes.filter(n => !n.parentId);
    if (topLevel.length < 2) return;

    const inputs = topLevel.map(n => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      width: n.measured?.width ?? n.width ?? 200,
      height: n.measured?.height ?? n.height ?? 100,
    }));
    const newPositions = compactNodes(inputs);

    if (newPositions.size === 0) return;

    const applyPositions = (nds: Node[]) => nds.map(n => {
      const pos = newPositions.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });

    reactFlow.setNodes(applyPositions);
    setNodesLocal(applyPositions);
    const patches = [...newPositions].map(([id, position]) => ({ id, position }));
    if (patches.length > 0) {
      adapter.patchNodes?.(patches);
    }
  }, [reactFlow, adapter, setNodesLocal]);

  // Hierarchical layout (top-to-bottom by edge flow)
  const handleHierarchicalLayout = useCallback(() => {
    const rfNodes = reactFlow.getNodes();
    const rfEdges = reactFlow.getEdges();

    // Top-level non-organizer nodes only
    const topLevel = rfNodes.filter(n => !n.parentId && n.type !== 'organizer');
    if (topLevel.length < 2) return;

    const inputs = topLevel.map(n => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      width: n.measured?.width ?? n.width ?? 200,
      height: n.measured?.height ?? n.height ?? 100,
    }));

    // Filter edges to only those between top-level nodes
    const topLevelIds = new Set(topLevel.map(n => n.id));
    const edges = rfEdges
      .filter(e => topLevelIds.has(e.source) && topLevelIds.has(e.target))
      .map(e => ({ source: e.source, target: e.target }));

    const newPositions = hierarchicalLayout(inputs, edges);
    if (newPositions.size === 0) return;

    const applyPositions = (nds: Node[]) => nds.map(n => {
      const pos = newPositions.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });

    reactFlow.setNodes(applyPositions);
    setNodesLocal(applyPositions);
    const patches = [...newPositions].map(([id, position]) => ({ id, position }));
    if (patches.length > 0) {
      adapter.patchNodes?.(patches);
    }
  }, [reactFlow, adapter, setNodesLocal]);

  // Spread children within a single organizer
  const handleSpreadChildren = useCallback((organizerId: string) => {
    const rfNodes = reactFlow.getNodes();
    const children = rfNodes.filter(n => n.parentId === organizerId && n.type !== 'organizer');
    if (children.length < 2) return;

    const inputs = children.map(n => ({
      id: n.id,
      x: n.position.x,
      y: n.position.y,
      width: n.measured?.width ?? n.width ?? 200,
      height: n.measured?.height ?? n.height ?? 100,
    }));
    const newPositions = spreadNodes(inputs);

    const applyPositions = (nds: Node[]) => nds.map(n => {
      const pos = newPositions.get(n.id);
      return pos ? { ...n, position: pos } : n;
    });

    reactFlow.setNodes(applyPositions);
    setNodesLocal(applyPositions);
    const patches = [...newPositions].map(([id, position]) => ({ id, position }));
    if (patches.length > 0) {
      adapter.patchNodes?.(patches);
    }
  }, [reactFlow, adapter, setNodesLocal]);

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

  // Stable callback refs — update every render without triggering re-render
  const renameNodeRef = useRef(renameNode);
  renameNodeRef.current = renameNode;
  const updateNodeValuesRef = useRef(updateNodeValues);
  updateNodeValuesRef.current = updateNodeValues;
  const setNodeViewLevelRef = useRef(setNodeViewLevel);
  setNodeViewLevelRef.current = setNodeViewLevel;
  const toggleNodeDetailsPinRef = useRef(toggleNodeDetailsPin);
  toggleNodeDetailsPinRef.current = toggleNodeDetailsPin;
  const setFullViewNodeIdRef = useRef(setFullViewNodeId);
  setFullViewNodeIdRef.current = setFullViewNodeId;
  const updateNodeInstanceColorRef = useRef(updateNodeInstanceColor);
  updateNodeInstanceColorRef.current = updateNodeInstanceColor;
  const toggleOrganizerCollapseRef = useRef(toggleOrganizerCollapse);
  toggleOrganizerCollapseRef.current = toggleOrganizerCollapse;
  const handleSpreadChildrenRef = useRef(handleSpreadChildren);
  handleSpreadChildrenRef.current = handleSpreadChildren;

  // One stable dispatch object shared by ALL nodes (never changes identity)
  const nodeActions = useMemo(() => ({
    onRename: (nodeId: string, newName: string) => renameNodeRef.current(nodeId, newName),
    onValuesChange: (nodeId: string, values: ConstructValues) => updateNodeValuesRef.current(nodeId, values),
    onSetViewLevel: (nodeId: string, level: 'summary' | 'details') => setNodeViewLevelRef.current(nodeId, level),
    onToggleDetailsPin: (nodeId: string) => toggleNodeDetailsPinRef.current(nodeId),
    onOpenFullView: (nodeId: string) => setFullViewNodeIdRef.current(nodeId),
    onInstanceColorChange: (nodeId: string, color: string | null) => updateNodeInstanceColorRef.current(nodeId, color),
    onToggleCollapse: (nodeId: string) => toggleOrganizerCollapseRef.current(nodeId),
    onSpreadChildren: (nodeId: string) => handleSpreadChildrenRef.current(nodeId),
  }), []);

  const nodesWithCallbacks = useMemo(() =>
    nodesWithHiddenFlags.map((node) => {
      if (node.type === 'organizer') {
        return {
          ...node,
          dragHandle: NODE_DRAG_HANDLE,
          data: {
            ...node.data,
            childCount: childCountMap[node.id] || 0,
            isDimmed: isTraceActive && !traceResult?.nodeDistances.has(node.id),
            nodeActions,
          },
        };
      }
      return {
        ...node,
        dragHandle: NODE_DRAG_HANDLE,
        expandParent: node.parentId && organizerIds.has(node.parentId) ? true : undefined,
        data: {
          ...node.data,
          nodeId: node.id,
          isRenaming: node.id === renamingNodeId,
          dimmed: isTraceActive && !traceResult?.nodeDistances.has(node.id),
          nodeActions,
        },
      };
    }),
    [nodesWithHiddenFlags, childCountMap, organizerIds, renamingNodeId, nodeActions, isTraceActive, traceResult]
  );

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
  }, [edges, edgeRemap, sortedNodes, selectedNodeIdsSet, isTraceActive, traceResult]);

  // Auto-revert unpinned details nodes when deselected
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    const revertedIds: string[] = [];
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type !== 'construct') return n;
        const d = n.data as ConstructNodeData;
        if (d.viewLevel === 'details' && !d.isDetailsPinned && !selectedNodeIds.includes(n.id)) {
          revertedIds.push(n.id);
          return { ...n, data: { ...n.data, viewLevel: 'summary' } };
        }
        return n;
      })
    );
    if (revertedIds.length > 0) {
      requestAnimationFrame(() => updateNodeInternals(revertedIds));
    }
  }, [selectedNodeIds, setNodes, updateNodeInternals]);

  // Stable node type map — only changes when nodes are added/removed/type changed
  const nodeTypeMap = useMemo(
    () => new globalThis.Map(nodes.map(n => [n.id, n.type ?? 'construct'] as [string, string])),
    [nodes]
  );

  // Enrich edges with polarity data for arrowhead rendering
  const polarityEdges = useMemo(() => {
    const nodeMap = new globalThis.Map(nodes.map(n => [n.id, n]));
    return filteredEdges.map(edge => {
      // Skip non-construct edges (attachment edges, etc.)
      if ((edge.data as Record<string, unknown>)?.isAttachmentEdge) return edge;

      const sourceNode = nodeMap.get(edge.source);
      if (!sourceNode || sourceNode.type !== 'construct') return edge;
      const sourceData = sourceNode.data as ConstructNodeData;
      const sourceSchema = getSchema(sourceData.constructType);
      if (!sourceSchema) return edge;

      const portConfig = sourceSchema.ports?.find(p => p.id === edge.sourceHandle);
      if (!portConfig) return edge;
      const portSchema = getPortSchema(portConfig.portType);
      if (!portSchema) return edge;

      return {
        ...edge,
        data: { ...edge.data, polarity: portSchema.polarity },
      };
    });
  }, [filteredEdges, nodes, getSchema, getPortSchema]);

  // Edge bundling: collapse parallel edges between same node pairs
  const { displayEdges, bundleMap } = useEdgeBundling(polarityEdges, nodeTypeMap);
  bundleMapRef.current = bundleMap;

  // Sync cascade output to RF's internal store (uncontrolled mode)
  const initialRender = useRef(true);

  useEffect(() => {
    if (initialRender.current) {
      initialRender.current = false;
      return; // defaultNodes/defaultEdges handle initial render
    }
    // Preserve RF's current selection state (cascade output doesn't track it)
    const rfNodes = reactFlow.getNodes();
    const selectedIds = new Set(rfNodes.filter(n => n.selected).map(n => n.id));
    reactFlow.setNodes(sortedNodes.map(n => ({
      ...n,
      selected: selectedIds.has(n.id),
    })));
  }, [sortedNodes, reactFlow]);

  useEffect(() => {
    if (initialRender.current) return;
    reactFlow.setEdges(displayEdges);
  }, [displayEdges, reactFlow]);

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
          showNarrative({ kind: 'hint', text: `Add to ${orgData.name}`, variant: 'attach', position: { x: mouseX, y: mouseY } });
        } else if (isCtrl && alreadyMember) {
          showNarrative({ kind: 'hint', text: `Detach from ${orgData.name}`, variant: 'detach', position: { x: mouseX, y: mouseY } });
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
        showNarrative({ kind: 'hint', text: `Detach from ${parentName}`, variant: 'detach', position: { x: mouseX, y: mouseY } });
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
        // Attach to new organizer
        attachToOrganizer(node.id, targetOrganizer.id);
      } else if (node.parentId) {
        // Detach from current organizer
        detachFromOrganizer(node.id);
      }
    }
  }, [reactFlow, suppressUpdates, attachToOrganizer, detachFromOrganizer, hideNarrative]);

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

  // Count organizers for debug display
  const organizerCount = useMemo(() => nodes.filter(n => n.type === 'organizer').length, [nodes]);
  const debugLines = useMemo(() => [
    `LOD: ${lod.band}`,
    `Organizers: ${organizerCount} | Nodes: ${sortedNodes.length}`,
  ], [lod.band, organizerCount, sortedNodes.length]);

  return (
    <div ref={mapWrapperRef} className="w-full h-full relative" style={{ backgroundColor: 'var(--color-canvas)' }}>
      <ZoomDebug debugLines={debugLines} />
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
        panOnDrag={[1, 2]}
        selectionOnDrag
        selectionMode={SelectionMode.Full}
        connectionRadius={50}
        elevateNodesOnSelect={false}
        fitView
      >
        <Controls position="top-left" showZoom={false}>
          <ControlButton
            onClick={undo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className={!canUndo ? 'disabled' : ''}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 10h10a5 5 0 0 1 5 5v2M3 10l4-4M3 10l4 4" />
            </svg>
          </ControlButton>
          <ControlButton
            onClick={redo}
            disabled={!canRedo}
            title="Redo (Ctrl+Shift+Z)"
            className={!canRedo ? 'disabled' : ''}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10H11a5 5 0 0 0-5 5v2M21 10l-4-4M21 10l-4 4" />
            </svg>
          </ControlButton>
          <ControlButton onClick={customZoomIn} title="Zoom In">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </ControlButton>
          <ControlButton onClick={customZoomOut} title="Zoom Out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </ControlButton>
          <ControlButton onClick={() => reactFlow.fitView({ duration: 300 })} title="Fit to View">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
            </svg>
          </ControlButton>
          <ControlButton onClick={handleSpreadAll} title="Spread All Nodes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </ControlButton>
          <ControlButton onClick={handleCompactAll} title="Compact Layout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="4 14 10 14 10 20" />
              <polyline points="20 10 14 10 14 4" />
              <line x1="14" y1="10" x2="21" y2="3" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </ControlButton>
          <ControlButton onClick={handleHierarchicalLayout} title="Hierarchical Layout">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="3" r="2" />
              <circle cx="6" cy="12" r="2" />
              <circle cx="18" cy="12" r="2" />
              <circle cx="12" cy="21" r="2" />
              <line x1="12" y1="5" x2="6" y2="10" />
              <line x1="12" y1="5" x2="18" y2="10" />
              <line x1="6" y1="14" x2="12" y2="19" />
              <line x1="18" y1="14" x2="12" y2="19" />
            </svg>
          </ControlButton>
          {selectedNodeIds.length > 0 && (
            <>
              <ControlButton
                onClick={startRename}
                disabled={selectedNodeIds.length !== 1}
                title={selectedNodeIds.length === 1 ? "Rename (F2)" : "Select single node to rename"}
                className={selectedNodeIds.length !== 1 ? 'disabled' : ''}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </ControlButton>
              <ControlButton onClick={() => copyNodes()} title="Copy (Ctrl+C)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              </ControlButton>
              <ControlButton onClick={deleteSelectedNodes} title="Delete (Del)" className="text-red-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </ControlButton>
            </>
          )}
        </Controls>

        {/* Covered nodes warning badge */}
        {coveredNodeIds.length > 0 && (
          <div className="absolute top-[14px] left-[52px]">
            <button
              onClick={rescueCoveredNodes}
              className="h-[32px] px-3 bg-amber-100 border border-amber-300 rounded cursor-pointer flex items-center gap-1.5 hover:bg-amber-200 transition-colors shadow-sm text-amber-800 text-xs font-medium"
              title={`${coveredNodeIds.length} node${coveredNodeIds.length > 1 ? 's' : ''} covered by organizers — click to rescue`}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {coveredNodeIds.length} covered
            </button>
          </div>
        )}

        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
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
          onSpreadSelected={handleSpreadSelected}
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

      {fullViewNodeId && (() => {
        const node = nodes.find(n => n.id === fullViewNodeId);
        if (!node || node.type !== 'construct') return null;
        return (
          <ConstructFullViewModal
            nodeId={fullViewNodeId}
            data={node.data as ConstructNodeData}
            schemas={schemas}
            onClose={() => setFullViewNodeId(null)}
            onValuesChange={(values) => updateNodeValues(fullViewNodeId, values)}
          />
        );
      })()}

      <Narrative narrative={narrative} onDismiss={hideNarrative} />
    </div>
  );
}
