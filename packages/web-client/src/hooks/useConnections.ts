import { useCallback } from 'react';
import { useReactFlow, addEdge, type Edge, type Connection, type OnConnect } from '@xyflow/react';
import { useNodes } from './useNodes';
import { useEdges } from './useEdges';
import { useSchemas } from './useSchemas';
import { canConnect, getPortsForSchema, getHandleType } from '@carta/domain';
import type { ConnectionValue, ConstructNodeData } from '@carta/domain';
import { stripHandlePrefix } from '../utils/handlePrefix';


export interface UseConnectionsResult {
  getNodeSemanticId: (nodeId: string) => string | null;
  isValidConnection: (connection: Edge | Connection) => boolean;
  onConnect: OnConnect;
  handleEdgesDelete: (deletedEdges: Edge[]) => void;
}

export function useConnections(): UseConnectionsResult {
  const { nodes, setNodes } = useNodes();
  const { setEdges } = useEdges();
  const { getSchema } = useSchemas();
  const { getNodes } = useReactFlow();

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

    // Strip drawer:/dropzone: prefixes to get clean port IDs
    const cleanSourceHandle = stripHandlePrefix(sourceHandle);
    const cleanTargetHandle = stripHandlePrefix(targetHandle);

    const currentNodes = getNodes();
    const sourceNode = currentNodes.find((n) => n.id === source);
    const targetNode = currentNodes.find((n) => n.id === target);
    if (!sourceNode || !targetNode) return false;

    // Only validate port semantics for construct nodes; other node types fall back to default behavior
    if (sourceNode.type !== 'construct' || targetNode.type !== 'construct') return true;

    const sourceData = sourceNode.data as ConstructNodeData;
    const targetData = targetNode.data as ConstructNodeData;
    const sourceSchema = getSchema(sourceData.constructType);
    const targetSchema = getSchema(targetData.constructType);
    if (!sourceSchema || !targetSchema) return false;

    const sourcePorts = getPortsForSchema(sourceSchema.ports);
    const targetPorts = getPortsForSchema(targetSchema.ports);
    const sourcePort = sourcePorts.find((p) => p.id === cleanSourceHandle);
    const targetPort = targetPorts.find((p) => p.id === cleanTargetHandle);
    if (!sourcePort || !targetPort) return false;

    // Validate port type compatibility via registry
    return canConnect(sourcePort.portType, targetPort.portType);
  }, [getNodes, getSchema]);

  const onConnect: OnConnect = useCallback(
    (params) => {
      if (!params.source || !params.sourceHandle || !params.target || !params.targetHandle) {
        return;
      }

      // Strip drawer:/dropzone: prefixes so edges store clean port IDs
      const cleanParams = {
        ...params,
        sourceHandle: stripHandlePrefix(params.sourceHandle),
        targetHandle: stripHandlePrefix(params.targetHandle),
      };

      const currentNodes = getNodes();
      const sourceNode = currentNodes.find(n => n.id === cleanParams.source);
      const targetNode = currentNodes.find(n => n.id === cleanParams.target);

      if (!sourceNode || !targetNode) return;

      // For non-construct nodes, use original behavior without normalization
      if (sourceNode.type !== 'construct' || targetNode.type !== 'construct') {
        setEdges((eds) => addEdge(cleanParams, eds));
        return;
      }

      const sourceData = sourceNode.data as ConstructNodeData;
      const targetData = targetNode.data as ConstructNodeData;
      const sourceSchema = getSchema(sourceData.constructType);
      const targetSchema = getSchema(targetData.constructType);

      if (!sourceSchema || !targetSchema) return;

      const sourcePorts = getPortsForSchema(sourceSchema.ports);
      const targetPorts = getPortsForSchema(targetSchema.ports);
      const sourcePort = sourcePorts.find(p => p.id === cleanParams.sourceHandle);
      const targetPort = targetPorts.find(p => p.id === cleanParams.targetHandle);

      if (!sourcePort || !targetPort) return;

      // Determine if we need to flip the direction for React Flow rendering
      // React Flow requires edges to go from 'source' type handles to 'target' type handles
      // If user dragged from a sink port (target handle) to a source port (source handle),
      // we need to flip the edge direction
      const sourceHandleType = getHandleType(sourcePort.portType);
      const targetHandleType = getHandleType(targetPort.portType);
      const needsFlip = sourceHandleType === 'target' && targetHandleType === 'source';

      // Normalize edge direction: ensure source has 'source' handle type
      const normalizedParams = needsFlip ? {
        source: cleanParams.target,
        sourceHandle: cleanParams.targetHandle,
        target: cleanParams.source,
        targetHandle: cleanParams.sourceHandle,
      } : cleanParams;

      // Store connection on the node that has the source-polarity port (after normalization)
      const connectionSourceNodeId = normalizedParams.source!;
      const connectionTargetNodeId = normalizedParams.target!;
      const targetSemanticId = getNodeSemanticId(connectionTargetNodeId);

      if (targetSemanticId) {
        const newConnection: ConnectionValue = {
          portId: normalizedParams.sourceHandle!,
          targetSemanticId,
          targetPortId: normalizedParams.targetHandle!,
        };

        setNodes((nds) =>
          nds.map((node) => {
            if (node.id === connectionSourceNodeId && node.type === 'construct') {
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

      // Add edge with normalized direction for correct React Flow rendering
      setEdges((eds) => addEdge(normalizedParams, eds));
    },
    [setEdges, setNodes, getNodeSemanticId, getNodes, getSchema]
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
