/**
 * Shared types for the tool surface layer.
 *
 * Tools are thin wrappers over doc-operations that validate inputs
 * with Zod and provide a consistent interface for both MCP and sidebar.
 */

import type { z } from 'zod';
import type * as Y from 'yjs';

/**
 * Tool definition: Zod schema + executor function.
 */
export interface ToolDefinition {
  /** Tool name (e.g., "create_construct") */
  name: string;
  /** Human/AI-readable description */
  description: string;
  /** Zod schema for input validation */
  inputSchema: z.ZodType;
  /** Whether this tool requires a pageId parameter */
  needsPage: boolean;
  /** Execute the tool operation */
  execute: (params: unknown, ydoc: Y.Doc, pageId: string) => ToolResult;
}

/**
 * Tool execution result.
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
