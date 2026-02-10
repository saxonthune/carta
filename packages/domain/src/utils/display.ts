import type { ConstructNodeData, ConstructSchema, FieldSchema, DisplayTier } from '../types/index.js';

/**
 * Get the display name for a construct instance
 * Uses the pill-tier field value if available, otherwise falls back to semanticId
 */
export function getDisplayName(
  data: ConstructNodeData,
  schema: ConstructSchema | undefined
): string {
  if (schema) {
    // Find the field with displayTier === 'pill'
    const pillField = schema.fields.find(f => f.displayTier === 'pill');
    if (pillField && data.values[pillField.name]) {
      return String(data.values[pillField.name]);
    }
  }
  // Fallback to semanticId
  return data.semanticId;
}

/**
 * Get fields for a specific display tier, sorted by displayOrder
 */
export function getFieldsForTier(
  schema: ConstructSchema,
  tier: DisplayTier
): FieldSchema[] {
  return schema.fields
    .filter(f => f.displayTier === tier)
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
}

/**
 * Get fields that should appear in summary mode: minimal tier fields only
 */
export function getFieldsForSummary(schema: ConstructSchema): FieldSchema[] {
  return schema.fields
    .filter(f => f.displayTier === 'minimal')
    .sort((a, b) => (a.displayOrder ?? 0) - (b.displayOrder ?? 0));
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
