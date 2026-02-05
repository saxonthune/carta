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
import { useSchemas } from '../../hooks/useSchemas';
import { useLevels } from '../../hooks/useLevels';
import { useDocumentContext } from '../../contexts/DocumentContext';
import CustomNode from './CustomNode';
import ConstructNode from './ConstructNode';
import VirtualParentNode from './VirtualParentNode';
import VisualGroupNode from './VisualGroupNode';
import ContextMenu, { type RelatedConstructOption } from '../ui/ContextMenu';
import { useMapState } from '../../hooks/useMapState';
import NodeControls from './NodeControls';
import AddConstructMenu from './AddConstructMenu';
import { useUndoRedo } from '../../hooks/useUndoRedo';
import { useGraphOperations } from '../../hooks/useGraphOperations';
import { useConnections } from '../../hooks/useConnections';
import { useClipboard } from '../../hooks/useClipboard';
import { useKeyboardShortcuts } from '../../hooks/useKeyboardShortcuts';
import type { ConstructValues, Deployable, ConstructNodeData, VirtualParentNodeData, Size } from '@carta/domain';
import { computeMinGroupSize, DEFAULT_GROUP_LAYOUT, type NodeGeometry } from '@carta/domain';
import { useVisualGroups } from '../../hooks/useVisualGroups';
import { useGroupOperations } from '../../hooks/useGroupOperations';
import ConstructEditor from '../ConstructEditor';
import DynamicAnchorEdge from './DynamicAnchorEdge';
import ConstructFullViewModal from '../modals/ConstructFullViewModal';
import { useEdgeBundling } from '../../hooks/useEdgeBundling';
import { useLodBand } from './lod/useLodBand';
import { ZoomDebug } from '../ui/ZoomDebug';

const nodeTypes = {
  custom: CustomNode,
  construct: ConstructNode,
  'virtual-parent': VirtualParentNode,
  'visual-group': VisualGroupNode,
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
  deployables: Deployable[];
  onDeployablesChange: () => void;
  title: string;
  onNodesEdgesChange: (nodes: Node[], edges: Edge[]) => void;
  onSelectionChange?: (selectedNodes: Node[]) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
  searchText?: string;
}

