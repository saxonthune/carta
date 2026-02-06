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
export function generateDeployableId() {
    return 'dep_' + Math.random().toString(36).substring(2, 11);
}
export function generateDeployableColor() {
    return DEPLOYABLE_COLORS[Math.floor(Math.random() * DEPLOYABLE_COLORS.length)] || '#3b82f6';
}
export function generateSchemaGroupId() {
    return 'grp_' + Math.random().toString(36).substring(2, 11);
}
export function generateLevelId() {
    return 'level-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
}
export function generateNodeId() {
    return 'node_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}
