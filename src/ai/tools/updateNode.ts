import type { CartaTool, ToolContext, ToolResult } from './types';
import type { Node } from '@xyflow/react';
import type { ConstructNodeData, ConstructValues } from '@carta/domain';

interface UpdateNodeParams {
  id?: string;
  semanticId?: string;
  values?: ConstructValues;
  newSemanticId?: string;
  deployableId?: string | null;
}

interface UpdateNodeResult {
  nodeId: string;
  semanticId: string;
}

/**
 * Tool to update an existing node's values
 */
export const updateNodeTool: CartaTool<UpdateNodeParams, UpdateNodeResult> = {
  schema: {
    name: 'updateNode',
    description: 'Update field values on an existing construct. Can also rename the semanticId or change deployable assignment.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'The node UUID (internal identifier)',
        },
        semanticId: {
          type: 'string',
          description: 'The semantic identifier to find the node',
        },
        values: {
          type: 'object',
          description: 'Field values to update (merged with existing)',
        },
        newSemanticId: {
          type: 'string',
          description: 'New semantic identifier to rename the construct',
        },
        deployableId: {
          type: 'string',
          description: 'Deployable ID to assign (null to unassign)',
        },
      },
    },
  },

  execute: (params: UpdateNodeParams, context: ToolContext): ToolResult<UpdateNodeResult> => {
    const { id, semanticId, values, newSemanticId, deployableId } = params;

    if (!id && !semanticId) {
      return {
        success: false,
        error: 'Either id or semanticId must be provided',
      };
    }

    const nodes = context.adapter.getNodes() as Node<ConstructNodeData>[];

    let nodeIndex: number;
    if (id) {
      nodeIndex = nodes.findIndex(n => n.id === id);
    } else {
      nodeIndex = nodes.findIndex(n => n.data?.semanticId === semanticId);
    }

    if (nodeIndex === -1) {
      return {
        success: false,
        error: `Node not found: ${id || semanticId}`,
      };
    }

    const node = nodes[nodeIndex];
    const nodeId = node.id;

    // Build updates
    const updates: Partial<ConstructNodeData> = {};

    if (values) {
      updates.values = { ...node.data.values, ...values };
    }

    if (newSemanticId) {
      updates.semanticId = newSemanticId;
    }

    if (deployableId !== undefined) {
      updates.deployableId = deployableId;
    }

    // Apply updates using adapter's updateNode (handles semantic ID cascading)
    context.adapter.transaction(() => {
      context.adapter.updateNode(nodeId, updates);
    }, context.origin);

    return {
      success: true,
      data: {
        nodeId,
        semanticId: newSemanticId || node.data.semanticId,
      },
    };
  },
};