export default function Map({ deployables, onDeployablesChange, title, onNodesEdgesChange, onSelectionChange, onNodeDoubleClick, searchText }: MapProps) {
  const { nodes, setNodes } = useNodes();
  const { edges, setEdges } = useEdges();
  const { schemas, getSchema } = useSchemas();
  const { levels, activeLevel, copyNodesToLevel } = useLevels();
  const { adapter } = useDocumentContext();
  const reactFlow = useReactFlow();

  const edgeColor = useEdgeColor();
  const defaultEdgeOptions = useMemo(() => ({
    type: 'bundled',
    style: {
      strokeWidth: 1.5,
      stroke: edgeColor,
    },
  }), [edgeColor]);
  const schemaGroups = adapter.getSchemaGroups();
  const { getViewport, setViewport } = useReactFlow();

  // Visual groups hook for collapse/hide logic and edge remapping
  const { processedNodes: nodesWithHiddenFlags, edgeRemap } = useVisualGroups(nodes);

  // LOD band for debug display
  const lod = useLodBand();

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

  // Live group resize during drag
  const dragGroupIdRef = useRef<string | null>(null);
  const dragStartGroupSizeRef = useRef<Size | null>(null);
  const rafIdRef = useRef<number | null>(null);

  // Ctrl+drag visual feedback (DOM class toggle, no re-renders)
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  const ctrlDragActiveRef = useRef(false);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, [setNodes]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
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

  // Suppress unused variable warnings - these are passed through for compatibility
  void onDeployablesChange;
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
    updateNodeDeployable,
    updateNodeInstanceColor,
    toggleVirtualParentCollapse,
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

  // Group operations from dedicated hook (uses pure geometry functions)
  const {
    createGroup: createGroupFromIds,
    attachToGroup,
    detachFromGroup,
    toggleGroupCollapse,
    fitGroupToChildren,
  } = useGroupOperations();

  // Wrapper for createGroup that uses current selectedNodeIds
  const createGroup = useCallback(() => {
    createGroupFromIds(selectedNodeIds);
  }, [createGroupFromIds, selectedNodeIds]);

  // Remove a node from its group (same as detach)
  const removeFromGroup = useCallback((nodeId: string) => {
    detachFromGroup(nodeId);
  }, [detachFromGroup]);

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
    createGroup,
  });

  // Note: localStorage persistence is now handled by the document store's subscriber
  // Note: Import is now handled directly in App.tsx via adapter to avoid hook issues

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

  // Update parent with fresh node data whenever nodes change (to keep InstanceEditor in sync)
  useEffect(() => {
    if (selectedNodeIds.length > 0) {
      const selectedNodes = nodes.filter((n) => selectedNodeIds.includes(n.id));
      onSelectionChange?.(selectedNodes);
    }
  }, [nodes, selectedNodeIds, onSelectionChange]);

  // Count children per parent node (both virtual-parent and visual-group)
  const childCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of nodes) {
      if (node.parentId) {
        counts[node.parentId] = (counts[node.parentId] || 0) + 1;
      }
    }
    return counts;
  }, [nodes]);

  // Set of visual group IDs for expandParent assignment
  const visualGroupIds = useMemo(() => new Set(
    nodesWithHiddenFlags.filter(n => n.type === 'visual-group').map(n => n.id)
  ), [nodesWithHiddenFlags]);

  const nodesWithCallbacks = nodesWithHiddenFlags.map((node) => {
    if (node.type === 'visual-group') {
      return {
        ...node,
        dragHandle: NODE_DRAG_HANDLE,
        data: {
          ...node.data,
          childCount: childCountMap[node.id] || 0,
          onToggleCollapse: () => toggleGroupCollapse(node.id),
        },
      };
    }
    if (node.type === 'virtual-parent') {
      return {
        ...node,
        dragHandle: NODE_DRAG_HANDLE,
        data: {
          ...node.data,
          childCount: childCountMap[node.id] || 0,
          onToggleCollapse: () => toggleVirtualParentCollapse(node.id),
        },
      };
    }
    return {
      ...node,
      dragHandle: NODE_DRAG_HANDLE,
      expandParent: node.parentId && visualGroupIds.has(node.parentId) ? true : undefined,
      data: {
        ...node.data,
        nodeId: node.id,
        isRenaming: node.id === renamingNodeId,
        onRename: (newName: string) => renameNode(node.id, newName),
        onValuesChange: (values: ConstructValues) => updateNodeValues(node.id, values),
        onSetViewLevel: (level: 'summary' | 'details') => setNodeViewLevel(node.id, level),
        onToggleDetailsPin: () => toggleNodeDetailsPin(node.id),
        onOpenFullView: () => setFullViewNodeId(node.id),
        deployables,
        onDeployableChange: (deployableId: string | null) => updateNodeDeployable(node.id, deployableId),
        onInstanceColorChange: (color: string | null) => updateNodeInstanceColor(node.id, color),
      },
    };
  });

  // Sort nodes: parents must come before their children (React Flow requirement)
  // This handles both virtual-parent and visual-group nodes
  const sortedNodes = useMemo(() => {
    const result: Node[] = [];
    const added = new Set<string>();

    // Recursive function to add a node and its ancestors first
    const addNode = (node: Node, depth = 0) => {
      if (added.has(node.id) || depth > 20) return;

      // If this node has a parent, add the parent first
      if (node.parentId && !added.has(node.parentId)) {
        const parent = nodesWithCallbacks.find(n => n.id === node.parentId);
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
      // Visual groups and virtual parents always show if any children match
      if (node.type === 'virtual-parent' || node.type === 'visual-group') return true;

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

  // Filter edges: hide edges to/from children of collapsed/no-edges virtual parents
  // Also reroute edges to collapsed visual groups using edgeRemap
  const filteredEdges = useMemo(() => {
    const hiddenChildIds = new Set<string>();
    for (const node of nodes) {
      if (node.type === 'virtual-parent') {
        const vpData = node.data as VirtualParentNodeData;
        if (vpData.collapseState === 'no-edges' || vpData.collapseState === 'collapsed') {
          for (const child of nodes) {
            if (child.parentId === node.id) {
              hiddenChildIds.add(child.id);
            }
          }
        }
      }
    }

    // Apply virtual parent filtering
    let result = hiddenChildIds.size === 0 ? edges : edges.filter(e => !hiddenChildIds.has(e.source) && !hiddenChildIds.has(e.target));

    // Apply visual group edge remapping for collapsed groups
    // edgeRemap maps nodeId -> groupId (where groups are now regular nodes)
    if (edgeRemap.size > 0) {
      const seenEdgeKeys = new Set<string>(); // Dedupe edges to same collapsed group
      result = result.map(edge => {
        const remappedSource = edgeRemap.get(edge.source);
        const remappedTarget = edgeRemap.get(edge.target);

        if (remappedSource || remappedTarget) {
          // Groups are now regular nodes, so use group ID directly
          const newSource = remappedSource || edge.source;
          const newTarget = remappedTarget || edge.target;

          // Skip self-loops to same group
          if (newSource === newTarget) return null;

          // Dedupe edges that now have the same endpoints
          const dedupeKey = `${newSource}-${newTarget}`;
          if (seenEdgeKeys.has(dedupeKey)) return null;
          seenEdgeKeys.add(dedupeKey);

          return {
            ...edge,
            id: `${edge.id}-remapped`,
            source: newSource,
            target: newTarget,
            sourceHandle: remappedSource ? 'group-connect' : edge.sourceHandle,
            targetHandle: remappedTarget ? 'group-connect' : edge.targetHandle,
          };
        }
        return edge;
      }).filter((e): e is Edge => e !== null);
    }

    return result;
  }, [edges, nodes, edgeRemap]);

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

  // Edge bundling: collapse parallel edges between same node pairs
  const { displayEdges } = useEdgeBundling(filteredEdges, nodes);

  // Handle drag start/drag/stop for live group resizing
  const onNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    isDraggingRef.current = true;
    draggedNodesRef.current.add(node.id);

    // If dragged node is a child of a visual-group, capture group size for live resize
    if (node.parentId && node.type !== 'visual-group') {
      const allNodes = reactFlow.getNodes();
      const parentNode = allNodes.find(n => n.id === node.parentId);
      if (parentNode?.type === 'visual-group') {
        dragGroupIdRef.current = parentNode.id;
        dragStartGroupSizeRef.current = {
          width: (parentNode.width as number) ?? (parentNode.style?.width as number) ?? 200,
          height: (parentNode.height as number) ?? (parentNode.style?.height as number) ?? 200,
        };
      } else {
        dragGroupIdRef.current = null;
        dragStartGroupSizeRef.current = null;
      }
    } else {
      dragGroupIdRef.current = null;
      dragStartGroupSizeRef.current = null;
    }
  }, [reactFlow]);

  const onNodeDrag = useCallback((_event: React.MouseEvent, node: Node) => {
    // Toggle Ctrl+drag visual class (no re-render, direct DOM)
    const isCtrl = _event.ctrlKey || _event.metaKey;
    if (isCtrl !== ctrlDragActiveRef.current) {
      ctrlDragActiveRef.current = isCtrl;
      mapWrapperRef.current?.classList.toggle('ctrl-dragging', isCtrl);
    }

    if (!dragGroupIdRef.current || node.type === 'visual-group') return;

    // Cancel previous rAF to throttle
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    const groupId = dragGroupIdRef.current;
    const startSize = dragStartGroupSizeRef.current;

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      const allNodes = reactFlow.getNodes();

      // Get children of this group
      const children = allNodes.filter(n => n.parentId === groupId);
      // Either exclude or include dragged node based on Ctrl
      const relevantChildren = isCtrl
        ? children.filter(n => n.id !== node.id)
        : children;

      if (relevantChildren.length === 0 && isCtrl) {
        // All children removed (Ctrl preview) - snap to start size
        if (startSize) {
          setNodes(nds => nds.map(n =>
            n.id === groupId
              ? { ...n, width: startSize.width, height: startSize.height, style: { ...n.style, width: startSize.width, height: startSize.height } }
              : n
          ));
        }
        return;
      }

      const childGeometries: NodeGeometry[] = relevantChildren.map(n => ({
        position: n.position,
        width: n.width,
        height: n.height,
        measured: n.measured,
      }));

      const minSize = computeMinGroupSize(childGeometries, DEFAULT_GROUP_LAYOUT);

      // During drag: only grow, never shrink below drag-start size (prevents jitter)
      // For Ctrl: use the size-without-dragged-child (which may be smaller)
      const newWidth = isCtrl ? minSize.width : Math.max(startSize?.width ?? 0, minSize.width);
      const newHeight = isCtrl ? minSize.height : Math.max(startSize?.height ?? 0, minSize.height);

      setNodes(nds => nds.map(n =>
        n.id === groupId
          ? { ...n, width: newWidth, height: newHeight, style: { ...n.style, width: newWidth, height: newHeight } }
          : n
      ));
    });
  }, [reactFlow, setNodes]);

  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    isDraggingRef.current = false;
    draggedNodesRef.current.clear();

    // Clear Ctrl+drag visual feedback
    ctrlDragActiveRef.current = false;
    mapWrapperRef.current?.classList.remove('ctrl-dragging');

    // Cancel any pending rAF
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }

    // Clear drag refs
    dragGroupIdRef.current = null;
    dragStartGroupSizeRef.current = null;

    // Don't process group nodes themselves
    if (node.type === 'visual-group') return;

    const isModifier = event.ctrlKey || event.metaKey;

    if (isModifier) {
      // Ctrl+release = change group membership
      const intersecting = reactFlow.getIntersectingNodes(node);
      const targetGroup = intersecting.find(n => n.type === 'visual-group' && n.id !== node.id);

      if (targetGroup && targetGroup.id !== node.parentId) {
        // Attach to new group
        attachToGroup(node.id, targetGroup.id);
      } else if (node.parentId) {
        // Detach from current group
        detachFromGroup(node.id);
      }
    } else if (node.parentId) {
      // Default release = full refit including position shift
      fitGroupToChildren(node.parentId);
    }
  }, [reactFlow, attachToGroup, detachFromGroup, fitGroupToChildren]);

  // Handle visual group selection (click on group selects all nodes in it)
  const handleSelectGroup = useCallback((groupId: string) => {
    const childNodes = nodes.filter(n => n.parentId === groupId);
    const nodeIds = childNodes.map(n => n.id);
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        selected: nodeIds.includes(n.id),
      }))
    );
    setSelectedNodeIds(nodeIds);
  }, [nodes, setNodes, setSelectedNodeIds]);

  // Suppress unused - will be used for group selection via context menu
  void handleSelectGroup;

  // Count visual groups for debug display
  const groupCount = useMemo(() => nodes.filter(n => n.type === 'visual-group').length, [nodes]);
  const debugLines = useMemo(() => [
    `LOD: ${lod.band}`,
    `Groups: ${groupCount} | Nodes: ${sortedNodes.length}`,
  ], [lod.band, groupCount, sortedNodes.length]);

  return (
    <div ref={mapWrapperRef} className="w-full h-full relative" style={{ backgroundColor: 'var(--color-canvas)' }}>
      <ZoomDebug debugLines={debugLines} />
      <ReactFlow
        nodes={sortedNodes}
        edges={displayEdges}
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
        onPaneClick={onPaneClick}
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
          onGroupSelected={createGroup}
          onRemoveFromGroup={removeFromGroup}
          nodeInGroup={(() => {
            if (!contextMenu.nodeId) return false;
            const node = nodes.find(n => n.id === contextMenu.nodeId);
            // Node is in a group if it has a parentId pointing to a visual-group node
            if (!node?.parentId) return false;
            const parent = nodes.find(n => n.id === node.parentId);
            return parent?.type === 'visual-group';
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
            deployables={deployables}
            onClose={() => setFullViewNodeId(null)}
          />
        );
      })()}
    </div>
  );
}
