import type { ConstructSchema, SchemaGroup } from '../types/index.js';

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
}

function generateGroupId(): string {
  return 'grp_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Flatten an array of seeds into template groups and schemas.
 * Group IDs are still seed-local refs — call hydrateSeeds() before writing to a document.
 */
export function loadSeeds(seeds: SchemaSeed[]): { groups: SchemaGroup[]; schemas: ConstructSchema[] } {
  const groups: SchemaGroup[] = [];
  const schemas: ConstructSchema[] = [];

  for (const seed of seeds) {
    groups.push(seed.group);
    if (seed.subgroups) {
      for (const sub of seed.subgroups) {
        groups.push({ ...sub, parentId: seed.group.id });
      }
    }
    schemas.push(...seed.schemas);
  }

  return { groups, schemas };
}

/**
 * Materialize seed templates into document-ready data.
 *
 * Every group ref ID is replaced with a fresh UUID. All schema groupId
 * and group parentId references are resolved to the new UUIDs.
 * Each call produces a unique, self-consistent set — safe to hydrate
 * multiple times without ID collisions.
 */
export function hydrateSeeds(
  groups: SchemaGroup[],
  schemas: ConstructSchema[],
): { groups: SchemaGroup[]; schemas: ConstructSchema[] } {
  // Build ref → UUID map
  const refMap = new Map<string, string>();
  for (const group of groups) {
    refMap.set(group.id, generateGroupId());
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

  return { groups: hydratedGroups, schemas: hydratedSchemas };
}
