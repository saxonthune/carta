import type { ConstructSchema, PortSchema, SchemaGroup, SchemaPackage } from '../types/index.js';

/**
 * A self-contained seed: one package, optional groups, and all schemas for that package.
 *
 * Package and group `id` fields are seed-local refs (e.g., 'software-design', 'api').
 * Schema `groupId` and `packageId` fields reference these refs.
 * When hydrated, refs are replaced with real UUIDs — the "integument" is stripped.
 */
export interface SchemaSeed {
  package: SchemaPackage;
  groups?: SchemaGroup[];
  schemas: ConstructSchema[];
  portSchemas: PortSchema[];
}

function generateGroupId(): string {
  return 'grp_' + Math.random().toString(36).substring(2, 11);
}

function generatePackageId(): string {
  return 'pkg_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Flatten an array of seeds into template packages, groups, and schemas.
 * Package and group IDs are still seed-local refs — call hydrateSeeds() before writing to a document.
 */
export function loadSeeds(seeds: SchemaSeed[]): { packages: SchemaPackage[]; groups: SchemaGroup[]; schemas: ConstructSchema[]; portSchemas: PortSchema[] } {
  const packages: SchemaPackage[] = [];
  const groups: SchemaGroup[] = [];
  const schemas: ConstructSchema[] = [];
  const portSchemaMap = new Map<string, PortSchema>();

  for (const seed of seeds) {
    packages.push(seed.package);
    if (seed.groups) {
      for (const grp of seed.groups) {
        groups.push({ ...grp, packageId: seed.package.id });
      }
    }
    // Assign packageId to all schemas in this seed
    for (const schema of seed.schemas) {
      schemas.push({ ...schema, packageId: seed.package.id });
    }
    // Port schemas with groupId get packageId assigned
    for (const ps of seed.portSchemas) {
      if (!portSchemaMap.has(ps.id)) {
        const updatedPs = ps.groupId ? { ...ps, packageId: seed.package.id } : ps;
        portSchemaMap.set(ps.id, updatedPs);
      }
    }
  }

  return { packages, groups, schemas, portSchemas: Array.from(portSchemaMap.values()) };
}

/**
 * Materialize seed templates into document-ready data.
 *
 * Every package and group ref ID is replaced with a fresh UUID. All schema packageId/groupId
 * and group packageId/parentId references are resolved to the new UUIDs.
 *
 * Port schemas without groupId pass through as-is (built-in cross-package ports).
 *
 * When `existingPackages` and `existingGroups` are provided, they are matched by name and
 * existing IDs are reused — making the output idempotent for entities that already exist.
 */
export function hydrateSeeds(
  packages: SchemaPackage[],
  groups: SchemaGroup[],
  schemas: ConstructSchema[],
  portSchemas: PortSchema[],
  existingPackages?: SchemaPackage[],
  existingGroups?: SchemaGroup[],
): { packages: SchemaPackage[]; groups: SchemaGroup[]; schemas: ConstructSchema[]; portSchemas: PortSchema[] } {
  // Build name → existing ID lookup for packages
  const existingPackagesByName = new Map<string, string>();
  if (existingPackages) {
    for (const p of existingPackages) {
      existingPackagesByName.set(p.name, p.id);
    }
  }

  // Build name → existing ID lookup for groups
  const existingGroupsByName = new Map<string, string>();
  if (existingGroups) {
    for (const g of existingGroups) {
      existingGroupsByName.set(g.name, g.id);
    }
  }

  // Build ref → UUID map for packages
  const packageRefMap = new Map<string, string>();
  for (const pkg of packages) {
    const existingId = existingPackagesByName.get(pkg.name);
    packageRefMap.set(pkg.id, existingId ?? generatePackageId());
  }

  // Build ref → UUID map for groups
  const groupRefMap = new Map<string, string>();
  for (const group of groups) {
    const existingId = existingGroupsByName.get(group.name);
    groupRefMap.set(group.id, existingId ?? generateGroupId());
  }

  // Resolve package refs
  const hydratedPackages = packages.map(p => ({
    ...p,
    id: packageRefMap.get(p.id)!,
  }));

  // Resolve group refs
  const hydratedGroups = groups.map(g => ({
    ...g,
    id: groupRefMap.get(g.id)!,
    parentId: g.parentId ? (groupRefMap.get(g.parentId) ?? g.parentId) : undefined,
    packageId: g.packageId ? (packageRefMap.get(g.packageId) ?? g.packageId) : undefined,
  }));

  // Resolve schema packageId and groupId refs
  const hydratedSchemas = schemas.map(s => ({
    ...s,
    packageId: s.packageId ? (packageRefMap.get(s.packageId) ?? s.packageId) : undefined,
    groupId: s.groupId ? (groupRefMap.get(s.groupId) ?? s.groupId) : undefined,
  }));

  // Resolve port schema packageId and groupId refs
  const hydratedPortSchemas = portSchemas.map(ps => ({
    ...ps,
    packageId: ps.packageId ? (packageRefMap.get(ps.packageId) ?? ps.packageId) : undefined,
    groupId: ps.groupId ? (groupRefMap.get(ps.groupId) ?? ps.groupId) : undefined,
  }));

  return { packages: hydratedPackages, groups: hydratedGroups, schemas: hydratedSchemas, portSchemas: hydratedPortSchemas };
}
