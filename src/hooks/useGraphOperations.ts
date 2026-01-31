import { useCallback } from 'react';
import { useReactFlow, useUpdateNodeInternals, type Node } from '@xyflow/react';
import { useDocument } from './useDocument';
import { generateSemanticId } from '../utils/cartaFile';
import { getHandleType } from '@carta/domain';
import type { ConstructSchema, ConstructValues, ConnectionValue, ConstructNodeData, VirtualParentNodeData } from '@carta/domain';


interface UseGraphOperationsOptions {
  selectedNodeIds: string[];
  setSelectedNodeIds: React.Dispatch<React.SetStateAction<string[]>>;
  setRenamingNodeId: React.Dispatch<React.SetStateAction<string | null>>;
  setAddMenu: React.Dispatch<React.SetStateAction<{ x: number; y: number } | null>>;
}

export interface UseGraphOperationsResult {
  addConstruct: (schema: ConstructSchema, x: number, y: number) => void;
  addRelatedConstruct: (sourceNodeId: string, constructType: string, fromPortId?: string, toPortId?: string) => void;
  addNode: (x?: number, y?: number) => void;
  deleteNode: (nodeId: string) => void;
  deleteSelectedNodes: () => void;
  renameNode: (nodeId: string, newSemanticId: string) => void;
  updateNodeValues: (nodeId: string, values: ConstructValues) => void;
  toggleNodeExpand: (nodeId: string) => void;
  updateNodeDeployable: (nodeId: string, deployableId: string | null) => void;
  updateNodeInstanceColor: (nodeId: string, color: string | null) => void;
  createVirtualParent: (parentNodeId: string, portId: string) => void;
  toggleVirtualParentCollapse: (virtualParentId: string) => void;
  removeVirtualParent: (virtualParentId: string) => void;
}

