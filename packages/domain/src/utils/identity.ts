/**
 * Identity and string utilities
 * Pure functions for generating IDs and normalizing strings
 */

/**
 * Generate a semantic ID for AI consumption
 * Creates a unique identifier based on construct type and timestamp
 */
export function generateSemanticId(constructType: string): string {
  const normalizedType = constructType
    .toLowerCase()
    .replace(/_/g, '-');

  const timestamp = Date.now().toString(36).slice(-4);
  const random = Math.random().toString(36).slice(-3);

  return `${normalizedType}-${timestamp}${random}`;
}

/**
 * Generate a unique document ID
 */
export function generateDocumentId(): string {
  return `doc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Convert a string to kebab-case
 * "My Project Name" -> "my-project-name"
 */
export function toKebabCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}

/**
 * Convert a string to snake_case
 * "My Field Name" -> "my_field_name"
 */
export function toSnakeCase(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
}
