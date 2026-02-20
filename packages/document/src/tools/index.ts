/**
 * Unified tool surface for Carta document operations.
 *
 * Provides a single definition of all document mutation tools that can be
 * consumed by both the MCP server and the web client sidebar.
 *
 * Each tool:
 * - Has a Zod input schema (without documentId - that's the consumer's concern)
 * - Accepts (params, ydoc, pageId) and returns ToolResult
 * - Is a thin wrapper over doc-operations
 */

import { documentTools } from './document-tools.js';
import { pageTools } from './page-tools.js';
import type { ToolDefinition, ToolResult } from './types.js';
import type * as Y from 'yjs';

export type { ToolDefinition, ToolResult };

/**
 * All tool definitions (document-level + page-scoped).
 */
export const toolDefinitions: ToolDefinition[] = [...documentTools, ...pageTools];

/**
 * Execute a tool by name.
 *
 * @param name - Tool name (e.g., "create_construct")
 * @param params - Tool input parameters (validated against tool's Zod schema)
 * @param ydoc - Yjs document
 * @param pageId - Page ID (required for page-scoped tools, ignored for document-level tools)
 * @returns Tool execution result
 */
export function executeTool(
  name: string,
  params: unknown,
  ydoc: Y.Doc,
  pageId: string
): ToolResult {
  const tool = toolDefinitions.find(t => t.name === name);
  if (!tool) {
    return { success: false, error: `Unknown tool: ${name}` };
  }
  try {
    return tool.execute(params, ydoc, pageId);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
