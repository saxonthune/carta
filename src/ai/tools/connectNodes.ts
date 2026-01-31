import type { CartaTool, ToolContext, ToolResult } from './types';
import type { Node, Edge } from '@xyflow/react';
import type { ConstructNodeData, ConnectionValue } from '@carta/domain';

interface ConnectNodesParams {
  sourceId?: string;
  sourceSemanticId?: string;
  targetId?: string;
  targetSemanticId?: string;
  sourcePortId: string;
  targetPortId: string;
}

interface ConnectNodesResult {
  edgeId: string;
  sourceSemanticId: string;
  targetSemanticId: string;
}

/**
 * Tool to create a connection between two nodes
 */
export const connectNodesTool: CartaTool<ConnectNodesParams, ConnectNodesResult> = {
  schema: {
    name: 'connectNodes',
    description: 'Create a connection (edge) between two constructs via their ports. Specify source and target nodes by ID or semanticId, and the port IDs to connect.',
    parameters: {
      type: 'object',
      properties: {
        sourceId: {
          type: 'string',
          description: 'Source node UUID',
        },
        sourceSemanticId: {
          type: 'string',
          description: 'Source node semantic identifier',
        },
        targetId: {
          type: 'string',
          description: 'Target node UUID',
        },
        targetSemanticId: {
          type: 'string',
          description: 'Target node semantic identifier',
        },
        sourcePortId: {
          type: 'string',
          description: 'Port ID on the source node (e.g., "flow-out", "child")',
        },
        targetPortId: {
          type: 'string',
          description: 'Port ID on the target node (e.g., "flow-in", "parent")',
        },
      },
      required: ['sourcePortId', 'targetPortId'],
    },
  },

  execute: (params: ConnectNodesParams, context: ToolContext): ToolResult<ConnectNodesResult> => {
    const { sourceId, sourceSemanticId, targetId, targetSemanticId, sourcePortId, targetPortId } = params;

    if (!sourceId && !sourceSemanticId) {
      return {
        success: false,
        error: 'Either sourceId or sourceSemanticId must be provided',
      };
    }

    if (!targetId && !targetSemanticId) {
      return {
        success: false,
        error: 'Either targetId or targetSemanticId must be provided',
      };
    }

    const nodes = context.adapter.getNodes() as Node<ConstructNodeData>[];

    // Find source node
    let sourceNode: Node<ConstructNodeData> | undefined;
    if (sourceId) {
      sourceNode = nodes.find(n => n.id === sourceId);
    } else {
      sourceNode = nodes.find(n => n.data?.semanticId === sourceSemanticId);
    }

    if (!sourceNode) {
      return {
        success: false,
        error: `Source node not found: ${sourceId || sourceSemanticId}`,
      };
    }

    // Find target node
    let targetNode: Node<ConstructNodeData> | undefined;
    if (targetId) {
      targetNode = nodes.find(n => n.id === targetId);
    } else {
      targetNode = nodes.find(n => n.data?.semanticId === targetSemanticId);
    }

    if (!targetNode) {
      return {
        success: false,
        error: `Target node not found: ${targetId || targetSemanticId}`,
      };
    }

    // Create connection value for source node
    const newConnection: ConnectionValue = {
      portId: sourcePortId,
      targetSemanticId: targetNode.data.semanticId,
      targetPortId,
    };

    // Check for duplicate connection
    const existingConnections = sourceNode.data.connections || [];
    const alreadyExists = existingConnections.some(
      c => c.portId === newConnection.portId &&
           c.targetSemanticId === newConnection.targetSemanticId &&
           c.targetPortId === newConnection.targetPortId
    );

    if (alreadyExists) {
      return {
        success: false,
        error: 'Connection already exists',
      };
    }

    // Create edge ID
    const edgeId = `edge-${sourceNode.id}-${sourcePortId}-${targetNode.id}-${targetPortId}`;

    // Apply changes in transaction
    context.adapter.transaction(() => {
      // Update source node with new connection
      const updatedNodes = nodes.map(n => {
        if (n.id === sourceNode!.id) {
          return {
            ...n,
            data: {
              ...n.data,
              connections: [...existingConnections, newConnection],
            },
          };
        }
        return n;
      });
      context.adapter.setNodes(updatedNodes);

      // Add edge for visual rendering
      const edges = context.adapter.getEdges() as Edge[];
      const newEdge: Edge = {
        id: edgeId,
        source: sourceNode!.id,
        target: targetNode!.id,
        sourceHandle: sourcePortId,
        targetHandle: targetPortId,
      };
      context.adapter.setEdges([...edges, newEdge]);
    }, context.origin);

    return {
      success: true,
      data: {
        edgeId,
        sourceSemanticId: sourceNode.data.semanticId,
        targetSemanticId: targetNode.data.semanticId,
      },
    };
  },
};
