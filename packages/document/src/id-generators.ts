/**
 * Shared ID and color generators for Carta documents.
 */

export function generateSchemaGroupId(): string {
  return 'grp_' + Math.random().toString(36).substring(2, 11);
}

export function generateSchemaPackageId(): string {
  return 'pkg_' + Math.random().toString(36).substring(2, 11);
}

export function generatePageId(): string {
  return 'page-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
}

export function generateNodeId(): string {
  return 'node_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}

export function generateResourceId(): string {
  return 'res_' + Math.random().toString(36).substring(2, 11);
}

export function generateVersionId(): string {
  return 'ver_' + Math.random().toString(36).substring(2, 11);
}

export function generateSpecGroupId(): string {
  return 'sg_' + Math.random().toString(36).substring(2, 11);
}

