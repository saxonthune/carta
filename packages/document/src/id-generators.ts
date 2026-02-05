/**
 * Shared ID and color generators for Carta documents.
 */

export function generateSchemaGroupId(): string {
  return 'grp_' + Math.random().toString(36).substring(2, 11);
}

export function generateLevelId(): string {
  return 'level-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
}

export function generateNodeId(): string {
  return 'node_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

