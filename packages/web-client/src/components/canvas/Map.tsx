import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Controls,
  ControlButton,
  Background,
  applyNodeChanges,
  applyEdgeChanges,
  SelectionMode,
  useStore,
  useReactFlow,
  useUpdateNodeInternals,
  type Node,
  type Edge,
  type OnSelectionChangeParams,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
} from '@xyflow/react';
import { useDocument } from '../../hooks/useDocument';
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
import type { ConstructValues, Deployable, ConstructNodeData, VirtualParentNodeData, VisualGroupNodeData } from '@carta/domain';
import { useVisualGroups } from '../../hooks/useVisualGroups';
import { generateDeployableColor } from '@carta/document';

// Constants for group layout
const GROUP_PADDING = 20;
const GROUP_HEADER_HEIGHT = 40;
import ConstructEditor from '../ConstructEditor';
import DynamicAnchorEdge from './DynamicAnchorEdge';
import ConstructFullViewModal from '../modals/ConstructFullViewModal';
import { useEdgeBundling } from '../../hooks/useEdgeBundling';
import { getLodConfig } from './lod/lodPolicy';

// Temporary debug component for LOD and visual groups
function ZoomDebug({ groupCount, sortedNodeCount }: { groupCount: number; sortedNodeCount: number }) {
  const zoom = useStore((state) => state.transform[2]);
  const lod = getLodConfig(zoom);
  const { getViewport, setViewport } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');

  const commitZoom = () => {
    setEditing(false);
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed)) return;
    const clamped = Math.min(Math.max(parsed, 0.15), 2);
    const { x, y } = getViewport();
    setViewport({ x, y, zoom: clamped }, { duration: 200 });
  };

  return (
    <div className="absolute bottom-8 left-2 bg-black/80 text-white px-3 py-2 rounded text-xs font-mono z-50">
      <div className="flex items-center gap-1">
        <span>Zoom:</span>
        {editing ? (
          <input
            autoFocus
            className="w-14 bg-transparent border-b border-white/50 text-white text-xs font-mono outline-none"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={commitZoom}
            onKeyDown={(e) => { if (e.key === 'Enter') commitZoom(); if (e.key === 'Escape') setEditing(false); }}
          />
        ) : (
          <span
            className="cursor-pointer border-b border-transparent hover:border-white/50"
            onClick={() => { setInputValue(zoom.toFixed(3)); setEditing(true); }}
          >
            {zoom.toFixed(3)}
          </span>
        )}
      </div>
      <div>LOD: {lod.band}</div>
      <div>Groups: {groupCount} | Nodes: {sortedNodeCount}</div>
    </div>
  );
}

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
  const { nodes, edges, setNodes, setEdges, getSchema, levels, activeLevel, copyNodesToLevel } = useDocument();
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

  // Create a new visual group from selected nodes using native React Flow parentId
  const createGroup = useCallback(() => {
    if (selectedNodeIds.length < 2) return;

    const groupId = crypto.randomUUID();
    const color = generateDeployableColor();

    // Compute bounds from selected nodes
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const node of selectedNodes) {
      const w = node.measured?.width ?? node.width ?? 200;
      const h = node.measured?.height ?? node.height ?? 100;
      minX = Math.min(minX, node.position.x);
      minY = Math.min(minY, node.position.y);
      maxX = Math.max(maxX, node.position.x + w);
      maxY = Math.max(maxY, node.position.y + h);
    }

    const groupPosition = { x: minX - GROUP_PADDING, y: minY - GROUP_PADDING - GROUP_HEADER_HEIGHT };
    const groupWidth = maxX - minX + GROUP_PADDING * 2;
    const groupHeight = maxY - minY + GROUP_PADDING * 2 + GROUP_HEADER_HEIGHT;

    // Create the group node
    const groupNode: Node<VisualGroupNodeData> = {
      id: groupId,
      type: 'visual-group',
      position: groupPosition,
      style: { width: groupWidth, height: groupHeight },
      data: {
        isVisualGroup: true,
        name: 'New Group',
        color,
        collapsed: false,
      },
    };

    // Update children with parentId and convert to relative positions
    const updatedNodes = nodes.map(n => {
      if (selectedNodeIds.includes(n.id)) {
        return {
          ...n,
          parentId: groupId,
          extent: 'parent' as const,
          position: {
            x: n.position.x - groupPosition.x,
            y: n.position.y - groupPosition.y,
          },
        };
      }
      return n;
    });

    // Group node must come before its children (React Flow requirement)
    setNodes([groupNode, ...updatedNodes]);
  }, [selectedNodeIds, nodes, setNodes]);

  // Attach a node to a group (convert to relative position)
  const attachToGroup = useCallback((nodeId: string, groupId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    const group = nodes.find(n => n.id === groupId);
    if (!node || !group) return;

    const relativePosition = {
      x: node.position.x - group.position.x,
      y: node.position.y - group.position.y,
    };

    setNodes(nds => nds.map(n =>
      n.id === nodeId
        ? { ...n, parentId: groupId, extent: 'parent' as const, position: relativePosition }
        : n
    ));
  }, [nodes, setNodes]);

  // Detach a node from its group (convert to absolute position)
  const detachFromGroup = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node?.parentId) return;

    const parent = nodes.find(n => n.id === node.parentId);
    const absolutePosition = parent
      ? { x: node.position.x + parent.position.x, y: node.position.y + parent.position.y }
      : node.position;

    setNodes(nds => nds.map(n =>
      n.id === nodeId
        ? { ...n, parentId: undefined, extent: undefined, position: absolutePosition }
        : n
    ));
  }, [nodes, setNodes]);

  // Resize group to fit its children
  const resizeGroupToFitChildren = useCallback((groupId: string) => {
    const children = nodes.filter(n => n.parentId === groupId);
    if (children.length === 0) return;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    for (const child of children) {
      const w = child.measured?.width ?? child.width ?? 200;
      const h = child.measured?.height ?? child.height ?? 100;
      minX = Math.min(minX, child.position.x);
      minY = Math.min(minY, child.position.y);
      maxX = Math.max(maxX, child.position.x + w);
      maxY = Math.max(maxY, child.position.y + h);
    }

    const newWidth = maxX - minX + GROUP_PADDING * 2;
    const newHeight = maxY - minY + GROUP_PADDING * 2 + GROUP_HEADER_HEIGHT;

    setNodes(nds => nds.map(n =>
      n.id === groupId
        ? { ...n, style: { ...n.style, width: newWidth, height: newHeight } }
        : n
    ));
  }, [nodes, setNodes]);

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
  const { schemas } = useDocument();
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

  // Toggle visual group collapse state
  const toggleGroupCollapse = useCallback((groupId: string) => {
    setNodes(nds => nds.map(n => {
      if (n.id === groupId && n.type === 'visual-group') {
        const data = n.data as VisualGroupNodeData;
        return { ...n, data: { ...data, collapsed: !data.collapsed } };
      }
      return n;
    }));
  }, [setNodes]);

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

  // Handle drag start/stop
  const onNodeDragStart = useCallback((_event: React.MouseEvent, node: Node) => {
    isDraggingRef.current = true;
    draggedNodesRef.current.add(node.id);
  }, []);

  const onNodeDragStop = useCallback((event: React.MouseEvent, node: Node) => {
    isDraggingRef.current = false;
    draggedNodesRef.current.clear();

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
      // Default release = resize parent to fit
      resizeGroupToFitChildren(node.parentId);
    }
  }, [reactFlow, attachToGroup, detachFromGroup, resizeGroupToFitChildren]);

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

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: 'var(--color-canvas)' }}>
      <ZoomDebug groupCount={groupCount} sortedNodeCount={sortedNodes.length} />
      <ReactFlow
        nodes={sortedNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeDragStart={onNodeDragStart}
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
