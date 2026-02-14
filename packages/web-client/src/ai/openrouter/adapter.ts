import type { ToolSchema } from '../tools/types';
import type { OpenRouterTool } from './types';

/**
 * Convert CartaTool schemas to OpenRouter function format
 */
export function toOpenRouterTools(schemas: ToolSchema[]): OpenRouterTool[] {
  return schemas.map(schema => ({
    type: 'function',
    function: {
      name: schema.name,
      description: schema.description,
      parameters: schema.parameters,
    },
  }));
}
