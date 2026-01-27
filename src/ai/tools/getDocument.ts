import type { CartaTool, ToolContext, ToolResult } from './types';
import type { CartaDocument } from '../../constructs/types';

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface GetDocumentParams {}

/**
 * Tool to retrieve the full document state
 * Returns all nodes, edges, schemas, deployables, and port schemas
 */
export const getDocumentTool: CartaTool<GetDocumentParams, CartaDocument> = {
  schema: {
    name: 'getDocument',
    description: 'Get the complete Carta document including all constructs, connections, schemas, and deployables. Use this to understand the current state of the architecture diagram.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },

  execute: (_params: GetDocumentParams, context: ToolContext): ToolResult<CartaDocument> => {
    const document = context.adapter.toJSON();
    return {
      success: true,
      data: document,
    };
  },
};
