import type { ConstructSchema, SchemaGroup } from '../types/index.js';

/**
 * A self-contained seed: one root group, optional subgroups, and all schemas for those groups.
 */
export interface SchemaSeed {
  group: SchemaGroup;
  subgroups?: SchemaGroup[];
  schemas: ConstructSchema[];
}

/**
 * Flatten an array of seeds into the groups and schemas arrays that built-ins exports.
 * Auto-sets `parentId` on subgroups from the seed's root group.
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
