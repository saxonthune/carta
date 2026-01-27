import type { AnyCartaTool, ToolSchema, ToolResult, ToolContext } from './types';

// Tool implementations will be imported and registered here
import { getDocumentTool } from './getDocument';
import { getNodeTool } from './getNode';
import { addConstructTool } from './addConstruct';
import { updateNodeTool } from './updateNode';
import { connectNodesTool } from './connectNodes';
import { deleteNodeTool } from './deleteNode';
import { queryNodesTool } from './queryNodes';

/**
 * Registry of all Carta tools
 * Keyed by tool name for O(1) lookup
 */
export const cartaTools: Record<string, AnyCartaTool> = {
  getDocument: getDocumentTool,
  getNode: getNodeTool,
  addConstruct: addConstructTool,
  updateNode: updateNodeTool,
  connectNodes: connectNodesTool,
  deleteNode: deleteNodeTool,
  queryNodes: queryNodesTool,
};

/**
 * Get all tool schemas for registration with AI providers
 */
export function getAllToolSchemas(): ToolSchema[] {
  return Object.values(cartaTools).map(tool => tool.schema);
}

/**
 * Execute a tool by name with given parameters
 */
export function executeTool(
  name: string,
  params: unknown,
  context: ToolContext
): ToolResult {
  const tool = cartaTools[name];
  if (!tool) {
    return {
      success: false,
      error: `Unknown tool: ${name}`,
    };
  }

  try {
    return tool.execute(params, context);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Tool execution failed',
    };
  }
}
