/**
 * Shared ID and color generators for Carta documents.
 */

const DEPLOYABLE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#ec4899', // pink
  '#6b7280', // gray
];

export function generateDeployableId(): string {
  return 'dep_' + Math.random().toString(36).substring(2, 11);
}

export function generateDeployableColor(): string {
  return DEPLOYABLE_COLORS[Math.floor(Math.random() * DEPLOYABLE_COLORS.length)] || '#3b82f6';
}

export function generateSchemaGroupId(): string {
  return 'grp_' + Math.random().toString(36).substring(2, 11);
}

export function generateLevelId(): string {
  return 'level-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
}

export function generateNodeId(): string {
  return 'node_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}
