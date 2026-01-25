import { useCallback } from 'react';
import { useReactFlow, addEdge, type Edge, type Connection, type OnConnect } from '@xyflow/react';
import { useDocument } from './useDocument';
import { useUndoRedo } from './useUndoRedo';
import { registry } from '../constructs/registry';
import { canConnect, getPortsForSchema } from '../constructs/ports';
import type { ConnectionValue, ConstructNodeData } from '../constructs/types';

export interface UseConnectionsResult {
  getNodeSemanticId: (nodeId: string) => string | null;
  isValidConnection: (connection: Edge | Connection) => boolean;
  onConnect: OnConnect;
  handleEdgesDelete: (deletedEdges: Edge[]) => void;
}

export function useConnections(): UseConnectionsResult {
  const { nodes, setNodes, setEdges } = useDocument();
  const { getNodes } = useReactFlow();
  const { takeSnapshot } = useUndoRedo();

  // Helper to get semanticId from a node
  const getNodeSemanticId = useCallback((nodeId: string): string | null => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || node.type !== 'construct') return null;
    const data = node.data as ConstructNodeData;
    return data.semanticId;
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

    // Validate port type compatibility via registry
    return canConnect(sourcePort.portType, targetPort.portType);
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

  return {
    getNodeSemanticId,
    isValidConnection,
    onConnect,
    handleEdgesDelete,
  };
}
