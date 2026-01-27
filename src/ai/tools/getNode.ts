import type { CartaTool, ToolContext, ToolResult } from './types';
import type { Node } from '@xyflow/react';
import type { ConstructNodeData } from '../../constructs/types';

interface GetNodeParams {
  id?: string;
  semanticId?: string;
}

interface GetNodeResult {
  node: Node<ConstructNodeData>;
  schema: unknown;
}

/**
 * Tool to retrieve a specific node by ID or semanticId
 */
export const getNodeTool: CartaTool<GetNodeParams, GetNodeResult> = {
  schema: {
    name: 'getNode',
    description: 'Get a specific construct node by its ID or semanticId. Returns the node data and its schema definition.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The node UUID (internal identifier)',
        },
        semanticId: {
          type: 'string',
          description: 'The semantic identifier (e.g., "controller-user-api")',
        },
      },
    },
  },

  execute: (params: GetNodeParams, context: ToolContext): ToolResult<GetNodeResult> => {
    const { id, semanticId } = params;

    if (!id && !semanticId) {
      return {
        success: false,
        error: 'Either id or semanticId must be provided',
      };
    }

    const nodes = context.adapter.getNodes() as Node<ConstructNodeData>[];

    let node: Node<ConstructNodeData> | undefined;

    if (id) {
      node = nodes.find(n => n.id === id);
    } else if (semanticId) {
      node = nodes.find(n => n.data?.semanticId === semanticId);
    }

    if (!node) {
      return {
        success: false,
        error: `Node not found: ${id || semanticId}`,
      };
    }

    const schema = context.adapter.getSchema(node.data.constructType);

    return {
      success: true,
      data: {
        node,
        schema,
      },
    };
  },
};
