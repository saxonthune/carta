import { useCallback, useEffect, useState, useMemo } from 'react';
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
  type Node,
  type Edge,
  type OnSelectionChangeParams,
  type NodeChange,
  type EdgeChange,
  BackgroundVariant,
} from '@xyflow/react';
import { useDocument } from '../hooks/useDocument';
import { useDocumentContext } from '../contexts/DocumentContext';
import CustomNode from '../CustomNode';
import ConstructNode from './ConstructNode';
import VirtualParentNode from './VirtualParentNode';
import ContextMenu, { type ContextMenuType, type RelatedConstructOption } from '../ContextMenu';
import NodeControls from '../NodeControls';
import AddConstructMenu from './AddConstructMenu';
import DeployableBackground from './DeployableBackground';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { useGraphOperations } from '../hooks/useGraphOperations';
import { useConnections } from '../hooks/useConnections';
import { useClipboard } from '../hooks/useClipboard';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import type { ConstructValues, Deployable, ConstructNodeData, VirtualParentNodeData } from '@carta/domain';
import SchemaCreationWizard from './SchemaCreationWizard';
import BundledEdge from './BundledEdge';
import ConstructFullViewModal from './ConstructFullViewModal';
import { useEdgeBundling } from '../hooks/useEdgeBundling';
import { getLodConfig } from './lod/lodPolicy';

