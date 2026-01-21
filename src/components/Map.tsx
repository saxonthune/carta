import { useCallback, useEffect, useState } from 'react';
import {
  ReactFlow,
  Controls,
  ControlButton,
  Background,
  useNodesState,
  useEdgesState,
  useReactFlow,
  addEdge,
  SelectionMode,
  type Node,
  type Edge,
  type Connection,
  type OnConnect,
  type OnSelectionChangeParams,
  BackgroundVariant,
} from '@xyflow/react';
import CustomNode from '../CustomNode';
import ConstructNode from './ConstructNode';
import ContextMenu, { type ContextMenuType } from '../ContextMenu';
import NodeControls from '../NodeControls';
import AddConstructMenu from './AddConstructMenu';
import DeployableBackground from './DeployableBackground';
import { useUndoRedo } from '../hooks/useUndoRedo';
import { generateSemanticId } from '../utils/cartaFile';
import type { ConstructSchema, ConstructValues, Deployable, ConnectionValue, ConstructNodeData } from '../constructs/types';
import { registry } from '../constructs/registry';
import { canConnect, getPortsForSchema } from '../constructs/ports';

const nodeTypes = {
  custom: CustomNode,
  construct: ConstructNode,
};

const defaultEdgeOptions = {
  style: {
    strokeWidth: 2,
    stroke: '#6366f1',
  },
};

export const STORAGE_KEY = 'react-flow-state';

const loadState = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const { nodes, edges, nodeId, title } = JSON.parse(saved);
      return { nodes, edges, nodeId, title };
    }
  } catch (error) {
    console.error('Failed to load state:', error);
  }
  return null;
};

const savedState = loadState();

export const initialNodes: Node[] = savedState?.nodes || [];
export const initialEdges: Edge[] = savedState?.edges || [];
export const initialTitle: string = savedState?.title || 'Untitled Project';
let nodeId = savedState?.nodeId || 1;

export function getNodeId(): number {
  return nodeId;
}

export function setNodeId(id: number): void {
  nodeId = id;
}

interface ContextMenuState {
  x: number;
  y: number;
  type: ContextMenuType;
  nodeId?: string;
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
  nodeUpdateRef?: React.MutableRefObject<((nodeId: string, updates: Partial<ConstructNodeData>) => void) | null>;
}

