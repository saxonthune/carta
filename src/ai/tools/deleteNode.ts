import type { CartaTool, ToolContext, ToolResult } from './types';
import type { Node, Edge } from '@xyflow/react';
import type { ConstructNodeData } from '../../constructs/types';

interface DeleteNodeParams {
  id?: string;
  semanticId?: string;
}

interface DeleteNodeResult {
  deletedNodeId: string;
  deletedSemanticId: string;
  deletedEdgeCount: number;
}

/**
 * Tool to delete a node and its connections
 */
export const deleteNodeTool: CartaTool<DeleteNodeParams, DeleteNodeResult> = {
  schema: {
    name: 'deleteNode',
    description: 'Delete a construct from the canvas. Also removes all edges connected to it and cleans up connection references in other nodes.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The node UUID to delete',
        },
        semanticId: {
          type: 'string',
          description: 'The semantic identifier of the node to delete',
        },
      },
    },
  },

  execute: (params: DeleteNodeParams, context: ToolContext): ToolResult<DeleteNodeResult> => {
    const { id, semanticId } = params;

    if (!id && !semanticId) {
      return {
        success: false,
        error: 'Either id or semanticId must be provided',
      };
    }

    const nodes = context.adapter.getNodes() as Node<ConstructNodeData>[];
    const edges = context.adapter.getEdges() as Edge[];

    // Find node to delete
    let nodeToDelete: Node<ConstructNodeData> | undefined;
    if (id) {
      nodeToDelete = nodes.find(n => n.id === id);
    } else {
      nodeToDelete = nodes.find(n => n.data?.semanticId === semanticId);
    }

    if (!nodeToDelete) {
      return {
        success: false,
        error: `Node not found: ${id || semanticId}`,
      };
    }

    const deletedNodeId = nodeToDelete.id;
    const deletedSemanticId = nodeToDelete.data.semanticId;

    // Find edges to delete
    const edgesToDelete = edges.filter(
      e => e.source === deletedNodeId || e.target === deletedNodeId
    );

    context.adapter.transaction(() => {
      // Remove the node
      const remainingNodes = nodes.filter(n => n.id !== deletedNodeId);

      // Clean up connections that reference the deleted node
      const cleanedNodes = remainingNodes.map(n => {
        if (n.type !== 'construct') return n;
        const data = n.data as ConstructNodeData;
        if (!data.connections?.length) return n;

        const filteredConnections = data.connections.filter(
          c => c.targetSemanticId !== deletedSemanticId
        );

        if (filteredConnections.length === data.connections.length) return n;

        return {
          ...n,
          data: {
            ...data,
            connections: filteredConnections,
          },
        };
      });

      context.adapter.setNodes(cleanedNodes);

      // Remove edges
      const remainingEdges = edges.filter(
        e => e.source !== deletedNodeId && e.target !== deletedNodeId
      );
      context.adapter.setEdges(remainingEdges);
    }, context.origin);

    return {
      success: true,
      data: {
        deletedNodeId,
        deletedSemanticId,
        deletedEdgeCount: edgesToDelete.length,
      },
    };
  },
};
