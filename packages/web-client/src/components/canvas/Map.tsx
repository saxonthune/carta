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
import { useLevels } from '../../hooks/useLevels';
import CustomNode from './CustomNode';
import ConstructNode from './ConstructNode';
import OrganizerNode from './OrganizerNode';
import ContextMenu, { type RelatedConstructOption } from '../ui/ContextMenu';
import { useMapState } from '../../hooks/useMapState';
import NodeControls from './NodeControls';
import AddConstructMenu from './AddConstructMenu';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useGraphOperations } from '../../hooks/useGraphOperations';
import { useConnections } from '../../hooks/useConnections';
import { useClipboard } from '../../hooks/useClipboard';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import type { ConstructValues, ConstructNodeData, OrganizerNodeData, Size } from '@carta/domain';
import { computeMinOrganizerSize, DEFAULT_ORGANIZER_LAYOUT, nodeContainedInOrganizer, getDisplayName, type NodeGeometry } from '@carta/domain';
import { usePresentation } from '../../hooks/usePresentation';
import { computeEdgeAggregation } from '../../presentation/index';
import { useOrganizerOperations } from '../../hooks/useOrganizerOperations';
import ConstructEditor from '../ConstructEditor';
import DynamicAnchorEdge from './DynamicAnchorEdge';
import ConstructFullViewModal from '../modals/ConstructFullViewModal';
import { useEdgeBundling } from '../../hooks/useEdgeBundling';
import { useFlowTrace } from '../../hooks/useFlowTrace';
import { useLodBand } from './lod/useLodBand';
import { ZoomDebug } from '../ui/ZoomDebug';
import { useNarrative } from '../../hooks/useNarrative';
import Narrative from './Narrative';

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
  const { levels, activeLevel, setActiveLevel, createLevel, copyNodesToLevel } = useLevels();
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

  // Live organizer resize during drag
  const dragOrganizerIdRef = useRef<string | null>(null);
  const dragStartOrganizerSizeRef = useRef<Size | null>(null);
  const rafIdRef = useRef<number | null>(null);

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
    fitOrganizerToMembers,
    setStackIndex,
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

  // Copy selected nodes to a newly created level
  const handleCopyNodesToNewLevel = useCallback(
    (nodeIds: string[]) => {
      const sourceLevelName = levels.find(l => l.id === activeLevel)?.name ?? 'Unknown';
      const newLevel = createLevel(`Copied selection from ${sourceLevelName}`);
      copyNodesToLevel(nodeIds, newLevel.id);
      setActiveLevel(newLevel.id);
    },
    [createLevel, copyNodesToLevel, setActiveLevel, levels, activeLevel]
  );

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

  // Edge click: select both source and target nodes + show narrative
  const handleEdgeClick = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      const endpointIds = [edge.source, edge.target];
      reactFlow.setNodes(nds => nds.map(n => ({
        ...n,
        selected: endpointIds.includes(n.id),
      })));
      setSelectedNodeIds(endpointIds);

      // Build structured narrative data
      const sourceNode = nodes.find(n => n.id === edge.source);
      const targetNode = nodes.find(n => n.id === edge.target);
      if (!sourceNode || !targetNode) return;

      const sourceData = sourceNode.data as ConstructNodeData;
      const targetData = targetNode.data as ConstructNodeData;
      const sourceSchema = sourceNode.type === 'construct' ? getSchema(sourceData.constructType) : undefined;
      const targetSchema = targetNode.type === 'construct' ? getSchema(targetData.constructType) : undefined;

      const sourceName = sourceNode.type === 'construct' ? getDisplayName(sourceData, sourceSchema) : (sourceData.label as string ?? edge.source);
      const targetName = targetNode.type === 'construct' ? getDisplayName(targetData, targetSchema) : (targetData.label as string ?? edge.target);
      const sourceType = sourceSchema?.displayName ?? sourceNode.type ?? '';
      const targetType = targetSchema?.displayName ?? targetNode.type ?? '';

      // Resolve port configs and their registry schemas (for label, color, polarity)
      const isRemapped = edge.sourceHandle === 'group-connect' || edge.targetHandle === 'group-connect';
      const sourcePortConfig = !isRemapped ? sourceSchema?.ports?.find(p => p.id === edge.sourceHandle) : undefined;
      const targetPortConfig = !isRemapped ? targetSchema?.ports?.find(p => p.id === edge.targetHandle) : undefined;
      const sourcePortSchema = sourcePortConfig ? getPortSchema(sourcePortConfig.portType) : undefined;
      const targetPortSchema = targetPortConfig ? getPortSchema(targetPortConfig.portType) : undefined;
      const sourcePortLabel = sourcePortConfig?.label ?? edge.sourceHandle ?? '';
      const targetPortLabel = targetPortConfig?.label ?? edge.targetHandle ?? '';
      const sourcePortColor = sourcePortSchema?.color ?? '#94a3b8';
      const targetPortColor = targetPortSchema?.color ?? '#94a3b8';

      // Determine polarity to sort: source-polarity node on left
      const sourcePortPolarity = sourcePortSchema?.polarity;
      const isSourceOutput = sourcePortPolarity === 'source' || sourcePortPolarity === 'relay';

      // If source port is a sink, swap so the "from" side is the output
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

      showNarrative({
        kind: 'edge',
        from, to,
        position: { x: event.clientX, y: event.clientY },
        anchor: 'above',
      });
    },
    [reactFlow, setSelectedNodeIds, nodes, getSchema, getPortSchema, showNarrative]
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
  const setStackIndexRef = useRef(setStackIndex);
  setStackIndexRef.current = setStackIndex;

  // One stable dispatch object shared by ALL nodes (never changes identity)
  const nodeActions = useMemo(() => ({
    onRename: (nodeId: string, newName: string) => renameNodeRef.current(nodeId, newName),
    onValuesChange: (nodeId: string, values: ConstructValues) => updateNodeValuesRef.current(nodeId, values),
    onSetViewLevel: (nodeId: string, level: 'summary' | 'details') => setNodeViewLevelRef.current(nodeId, level),
    onToggleDetailsPin: (nodeId: string) => toggleNodeDetailsPinRef.current(nodeId),
    onOpenFullView: (nodeId: string) => setFullViewNodeIdRef.current(nodeId),
    onInstanceColorChange: (nodeId: string, color: string | null) => updateNodeInstanceColorRef.current(nodeId, color),
    onToggleCollapse: (nodeId: string) => toggleOrganizerCollapseRef.current(nodeId),
    onSetStackIndex: (nodeId: string, index: number) => setStackIndexRef.current(nodeId, index),
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

  // Edge bundling: collapse parallel edges between same node pairs
  const { displayEdges } = useEdgeBundling(filteredEdges, nodeTypeMap);

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

  // Handle drag start/drag/stop for live organizer resizing
  const onNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    isDraggingRef.current = true;
    draggedNodesRef.current.add(node.id);
    suppressUpdates.current = true;

    // If dragged node is a child of an organizer, capture organizer size for live resize
    if (node.parentId && node.type !== 'organizer') {
      const allNodes = reactFlow.getNodes();
      const parentNode = allNodes.find(n => n.id === node.parentId);
      if (parentNode?.type === 'organizer') {
        dragOrganizerIdRef.current = parentNode.id;
        dragStartOrganizerSizeRef.current = {
          width: (parentNode.width as number) ?? (parentNode.style?.width as number) ?? 200,
          height: (parentNode.height as number) ?? (parentNode.style?.height as number) ?? 200,
        };
      } else {
        dragOrganizerIdRef.current = null;
        dragStartOrganizerSizeRef.current = null;
      }
    } else {
      dragOrganizerIdRef.current = null;
      dragStartOrganizerSizeRef.current = null;
    }
  }, [reactFlow, suppressUpdates]);

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

    const organizerId = dragOrganizerIdRef.current;
    const startSize = dragStartOrganizerSizeRef.current;
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

      // Live organizer resize (only when dragging from within an organizer)
      if (!organizerId) return;

      const allNodes = reactFlow.getNodes();
      const members = allNodes.filter(n => n.parentId === organizerId);
      const relevantMembers = isCtrl
        ? members.filter(n => n.id !== node.id)
        : members;

      if (relevantMembers.length === 0 && isCtrl) {
        if (startSize) {
          reactFlow.updateNode(organizerId, (n) => ({
            width: startSize.width,
            height: startSize.height,
            style: { ...n.style, width: startSize.width, height: startSize.height },
          }));
        }
        return;
      }

      const memberGeometries: NodeGeometry[] = relevantMembers.map(n => ({
        position: n.position,
        width: n.width,
        height: n.height,
        measured: n.measured,
      }));

      const minSize = computeMinOrganizerSize(memberGeometries, DEFAULT_ORGANIZER_LAYOUT);
      const newWidth = isCtrl ? minSize.width : Math.max(startSize?.width ?? 0, minSize.width);
      const newHeight = isCtrl ? minSize.height : Math.max(startSize?.height ?? 0, minSize.height);

      reactFlow.updateNode(organizerId, (n) => ({
        width: newWidth,
        height: newHeight,
        style: { ...n.style, width: newWidth, height: newHeight },
      }));
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

    // Commit organizer style if one was resized during drag
    if (dragOrganizerIdRef.current) {
      const orgNode = reactFlow.getNodes().find(n => n.id === dragOrganizerIdRef.current);
      if (orgNode?.style?.width && orgNode?.style?.height) {
        adapter.patchNodes?.([{
          id: dragOrganizerIdRef.current,
          style: { width: orgNode.style.width, height: orgNode.style.height },
        }]);
      }
    }

    // Clear drag refs
    dragOrganizerIdRef.current = null;
    dragStartOrganizerSizeRef.current = null;

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
    } else if (node.parentId) {
      // Default release = full refit including position shift
      fitOrganizerToMembers(node.parentId);
    }
  }, [reactFlow, adapter, suppressUpdates, attachToOrganizer, detachFromOrganizer, fitOrganizerToMembers, hideNarrative]);

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
        </Controls>

        {/* Custom zoom controls with finer granularity */}
        <div className="absolute top-[14px] left-[52px] flex flex-col gap-[2px]">
          <button
            onClick={customZoomIn}
            className="w-[32px] h-[32px] bg-white border border-[#e2e8f0] rounded cursor-pointer flex items-center justify-center hover:bg-[#f8fafc] transition-colors shadow-sm"
            title="Zoom In"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
          <button
            onClick={customZoomOut}
            className="w-[32px] h-[32px] bg-white border border-[#e2e8f0] rounded cursor-pointer flex items-center justify-center hover:bg-[#f8fafc] transition-colors shadow-sm"
            title="Zoom Out"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>

        {/* Covered nodes warning badge */}
        {coveredNodeIds.length > 0 && (
          <div className="absolute top-[14px] left-[92px]">
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
      </ReactFlow>

      {selectedNodeIds.length > 0 && (
        <NodeControls
          selectedCount={selectedNodeIds.length}
          onRename={startRename}
          onDelete={deleteSelectedNodes}
          onCopy={copyNodes}
        />
      )}

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
          levels={levels}
          activeLevel={activeLevel}
          selectedNodeIds={selectedNodeIds}
          onCopyNodesToLevel={copyNodesToLevel}
          onCopyNodesToNewLevel={handleCopyNodesToNewLevel}
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
