import type { ConstructNodeData, ConstructSchema } from '../types/index.js';

/**
 * Get the display name for a construct instance
 * Uses the displayField value if available, otherwise falls back to semanticId
 */
export function getDisplayName(
  data: ConstructNodeData,
  schema: ConstructSchema | undefined
): string {
  // If schema has displayField and the field has a value, use it
  if (schema?.displayField && data.values[schema.displayField]) {
    const value = data.values[schema.displayField];
    return String(value);
  }
  // Fallback to semanticId
  return data.semanticId;
}

/**
 * Generate a human-readable label from a semantic ID
 * 'controller-user-api' -> 'User API'
 */
export function semanticIdToLabel(semanticId: string): string {
  // Remove the type prefix (everything before first hyphen after the type)
  const parts = semanticId.split('-');
  if (parts.length <= 1) return semanticId;

  // Skip the first part (type) and join the rest
  const nameParts = parts.slice(1);

  // Capitalize each word
  return nameParts
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
