import { useCallback } from 'react';
import { useReactFlow, useUpdateNodeInternals, type Node } from '@xyflow/react';
import { useNodes } from './useNodes';
import { useEdges } from './useEdges';
import { useSchemas } from './useSchemas';
import { generateSemanticId } from '../utils/cartaFile';
import { getHandleType } from '@carta/domain';
import type { ConstructSchema, ConstructValues, ConnectionValue, ConstructNodeData } from '@carta/domain';


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
  setNodeViewLevel: (nodeId: string, level: 'summary' | 'details') => void;
  toggleNodeDetailsPin: (nodeId: string) => void;
  updateNodeInstanceColor: (nodeId: string, color: string | null) => void;
}

export function useGraphOperations(options: UseGraphOperationsOptions): UseGraphOperationsResult {
  const { selectedNodeIds, setSelectedNodeIds, setRenamingNodeId, setAddMenu } = options;
  const { nodes, setNodes, updateNode, getNextNodeId } = useNodes();
  const { setEdges } = useEdges();
  const { getSchema } = useSchemas();
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
          viewLevel: 'summary',
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
          viewLevel: 'summary',
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
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeIdToDelete && e.target !== nodeIdToDelete)
      );
      setSelectedNodeIds((ids) => ids.filter((id) => id !== nodeIdToDelete));
    },
    [setNodes, setEdges, setSelectedNodeIds]
  );

  const deleteSelectedNodes = useCallback(() => {
    if (selectedNodeIds.length === 0) return;
    setNodes((nds) => {
      const idsToDelete = new Set(selectedNodeIds);
      const findDescendants = (parentId: string, depth = 0) => {
        if (depth > 20) return;
        for (const n of nds) {
          if (n.parentId === parentId && !idsToDelete.has(n.id)) {
            idsToDelete.add(n.id);
            findDescendants(n.id, depth + 1);
          }
        }
      };
      for (const id of selectedNodeIds) {
        findDescendants(id);
      }
      return nds.filter((n) => !idsToDelete.has(n.id));
    });
    setEdges((eds) =>
      eds.filter((e) => !selectedNodeIds.includes(e.source) && !selectedNodeIds.includes(e.target))
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

  const setNodeViewLevel = useCallback(
    (nodeIdToSet: string, level: 'summary' | 'details') => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeIdToSet
            ? { ...n, data: { ...n.data, viewLevel: level } }
            : n
        )
      );
      requestAnimationFrame(() => updateNodeInternals(nodeIdToSet));
    },
    [setNodes, updateNodeInternals]
  );

  const toggleNodeDetailsPin = useCallback(
    (nodeIdToToggle: string) => {
      setNodes((nds) =>
        nds.map((n) =>
          n.id === nodeIdToToggle
            ? { ...n, data: { ...n.data, isDetailsPinned: !n.data.isDetailsPinned } }
            : n
        )
      );
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

  return {
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
  };
}

export default useGraphOperations;
