import type { CartaTool, ToolContext, ToolResult } from './types';
import type { Node } from '@xyflow/react';
import type { ConstructNodeData } from '@carta/domain';

interface QueryNodesParams {
  constructType?: string;
  fieldName?: string;
  fieldValue?: string | number | boolean;
  semanticIdPattern?: string;
}

interface QueryNodesResult {
  nodes: Array<{
    id: string;
    semanticId: string;
    constructType: string;
    values: Record<string, unknown>;
  }>;
  count: number;
}

/**
 * Tool to query nodes by various criteria
 */
export const queryNodesTool: CartaTool<QueryNodesParams, QueryNodesResult> = {
  schema: {
    name: 'queryNodes',
    description: 'Search for constructs matching specific criteria. Filter by construct type, field values, or semantic ID patterns.',
    parameters: {
      type: 'object',
      properties: {
        constructType: {
          type: 'string',
          description: 'Filter by construct type (e.g., "controller", "service")',
        },
        fieldName: {
          type: 'string',
          description: 'Field name to filter on (used with fieldValue)',
        },
        fieldValue: {
          type: 'string',
          description: 'Field value to match (requires fieldName)',
        },
        semanticIdPattern: {
          type: 'string',
          description: 'Pattern to match against semantic IDs (case-insensitive substring)',
        },
      },
    },
  },

  execute: (params: QueryNodesParams, context: ToolContext): ToolResult<QueryNodesResult> => {
    const { constructType, fieldName, fieldValue, semanticIdPattern } = params;

    const nodes = context.adapter.getNodes() as Node<ConstructNodeData>[];

    // Filter to construct nodes only
    let matchingNodes = nodes.filter(n => n.type === 'construct' && n.data);

    // Apply filters
    if (constructType) {
      matchingNodes = matchingNodes.filter(n => n.data.constructType === constructType);
    }

    if (fieldName && fieldValue !== undefined) {
      matchingNodes = matchingNodes.filter(n => {
        const values = n.data.values || {};
        return values[fieldName] === fieldValue;
      });
    }

    if (semanticIdPattern) {
      const pattern = semanticIdPattern.toLowerCase();
      matchingNodes = matchingNodes.filter(n =>
        n.data.semanticId?.toLowerCase().includes(pattern)
      );
    }

    // Map to simplified result
    const results = matchingNodes.map(n => ({
      id: n.id,
      semanticId: n.data.semanticId,
      constructType: n.data.constructType,
      values: n.data.values || {},
    }));

    return {
      success: true,
      data: {
        nodes: results,
        count: results.length,
      },
    };
  },
};