// Temporary debug component for LOD
function ZoomDebug() {
  const zoom = useStore((state) => state.transform[2]);
  const lod = getLodConfig(zoom);
  return (
    <div className="absolute bottom-8 left-2 bg-black/80 text-white px-3 py-2 rounded text-xs font-mono z-50 pointer-events-none">
      <div>Zoom: {zoom.toFixed(3)}</div>
      <div>LOD: {lod.band}</div>
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
  construct: ConstructNode,
  'virtual-parent': VirtualParentNode,
};

const edgeTypes = {
  bundled: BundledEdge,
};

// Restrict dragging to header only - allows clicking fields to edit
const NODE_DRAG_HANDLE = '.node-drag-handle';

const defaultEdgeOptions = {
  type: 'bundled',
  style: {
    strokeWidth: 2,
    stroke: '#6366f1',
  },
};

interface ContextMenuState {
  x: number;
  y: number;
  type: ContextMenuType;
  nodeId?: string;
  edgeId?: string;
}

interface AddMenuState {
  x: number;
  y: number;
}

export interface MapProps {
  deployables: Deployable[];
  onDeployablesChange: () => void;
  title: string;
  onNodesEdgesChange: (nodes: Node[], edges: Edge[]) => void;
  onSelectionChange?: (selectedNodes: Node[]) => void;
  onNodeDoubleClick?: (nodeId: string) => void;
}

export default function Map({ deployables, onDeployablesChange, title, onNodesEdgesChange, onSelectionChange, onNodeDoubleClick }: MapProps) {
  const { nodes, edges, setNodes, setEdges, getSchema, levels, activeLevel, copyNodesToLevel } = useDocument();
  const { adapter } = useDocumentContext();
  const schemaGroups = adapter.getSchemaGroups();
  const { zoomIn: reactFlowZoomIn, zoomOut: reactFlowZoomOut, getViewport, setViewport } = useReactFlow();

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
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
  }, [setNodes]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
  }, [setEdges]);

  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [showSchemaWizard, setShowSchemaWizard] = useState(false);
  const [fullViewNodeId, setFullViewNodeId] = useState<string | null>(null);
  const { undo, redo, canUndo, canRedo } = useUndoRedo();

  // Track mouse movement for context menu detection
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);

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

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();

      // Only show context menu if mouse hasn't moved significantly
      // If mouseDownPos is null, show menu anyway (event timing edge case)
      let shouldShowMenu = true;

      if (mouseDownPos) {
        const dx = Math.abs(event.clientX - mouseDownPos.x);
        const dy = Math.abs(event.clientY - mouseDownPos.y);
        const threshold = 5; // pixels

        if (dx >= threshold || dy >= threshold) {
          shouldShowMenu = false;
        }
      }

      if (shouldShowMenu) {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          type: 'pane',
        });
      }

      setMouseDownPos(null);
    },
    [mouseDownPos]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();

      // Only show context menu if mouse hasn't moved significantly
      // If mouseDownPos is null, show menu anyway (event timing edge case)
      let shouldShowMenu = true;

      if (mouseDownPos) {
        const dx = Math.abs(event.clientX - mouseDownPos.x);
        const dy = Math.abs(event.clientY - mouseDownPos.y);
        const threshold = 5; // pixels

        if (dx >= threshold || dy >= threshold) {
          shouldShowMenu = false;
        }
      }

      if (shouldShowMenu) {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          type: 'node',
          nodeId: node.id,
        });
      }

      setMouseDownPos(null);
    },
    [mouseDownPos]
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault();

      // Only show context menu if mouse hasn't moved significantly
      // If mouseDownPos is null, show menu anyway (event timing edge case)
      let shouldShowMenu = true;

      if (mouseDownPos) {
        const dx = Math.abs(event.clientX - mouseDownPos.x);
        const dy = Math.abs(event.clientY - mouseDownPos.y);
        const threshold = 5; // pixels

        if (dx >= threshold || dy >= threshold) {
          shouldShowMenu = false;
        }
      }

      if (shouldShowMenu) {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          type: 'edge',
          edgeId: edge.id,
        });
      }

      setMouseDownPos(null);
    },
    [mouseDownPos]
  );

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    // Track mouse position on right-click
    if (event.button === 2) {
      setMouseDownPos({ x: event.clientX, y: event.clientY });
    }
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setAddMenu(null);
  }, []);

  // Count children per virtual parent for display
  const childCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of nodes) {
      if (node.parentId) {
        counts[node.parentId] = (counts[node.parentId] || 0) + 1;
      }
    }
    return counts;
  }, [nodes]);

  const nodesWithCallbacks = nodes.map((node) => {
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

  // Sort nodes: virtual parents before their children (React Flow requirement)
  const sortedNodes = useMemo(() => {
    return [...nodesWithCallbacks].sort((a, b) => {
      if (a.type === 'virtual-parent' && b.parentId === a.id) return -1;
      if (b.type === 'virtual-parent' && a.parentId === b.id) return 1;
      return 0;
    });
  }, [nodesWithCallbacks]);

  // Filter edges: hide edges to/from children of collapsed/no-edges virtual parents
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
    if (hiddenChildIds.size === 0) return edges;
    return edges.filter(e => !hiddenChildIds.has(e.source) && !hiddenChildIds.has(e.target));
  }, [edges, nodes]);

  // Auto-revert unpinned details nodes when deselected
  useEffect(() => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.type !== 'construct') return n;
        const d = n.data as ConstructNodeData;
        if (d.viewLevel === 'details' && !d.isDetailsPinned && !selectedNodeIds.includes(n.id)) {
          return { ...n, data: { ...n.data, viewLevel: 'summary' } };
        }
        return n;
      })
    );
  }, [selectedNodeIds, setNodes]);

  // Edge bundling: collapse parallel edges between same node pairs
  const { displayEdges } = useEdgeBundling(filteredEdges, nodes);

  return (
    <div className="w-full h-full relative" style={{ backgroundColor: 'var(--color-canvas)' }}>
      <ZoomDebug />
      <ReactFlow
        nodes={sortedNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
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
        <DeployableBackground nodes={sortedNodes} deployables={deployables} />
      </ReactFlow>

      {selectedNodeIds.length > 0 && (
        <NodeControls
          selectedCount={selectedNodeIds.length}
          onRename={startRename}
          onDelete={deleteSelectedNodes}
          onCopy={copyNodes}
        />
      )}

      <div className="absolute top-4 right-4 flex gap-2 z-10">
        <button
          className="px-5 py-2.5 text-sm font-medium bg-accent text-white border-none rounded-lg cursor-pointer shadow-md hover:bg-accent-hover hover:-translate-y-0.5 transition-all"
          onClick={() => addNode()}
        >
          + Add Construct
        </button>
      </div>

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
          onNewConstructSchema={() => setShowSchemaWizard(true)}
          levels={levels}
          activeLevel={activeLevel}
          selectedNodeIds={selectedNodeIds}
          onCopyNodesToLevel={copyNodesToLevel}
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

      <SchemaCreationWizard
        isOpen={showSchemaWizard}
        onClose={() => setShowSchemaWizard(false)}
      />

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
