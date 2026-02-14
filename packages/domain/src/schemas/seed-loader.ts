import type { ConstructSchema, PortSchema, SchemaGroup } from '../types/index.js';

/**
 * A self-contained seed: one root group, optional subgroups, and all schemas for those groups.
 *
 * Group and subgroup `id` fields are seed-local refs (e.g., 'api', 'database').
 * Schema `groupId` fields reference these refs.
 * When hydrated, refs are replaced with real UUIDs — the "integument" is stripped.
 */
export interface SchemaSeed {
  group: SchemaGroup;
  subgroups?: SchemaGroup[];
  schemas: ConstructSchema[];
  portSchemas: PortSchema[];
}

function generateGroupId(): string {
  return 'grp_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Flatten an array of seeds into template groups and schemas.
 * Group IDs are still seed-local refs — call hydrateSeeds() before writing to a document.
 */
export function loadSeeds(seeds: SchemaSeed[]): { groups: SchemaGroup[]; schemas: ConstructSchema[]; portSchemas: PortSchema[] } {
  const groups: SchemaGroup[] = [];
  const schemas: ConstructSchema[] = [];
  const portSchemaMap = new Map<string, PortSchema>();

  for (const seed of seeds) {
    groups.push(seed.group);
    if (seed.subgroups) {
      for (const sub of seed.subgroups) {
        groups.push({ ...sub, parentId: seed.group.id });
      }
    }
    schemas.push(...seed.schemas);
    for (const ps of seed.portSchemas) {
      if (!portSchemaMap.has(ps.id)) {
        portSchemaMap.set(ps.id, ps);
      }
    }
  }

  return { groups, schemas, portSchemas: Array.from(portSchemaMap.values()) };
}

/**
 * Materialize seed templates into document-ready data.
 *
 * Every group ref ID is replaced with a fresh UUID. All schema groupId
 * and group parentId references are resolved to the new UUIDs.
 *
 * Port schemas don't have group refs, so they pass through as-is.
 *
 * When `existingGroups` is provided, groups are matched by name and
 * existing IDs are reused — making the output idempotent for groups
 * that already exist in the document.
 */
export function hydrateSeeds(
  groups: SchemaGroup[],
  schemas: ConstructSchema[],
  portSchemas: PortSchema[],
  existingGroups?: SchemaGroup[],
): { groups: SchemaGroup[]; schemas: ConstructSchema[]; portSchemas: PortSchema[] } {
  // Build name → existing ID lookup
  const existingByName = new Map<string, string>();
  if (existingGroups) {
    for (const g of existingGroups) {
      existingByName.set(g.name, g.id);
    }
  }

  // Build ref → UUID map (reuse existing IDs when matched by name)
  const refMap = new Map<string, string>();
  for (const group of groups) {
    const existingId = existingByName.get(group.name);
    refMap.set(group.id, existingId ?? generateGroupId());
  }

  // Resolve group refs
  const hydratedGroups = groups.map(g => ({
    ...g,
    id: refMap.get(g.id)!,
    parentId: g.parentId ? (refMap.get(g.parentId) ?? g.parentId) : undefined,
  }));

  // Resolve schema groupId refs
  const hydratedSchemas = schemas.map(s => ({
    ...s,
    groupId: s.groupId ? (refMap.get(s.groupId) ?? s.groupId) : undefined,
  }));

  return { groups: hydratedGroups, schemas: hydratedSchemas, portSchemas };
}
