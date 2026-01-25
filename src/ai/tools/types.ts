import type { DocumentAdapter } from '../../constructs/types';

/**
 * JSON Schema property definition for tool parameters
 */
export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description?: string;
  enum?: string[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
  default?: unknown;
}

/**
 * Tool parameter schema following JSON Schema format
 * Compatible with OpenRouter/OpenAI function calling and MCP
 */
export interface ToolSchema {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, JSONSchemaProperty>;
    required?: string[];
  };
}

/**
 * Result returned from tool execution
 */
export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Context passed to tool execution
 * Provides access to document adapter and origin attribution
 */
export interface ToolContext {
  adapter: DocumentAdapter;
  origin: 'ai-sidebar' | 'ai-mcp';
}

/**
 * A Carta tool definition
 * Protocol-agnostic: can be used by sidebar, MCP, or other integrations
 */
export interface CartaTool<TParams = unknown, TResult = unknown> {
  schema: ToolSchema;
  execute: (params: TParams, context: ToolContext) => ToolResult<TResult>;
}

/**
 * Base type for tool registry (uses any for params to allow heterogeneous tools)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyCartaTool = CartaTool<any, any>;