export function useGraphOperations(options: UseGraphOperationsOptions): UseGraphOperationsResult {
  const { selectedNodeIds, setSelectedNodeIds, setRenamingNodeId, setAddMenu } = options;
  const { nodes, setNodes, setEdges, getNextNodeId, getSchema, updateNode } = useDocument();
  const { screenToFlowPosition } = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();

  const addConstruct = useCallback(
    (schema: ConstructSchema, x: number, y: number) => {
      const position = screenToFlowPosition({ x, y });
      const id = getNextNodeId();

      const values: ConstructValues = {};
      if (Array.isArray(schema.fields)) {
        schema.fields.forEach((field) => {
          if (field.default !== undefined) {
            values[field.name] = field.default;
          }
        });
      }

      const semanticId = generateSemanticId(schema.type);

      const newNode: Node = {
        id,
        type: 'construct',
        position,
        data: {
          constructType: schema.type,
          semanticId,
          values,
          isExpanded: false,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, screenToFlowPosition, getNextNodeId]
  );

  // Add a related construct near the source node and optionally connect them
  const addRelatedConstruct = useCallback(
    (sourceNodeId: string, constructType: string, fromPortId?: string, toPortId?: string) => {
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (!sourceNode) return;

      const schema = getSchema(constructType);
      if (!schema) return;

      // Position the new node to the right of the source node
      const newPosition = {
        x: sourceNode.position.x + 320,
        y: sourceNode.position.y,
      };

      const id = getNextNodeId();
      const values: ConstructValues = {};
      if (Array.isArray(schema.fields)) {
        schema.fields.forEach((field) => {
          if (field.default !== undefined) {
            values[field.name] = field.default;
          }
        });
      }

      const semanticId = generateSemanticId(schema.type);

      const newNode: Node = {
        id,
        type: 'construct',
        position: newPosition,
        data: {
          constructType: schema.type,
          semanticId,
          values,
          isExpanded: false,
        },
      };

      // If both ports are specified, create connection using explicit pair
      if (fromPortId && toPortId) {
        // Determine edge direction based on port polarity
        // React Flow edges must go from type="source" handle to type="target" handle
        // getHandleType returns 'source' for source/bidirectional polarity, 'target' for sink polarity
        const sourceData = sourceNode.data as ConstructNodeData;
        const sourceSchema = getSchema(sourceData.constructType);
        const sourcePort = sourceSchema?.ports?.find(p => p.id === fromPortId);
        const fromHandleType = sourcePort ? getHandleType(sourcePort.portType) : 'source';

        // If fromPort is a target handle (sink polarity), we need to flip the edge direction
        // The "from" node becomes the edge target, and the new node becomes the edge source
        const edgeFlipped = fromHandleType === 'target';

        // Connection data always records the semantic relationship (from original source's perspective)
        const newConnection: ConnectionValue = {
          portId: fromPortId,
          targetSemanticId: semanticId,
          targetPortId: toPortId,
        };

        // Step 1: Add ONLY the new node (don't touch existing nodes)
        // This preserves React Flow's handle registrations on existing nodes
        setNodes((nds) => [...nds, newNode]);

        // Step 2: Update source node's connections via surgical update
        // This uses Yjs's updateNode which doesn't clear/replace, preserving handles
        updateNode(sourceNodeId, {
          connections: [...(sourceData.connections || []), newConnection],
        });

        // Step 3: Create the edge after React Flow has rendered the new node
        // Use requestAnimationFrame to wait for browser paint + React Flow update
        requestAnimationFrame(() => {
          // Update internals for both nodes to ensure handles are registered
          updateNodeInternals([sourceNodeId, id]);

          // Create edge on next frame after internals are updated
          requestAnimationFrame(() => {
            // Edge direction depends on port polarity
            const edge = edgeFlipped
              ? {
                  // Flipped: new node is source, original node is target
                  id: `edge-${id}-${toPortId}-${sourceNodeId}-${fromPortId}`,
                  source: id,
                  target: sourceNodeId,
                  sourceHandle: toPortId,
                  targetHandle: fromPortId,
                }
              : {
                  // Normal: original node is source, new node is target
                  id: `edge-${sourceNodeId}-${fromPortId}-${id}-${toPortId}`,
                  source: sourceNodeId,
                  target: id,
                  sourceHandle: fromPortId,
                  targetHandle: toPortId,
                };
            setEdges((eds) => [...eds, edge]);
          });
        });
        return;
      }

      // If no ports specified, just add the node
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes, setEdges, getNextNodeId, getSchema, updateNodeInternals, updateNode]
  );

  const addNode = useCallback(
    (x?: number, y?: number) => {
      if (x !== undefined && y !== undefined) {
        setAddMenu({ x, y });
      } else {
        setAddMenu({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
      }
    },
    [setAddMenu]
  );

  const deleteNode = useCallback(
    (nodeIdToDelete: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeIdToDelete));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeIdToDelete && e.target !== nodeIdToDelete)
      );
      setSelectedNodeIds((ids) => ids.filter((id) => id !== nodeIdToDelete));
    },
    [setNodes, setEdges, setSelectedNodeIds]
  );

  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    const idsToDelete = new Set(selectedNodeIds);
    setNodes((nds) => nds.filter((n) => !idsToDelete.has(n.id)));
    setEdges((eds) =>
      eds.filter((e) => !idsToDelete.has(e.source) && !idsToDelete.has(e.target))
    );
    setSelectedNodeIds([]);
  }, [selectedNodeIds, setNodes, setEdges, setSelectedNodeIds]);

  const renameNode = useCallback(
    (nodeIdToRename: string, newSemanticId: string) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeIdToRename) return n;

          if (n.type === 'construct') {
            return {
              ...n,
              data: { ...n.data, semanticId: newSemanticId },
            };
          }
          return {
            ...n,
            data: { ...n.data, label: newSemanticId },
          };
        })
      );
      setRenamingNodeId(null);
    },
    [setNodes, setRenamingNodeId]
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

  const createVirtualParent = useCallback(
    (parentNodeId: string, portId: string) => {
      const parentNode = nodes.find(n => n.id === parentNodeId);
      if (!parentNode) return;

      const parentData = parentNode.data as ConstructNodeData;
      const schema = getSchema(parentData.constructType);
      const port = schema?.ports?.find(p => p.id === portId);
      if (!port) return;

      // Find the complement port type using the port schema's expectedComplement
      const portSchemaId = port.portType;
      // The complement is what this port connects to
      const complementPortId = portSchemaId === 'parent' ? 'child' :
                               portSchemaId === 'child' ? 'parent' :
                               portSchemaId === 'flow-out' ? 'flow-in' :
                               portSchemaId === 'flow-in' ? 'flow-out' :
                               portSchemaId;

      const id = getNextNodeId();
      const vpData: VirtualParentNodeData = {
        isVirtualParent: true,
        parentNodeId,
        parentSemanticId: parentData.semanticId,
        groupingPortId: portId,
        complementPortId,
        label: port.label || portSchemaId,
        color: schema?.color || '#6b7280',
        collapseState: 'expanded',
      };

      const newNode: Node = {
        id,
        type: 'virtual-parent',
        position: {
          x: parentNode.position.x + 50,
          y: parentNode.position.y + 200,
        },
        data: vpData,
        style: { width: 300, height: 200 },
      };

      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes, getNextNodeId, getSchema]
  );

  const toggleVirtualParentCollapse = useCallback(
    (virtualParentId: string) => {
      setNodes((nds) => {
        const vpNode = nds.find(n => n.id === virtualParentId);
        if (!vpNode || vpNode.type !== 'virtual-parent') return nds;

        const vpData = vpNode.data as VirtualParentNodeData;
        const nextState = vpData.collapseState === 'expanded' ? 'no-edges' :
                          vpData.collapseState === 'no-edges' ? 'collapsed' : 'expanded';

        return nds.map(n => {
          if (n.id === virtualParentId) {
            return { ...n, data: { ...n.data, collapseState: nextState } };
          }
          // Toggle child visibility
          if (n.parentId === virtualParentId) {
            return { ...n, hidden: nextState === 'collapsed' };
          }
          return n;
        });
      });
    },
    [setNodes]
  );

  const updateNodeInstanceColor = useCallback(
    (nodeIdToUpdate: string, color: string | null) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeIdToUpdate
            ? { ...n, data: { ...n.data, instanceColor: color } }
            : n
        )
      );
    },
    [setNodes]
  );

  const removeVirtualParent = useCallback(
    (virtualParentId: string) => {
      setNodes((nds) =>
        nds
          .filter(n => n.id !== virtualParentId)
          .map(n => {
            // Un-parent children
            if (n.parentId === virtualParentId) {
              const { parentId, ...rest } = n;
              void parentId;
              return { ...rest, hidden: false };
            }
            return n;
          })
      );
      // Remove edges to/from virtual parent
      setEdges((eds) =>
        eds.filter(e => e.source !== virtualParentId && e.target !== virtualParentId)
      );
    },
    [setNodes, setEdges]
  );

  return {
    addConstruct,
    addRelatedConstruct,
    addNode,
    deleteNode,
    deleteSelectedNodes,
    renameNode,
    updateNodeValues,
    toggleNodeExpand,
    updateNodeDeployable,
    updateNodeInstanceColor,
    createVirtualParent,
    toggleVirtualParentCollapse,
    removeVirtualParent,
  };
}

export default useGraphOperations;
