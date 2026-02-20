import type { SidebarToolSchema } from '../tools/registry.js';
import type { OpenRouterTool } from './types.js';

/**
 * Convert SidebarToolSchema to OpenRouter function format
 */
export function toOpenRouterTools(schemas: SidebarToolSchema[]): OpenRouterTool[] {
  return schemas.map(schema => {
    const params = schema.parameters as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };

    return {
      type: 'function',
      function: {
        name: schema.name,
        description: schema.description,
        parameters: {
          type: 'object',
          properties: params.properties || {},
          required: params.required,
        },
      },
    };
  });
}
