import { zodToJsonSchema as zodToJsonSchemaLib } from 'zod-to-json-schema';
import type { z } from 'zod';

/**
 * Convert a Zod schema to JSON Schema format for OpenRouter
 */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  return zodToJsonSchemaLib(schema, { $refStrategy: 'none' }) as Record<string, unknown>;
}
