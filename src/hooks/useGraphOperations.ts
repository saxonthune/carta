import { useCallback } from 'react';
import { useReactFlow, addEdge, type Node } from '@xyflow/react';
import { useDocument } from './useDocument';
import { useUndoRedo } from './useUndoRedo';
import { generateSemanticId } from '../utils/cartaFile';
import { registry } from '../constructs/registry';
import type { ConstructSchema, ConstructValues, ConnectionValue, ConstructNodeData } from '../constructs/types';

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
}

export function useGraphOperations(options: UseGraphOperationsOptions): UseGraphOperationsResult {
  const { selectedNodeIds, setSelectedNodeIds, setRenamingNodeId, setAddMenu } = options;
  const { nodes, setNodes, setEdges, getNextNodeId } = useDocument();
  const { screenToFlowPosition } = useReactFlow();
  const { takeSnapshot } = useUndoRedo();

  const addConstruct = useCallback(
    (schema: ConstructSchema, x: number, y: number) => {
      takeSnapshot();
      const position = screenToFlowPosition({ x, y });
      const id = getNextNodeId();

      const values: ConstructValues = {};
      schema.fields.forEach((field) => {
        if (field.default !== undefined) {
          values[field.name] = field.default;
        }
      });

      const semanticId = generateSemanticId(schema.type);

      const newNode: Node = {
        id,
        type: 'construct',
        position,
        data: {
          constructType: schema.type,
          semanticId,
          values,
          isExpanded: true,
        },
      };
      setNodes((nds) => [...nds, newNode]);
    },
    [setNodes, screenToFlowPosition, takeSnapshot, getNextNodeId]
  );

  // Add a related construct near the source node and optionally connect them
  const addRelatedConstruct = useCallback(
    (sourceNodeId: string, constructType: string, fromPortId?: string, toPortId?: string) => {
      const sourceNode = nodes.find(n => n.id === sourceNodeId);
      if (!sourceNode) return;

      const schema = registry.getSchema(constructType);
      if (!schema) return;

      takeSnapshot();

      // Position the new node to the right of the source node
      const newPosition = {
        x: sourceNode.position.x + 320,
        y: sourceNode.position.y,
      };

      const id = getNextNodeId();
      const values: ConstructValues = {};
      schema.fields.forEach((field) => {
        if (field.default !== undefined) {
          values[field.name] = field.default;
        }
      });

      const semanticId = generateSemanticId(schema.type);

      const newNode: Node = {
        id,
        type: 'construct',
        position: newPosition,
        data: {
          constructType: schema.type,
          semanticId,
          values,
          isExpanded: true,
        },
      };

      // If both ports are specified, create connection using explicit pair
      if (fromPortId && toPortId) {
        // Create the connection on the source node
        const newConnection: ConnectionValue = {
          portId: fromPortId,
          targetSemanticId: semanticId,
          targetPortId: toPortId,
        };

        // Also create an edge for visual rendering
        setNodes((nds) => [
          ...nds.map(n => {
            if (n.id === sourceNodeId && n.type === 'construct') {
              const data = n.data as ConstructNodeData;
              return {
                ...n,
                data: {
                  ...data,
                  connections: [...(data.connections || []), newConnection],
                },
              };
            }
            return n;
          }),
          newNode,
        ]);
        setEdges((eds) => addEdge({
          id: `edge-${sourceNodeId}-${fromPortId}-${id}-${toPortId}`,
          source: sourceNodeId,
          target: id,
          sourceHandle: fromPortId,
          targetHandle: toPortId,
        }, eds));
        return;
      }

      // If no ports specified, just add the node
      setNodes((nds) => [...nds, newNode]);
    },
    [nodes, setNodes, setEdges, takeSnapshot, getNextNodeId]
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
      takeSnapshot();
      setNodes((nds) => nds.filter((n) => n.id !== nodeIdToDelete));
      setEdges((eds) =>
        eds.filter((e) => e.source !== nodeIdToDelete && e.target !== nodeIdToDelete)
      );
      setSelectedNodeIds((ids) => ids.filter((id) => id !== nodeIdToDelete));
    },
    [setNodes, setEdges, takeSnapshot, setSelectedNodeIds]
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
  }, [selectedNodeIds, setNodes, setEdges, takeSnapshot, setSelectedNodeIds]);

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
  };
}

export default useGraphOperations;