export default function Map({ deployables, onDeployablesChange, title, onNodesEdgesChange, onSelectionChange, nodeUpdateRef }: MapProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([]);
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<Node[]>([]);
  const { screenToFlowPosition, getNodes } = useReactFlow();
  const { undo, redo, canUndo, canRedo, takeSnapshot } = useUndoRedo();

  // Suppress unused variable warning - onDeployablesChange is passed to children
  void onDeployablesChange;

  // Expose node update function via ref
  const handleNodeUpdate = useCallback(
    (nodeId: string, updates: Partial<ConstructNodeData>) => {
      setNodes((nds) =>
        nds.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, ...updates } }
            : node
        )
      );
    },
    [setNodes]
  );

  // Set the ref so parent can call this function
  useEffect(() => {
    if (nodeUpdateRef) {
      nodeUpdateRef.current = handleNodeUpdate;
    }
  }, [nodeUpdateRef, handleNodeUpdate]);

  useEffect(() => {
    const saveState = () => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({ nodes, edges, nodeId, title })
        );
      } catch (error) {
        console.error('Failed to save state:', error);
      }
    };

    const timeoutId = setTimeout(saveState, 500);
    return () => clearTimeout(timeoutId);
  }, [nodes, edges, title]);

  // Notify parent of nodes/edges changes for export
  useEffect(() => {
    onNodesEdgesChange(nodes, edges);
  }, [nodes, edges, onNodesEdgesChange]);

  // Helper to get semanticId from a node
  const getNodeSemanticId = useCallback((nodeId: string): string | null => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'construct') return null;
    const data = node.data as ConstructNodeData;
    return data.semanticId || generateSemanticId(data.constructType, data.name);
  }, [nodes]);

  const isValidConnection = useCallback((connection: Edge | Connection): boolean => {
    const { source, target, sourceHandle, targetHandle } = connection;

    // no self-connections and no same-construct connections
    if (!source || !target) return false;
    if (source === target) return false;

    // If handles are missing, we can't validate ports safely
    if (!sourceHandle || !targetHandle) return false;

    const currentNodes = getNodes();
    const sourceNode = currentNodes.find((n) => n.id === source);
    const targetNode = currentNodes.find((n) => n.id === target);
    if (!sourceNode || !targetNode) return false;

    // Only validate port semantics for construct nodes; other node types fall back to default behavior
    if (sourceNode.type !== 'construct' || targetNode.type !== 'construct') return true;

    const sourceData = sourceNode.data as ConstructNodeData;
    const targetData = targetNode.data as ConstructNodeData;
    const sourceSchema = registry.getSchema(sourceData.constructType);
    const targetSchema = registry.getSchema(targetData.constructType);
    if (!sourceSchema || !targetSchema) return false;

    const sourcePorts = getPortsForSchema(sourceSchema.ports);
    const targetPorts = getPortsForSchema(targetSchema.ports);
    const sourcePort = sourcePorts.find((p) => p.id === sourceHandle);
    const targetPort = targetPorts.find((p) => p.id === targetHandle);
    if (!sourcePort || !targetPort) return false;

    // Rules 3, 4, 5: direction pairings (child->parent, out->in, bidi->bidi)
    return canConnect(sourcePort.direction, targetPort.direction);
  }, [getNodes]);

  const onConnect: OnConnect = useCallback(
    (params) => {
      takeSnapshot();

      // Store connection on source node's data
      if (params.source && params.sourceHandle && params.target && params.targetHandle) {
        const targetSemanticId = getNodeSemanticId(params.target);
        if (targetSemanticId) {
          const newConnection: ConnectionValue = {
            portId: params.sourceHandle,
            targetSemanticId,
            targetPortId: params.targetHandle,
          };

          setNodes((nds) =>
            nds.map((node) => {
              if (node.id === params.source && node.type === 'construct') {
                const data = node.data as ConstructNodeData;
                const existingConnections = data.connections || [];
                // Avoid duplicates
                const alreadyExists = existingConnections.some(
                  c => c.portId === newConnection.portId &&
                       c.targetSemanticId === newConnection.targetSemanticId &&
                       c.targetPortId === newConnection.targetPortId
                );
                if (alreadyExists) return node;

                return {
                  ...node,
                  data: {
                    ...data,
                    connections: [...existingConnections, newConnection],
                  },
                };
              }
              return node;
            })
          );
        }
      }

      // Also add edge for visual rendering
      setEdges((eds) => addEdge(params, eds));
    },
    [setEdges, setNodes, takeSnapshot, getNodeSemanticId]
  );

  // Handle edge deletion - remove connection data from nodes
  const handleEdgesDelete = useCallback(
    (deletedEdges: Edge[]) => {
      setNodes((nds) =>
        nds.map((node) => {
          if (node.type !== 'construct') return node;
          const data = node.data as ConstructNodeData;
          if (!data.connections || data.connections.length === 0) return node;

          // Find edges that were deleted from this node
          const edgesFromThisNode = deletedEdges.filter(e => e.source === node.id);
          if (edgesFromThisNode.length === 0) return node;

          // Remove connections that match deleted edges
          const updatedConnections = data.connections.filter(conn => {
            return !edgesFromThisNode.some(edge =>
              edge.sourceHandle === conn.portId &&
              edge.targetHandle === conn.targetPortId
            );
          });

          if (updatedConnections.length === data.connections.length) return node;

          return {
            ...node,
            data: {
              ...data,
              connections: updatedConnections,
            },
          };
        })
      );
    },
    [setNodes]
  );

  const addConstruct = useCallback(
    (schema: ConstructSchema, x: number, y: number) => {
      takeSnapshot();
      const position = screenToFlowPosition({ x, y });
      const id = String(nodeId++);

      const values: ConstructValues = {};
      schema.fields.forEach((field) => {
        if (field.default !== undefined) {
          values[field.name] = field.default;
        }
      });

      const nodeName = `${schema.displayName} ${id}`;
      const semanticId = generateSemanticId(schema.type, nodeName);

      const newNode: Node = {
        id,
        type: 'construct',
        position,
        data: {
          constructType: schema.type,
          name: nodeName,
          semanticId,
          values,
          isExpanded: true,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, screenToFlowPosition, takeSnapshot]
  );

  const addNode = useCallback(
    (x?: number, y?: number) => {
      if (x !== undefined && y !== undefined) {
        setAddMenu({ x, y });
      } else {
        setAddMenu({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      }
    },
    []
  );

  const deleteNode = useCallback(
    (nodeIdToDelete: string) => {
      takeSnapshot();
      setNodes((nds) => nds.filter((n) => n.id !== nodeIdToDelete));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeIdToDelete && e.target !== nodeIdToDelete)
      );
      setSelectedNodeIds((ids) => ids.filter((id) => id !== nodeIdToDelete));
    },
    [setNodes, setEdges, takeSnapshot]
  );

  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    takeSnapshot();
    const idsToDelete = new Set(selectedNodeIds);
    setNodes((nds) => nds.filter((n) => !idsToDelete.has(n.id)));
    setEdges((eds) =>
      eds.filter((e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target))
    );
    setSelectedNodeIds([]);
  }, [selectedNodeIds, setNodes, setEdges, takeSnapshot]);

  const renameNode = useCallback(
    (nodeIdToRename: string, newName: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeIdToRename) return n;

          if (n.type === 'construct') {
            return {
              ...n,
              data: { ...n.data, name: newName },
            };
          }
          return {
            ...n,
            data: { ...n.data, label: newName },
          };
        })
      );
      setRenamingNodeId(null);
    },
    [setNodes]
  );

  const updateNodeValues = useCallback(
    (nodeIdToUpdate: string, newValues: ConstructValues) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeIdToUpdate
            ? { ...n, data: { ...n.data, values: newValues } }
            : n
        )
      );
    },
    [setNodes]
  );

  const toggleNodeExpand = useCallback(
    (nodeIdToToggle: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeIdToToggle
            ? { ...n, data: { ...n.data, isExpanded: !n.data.isExpanded } }
            : n
        )
      );
    },
    [setNodes]
  );

  const updateNodeDeployable = useCallback(
    (nodeIdToUpdate: string, deployableId: string | null) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeIdToUpdate
            ? { ...n, data: { ...n.data, deployableId } }
            : n
        )
      );
    },
    [setNodes]
  );

  const copyNodes = useCallback(
    (nodeIdsToCopy?: string[]) => {
      const ids = nodeIdsToCopy || selectedNodeIds;
      if (ids.length === 0) return;

      const nodesToCopy = nodes.filter((n) => ids.includes(n.id));
      if (nodesToCopy.length > 0) {
        setClipboard(JSON.parse(JSON.stringify(nodesToCopy)));
      }
    },
    [nodes, selectedNodeIds]
  );

  const pasteNodes = useCallback(
    (x?: number, y?: number) => {
      if (clipboard.length === 0) return;

      takeSnapshot();

      const minX = Math.min(...clipboard.map((n) => n.position.x));
      const minY = Math.min(...clipboard.map((n) => n.position.y));

      const basePosition =
        x !== undefined && y !== undefined
          ? screenToFlowPosition({ x, y })
          : { x: minX + 50, y: minY + 50 };

      const newNodes: Node[] = clipboard.map((clipNode) => {
        const newId = String(nodeId++);

        const offsetX = clipNode.position.x - minX;
        const offsetY = clipNode.position.y - minY;

        const position = {
          x: basePosition.x + offsetX,
          y: basePosition.y + offsetY,
        };

        const originalName = clipNode.data.name || clipNode.data.label || 'Node';
        const newName = clipNode.data.name ? `${originalName} (copy)` : undefined;
        const semanticId = (clipNode.data.constructType && typeof clipNode.data.constructType === 'string' && newName)
          ? generateSemanticId(clipNode.data.constructType, newName)
          : undefined;

        return {
          ...clipNode,
          id: newId,
          position,
          selected: false,
          data: {
            ...clipNode.data,
            name: newName,
            label: clipNode.data.label ? `${originalName} (copy)` : undefined,
            semanticId,
          },
        };
      });

      setNodes((nds) => [...nds, ...newNodes]);
    },
    [clipboard, setNodes, screenToFlowPosition, takeSnapshot]
  );

  const startRename = useCallback(() => {
    if (selectedNodeIds.length === 1) {
      setRenamingNodeId(selectedNodeIds[0]);
    }
  }, [selectedNodeIds]);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        if (selectedNodeIds.length > 0) {
          event.preventDefault();
          copyNodes();
        }
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        if (clipboard.length > 0) {
          event.preventDefault();
          pasteNodes();
        }
        return;
      }

      if (selectedNodeIds.length === 0) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelectedNodes();
      } else if (event.key === 'F2' && selectedNodeIds.length === 1) {
        event.preventDefault();
        startRename();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, deleteSelectedNodes, startRename, undo, redo, copyNodes, pasteNodes, clipboard]);

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'pane',
      });
    },
    []
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'node',
        nodeId: node.id,
      });
    },
    []
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setAddMenu(null);
  }, []);

  const nodesWithCallbacks = nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      isRenaming: node.id === renamingNodeId,
      onRename: (newName: string) => renameNode(node.id, newName),
      onValuesChange: (values: ConstructValues) => updateNodeValues(node.id, values),
      onToggleExpand: () => toggleNodeExpand(node.id),
      onDoubleClick: () => setRenamingNodeId(node.id),
      deployables,
      onDeployableChange: (deployableId: string | null) => updateNodeDeployable(node.id, deployableId),
    },
  }));

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onEdgesDelete={handleEdgesDelete}
        onConnect={onConnect}
        isValidConnection={isValidConnection}
        onSelectionChange={handleSelectionChange}
        onPaneContextMenu={onPaneContextMenu}
        onNodeContextMenu={onNodeContextMenu}
        onPaneClick={onPaneClick}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        selectionOnDrag
        selectionMode={SelectionMode.Partial}
        fitView
      >
        <Controls position="top-left">
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
        <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
        <DeployableBackground nodes={nodesWithCallbacks} deployables={deployables} />
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
          selectedCount={selectedNodeIds.length}
          onAddNode={addNode}
          onDeleteNode={deleteNode}
          onDeleteSelected={deleteSelectedNodes}
          onCopyNodes={copyNodes}
          onPasteNodes={pasteNodes}
          canPaste={clipboard.length > 0}
          onClose={closeContextMenu}
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
    </div>
  );
}
