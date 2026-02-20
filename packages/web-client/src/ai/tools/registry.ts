import { toolDefinitions, executeTool as sharedExecuteTool } from '@carta/document';
import type { ToolResult } from '@carta/document';
import type * as Y from 'yjs';
import { zodToJsonSchema } from './zod-adapter.js';

export interface SidebarToolSchema {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema for OpenRouter
}

/**
 * Get all tool schemas for registration with AI providers
 */
export function getAllToolSchemas(): SidebarToolSchema[] {
  return toolDefinitions.map(tool => ({
    name: tool.name,
    description: tool.description,
    parameters: zodToJsonSchema(tool.inputSchema),
  }));
}

/**
 * Execute a tool by name with given parameters
 */
export function executeTool(
  name: string,
  params: unknown,
  ydoc: Y.Doc,
  pageId: string
): ToolResult {
  return sharedExecuteTool(name, params, ydoc, pageId);
}
