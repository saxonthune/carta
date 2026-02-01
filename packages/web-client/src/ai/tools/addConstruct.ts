import type { CartaTool, ToolContext, ToolResult } from './types';
import type { Node } from '@xyflow/react';
import type { ConstructNodeData, ConstructValues } from '@carta/domain';
import { generateSemanticId } from '../../utils/cartaFile';

interface AddConstructParams {
  constructType: string;
  values?: ConstructValues;
  position?: { x: number; y: number };
}

interface AddConstructResult {
  nodeId: string;
  semanticId: string;
}

/**
 * Tool to create a new construct on the canvas
 */
export const addConstructTool: CartaTool<AddConstructParams, AddConstructResult> = {
  schema: {
    name: 'addConstruct',
    description: 'Create a new construct (node) on the canvas. Specify the construct type and optionally set field values and position.',
    parameters: {
      type: 'object',
      properties: {
        constructType: {
          type: 'string',
          description: 'The type of construct to create (e.g., "controller", "service", "db_table")',
        },
        values: {
          type: 'object',
          description: 'Field values to set on the construct (e.g., { "name": "UserService" })',
        },
        position: {
          type: 'object',
          description: 'Canvas position { x, y }. Defaults to center of canvas if not specified.',
          properties: {
            x: { type: 'number' },
            y: { type: 'number' },
          },
        },
      },
      required: ['constructType'],
    },
  },

  execute: (params: AddConstructParams, context: ToolContext): ToolResult<AddConstructResult> => {
    const { constructType, values = {}, position } = params;

    // Validate construct type exists
    const schema = context.adapter.getSchema(constructType);
    if (!schema) {
      const availableTypes = context.adapter.getSchemas().map(s => s.type);
      return {
        success: false,
        error: `Unknown construct type: ${constructType}. Available types: ${availableTypes.join(', ')}`,
      };
    }

    // Generate IDs
    const nodeId = context.adapter.generateNodeId();
    const semanticId = generateSemanticId(constructType);

    // Build initial values with defaults
    const initialValues: ConstructValues = {};
    if (Array.isArray(schema.fields)) {
      schema.fields.forEach(field => {
        if (field.default !== undefined) {
          initialValues[field.name] = field.default;
        }
      });
    }
    // Apply provided values
    Object.assign(initialValues, values);

    // Default position if not specified
    const nodePosition = position || { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 };

    const newNode: Node<ConstructNodeData> = {
      id: nodeId,
      type: 'construct',
      position: nodePosition,
      data: {
        constructType,
        semanticId,
        values: initialValues,
        viewLevel: 'details',
      },
    };

    // Add node using transaction for proper attribution
    context.adapter.transaction(() => {
      const currentNodes = context.adapter.getNodes() as Node[];
      context.adapter.setNodes([...currentNodes, newNode]);
    }, context.origin);

    return {
      success: true,
      data: {
        nodeId,
        semanticId,
      },
    };
  },
};
