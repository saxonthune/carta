import { sha256 } from 'js-sha256';
import type {
  DocumentAdapter,
  SchemaPackageDefinition,
  PackageManifestEntry,
  SchemaGroup,
  ConstructSchema,
  PortSchema,
  SchemaRelationship,
} from '../types/index.js';

export interface ApplyPackageResult {
  status: 'applied' | 'skipped';
  packageId: string;
  schemasLoaded?: number;
}

/**
 * Compute a deterministic content hash of a SchemaPackageDefinition.
 * Uses JSON.stringify with sorted keys for determinism.
 * Strips runtime-generated IDs (relationship.id, group IDs) for stable comparison.
 */
function computeContentHash(definition: SchemaPackageDefinition): string {
  // Sort the definition for deterministic serialization
  // Strip runtime IDs that get regenerated on each load
  const sortedDef = {
    id: definition.id,
    name: definition.name,
    description: definition.description,
    color: definition.color,
    schemas: [...definition.schemas].sort((a, b) => a.type.localeCompare(b.type)),
    portSchemas: [...definition.portSchemas].sort((a, b) => a.id.localeCompare(b.id)),
    schemaGroups: [...definition.schemaGroups]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map(({ id, ...rest }) => rest), // Strip group IDs for comparison
    schemaRelationships: [...definition.schemaRelationships]
      .sort((a, b) => {
        const aKey = `${a.sourceSchemaType}-${a.targetSchemaType}`;
        const bKey = `${b.sourceSchemaType}-${b.targetSchemaType}`;
        return aKey.localeCompare(bKey);
      })
      .map(({ id, ...rest }) => rest), // Strip relationship IDs for comparison
  };
  const serialized = JSON.stringify(sortedDef);
  return sha256(serialized);
}

/**
 * Generate a group ID (matches the pattern in id-generators.ts).
 */
function generateGroupId(): string {
  return 'grp_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Generate a relationship ID (matches the pattern in seed-loader.ts).
 */
function generateRelationshipId(): string {
  return 'rel_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Apply a schema package to a document. Idempotent via manifest checks.
 *
 * @param adapter - Document adapter interface
 * @param definition - Schema package definition to load
 * @returns Result indicating whether package was applied or skipped
 */
export function applyPackage(
  adapter: DocumentAdapter,
  definition: SchemaPackageDefinition
): ApplyPackageResult {
  // 1. Check manifest - skip if already loaded
  const existing = adapter.getPackageManifestEntry(definition.id);
  if (existing) {
    return { status: 'skipped', packageId: definition.id };
  }

  // 2. Compute content hash before transaction
  const contentHash = computeContentHash(definition);

  // 3. Hydrate - Build fresh UUIDs for groups and relationships
  const groupIdMap = new Map<string, string>();

  // Generate new group IDs
  for (const group of definition.schemaGroups) {
    groupIdMap.set(group.id, generateGroupId());
  }

  // Hydrate groups with new IDs and packageId
  const hydratedGroups: SchemaGroup[] = definition.schemaGroups.map(group => {
    const newId = groupIdMap.get(group.id)!;
    const parentId = group.parentId ? groupIdMap.get(group.parentId) : undefined;
    return {
      ...group,
      id: newId,
      parentId,
      packageId: definition.id,
    };
  });

  // Hydrate schemas with remapped groupIds and packageId
  const hydratedSchemas: ConstructSchema[] = definition.schemas.map(schema => {
    const groupId = schema.groupId ? groupIdMap.get(schema.groupId) : undefined;
    return {
      ...schema,
      groupId,
      packageId: definition.id,
    };
  });

  // Hydrate port schemas with remapped groupIds and packageId
  const hydratedPortSchemas: PortSchema[] = definition.portSchemas.map(portSchema => {
    const groupId = portSchema.groupId ? groupIdMap.get(portSchema.groupId) : undefined;
    return {
      ...portSchema,
      groupId,
      packageId: definition.id,
    };
  });

  // Hydrate relationships with fresh IDs and packageId
  const hydratedRelationships: SchemaRelationship[] = definition.schemaRelationships.map(rel => ({
    ...rel,
    id: generateRelationshipId(),
    packageId: definition.id,
  }));

  // 4. Write to document in a single transaction
  adapter.transaction(() => {
    // Create the live SchemaPackage entry
    adapter.addSchemaPackage({
      id: definition.id,
      name: definition.name,
      description: definition.description,
      color: definition.color,
    });

    // Add all schemas
    for (const schema of hydratedSchemas) {
      adapter.addSchema(schema);
    }

    // Add all port schemas
    for (const portSchema of hydratedPortSchemas) {
      adapter.addPortSchema(portSchema);
    }

    // Add all groups
    for (const group of hydratedGroups) {
      adapter.addSchemaGroup(group);
    }

    // Add all relationships
    for (const relationship of hydratedRelationships) {
      adapter.addSchemaRelationship(relationship);
    }

    // 5. Build and add manifest entry
    const manifestEntry: PackageManifestEntry = {
      packageId: definition.id,
      contentHash,
      displayName: definition.name,
      loadedAt: new Date().toISOString(),
      snapshot: definition,
    };

    adapter.addPackageManifestEntry(manifestEntry);
  }, 'user');

  // 6. Return result
  return {
    status: 'applied',
    packageId: definition.id,
    schemasLoaded: definition.schemas.length,
  };
}

/**
 * Check if a loaded package has been modified in the document.
 * Compares current state against the snapshot stored in the manifest.
 *
 * @param adapter - Document adapter interface
 * @param packageId - Package ID to check
 * @returns true if package has been modified, false if unchanged
 * @throws Error if package manifest entry not found
 */
export function isPackageModified(
  adapter: DocumentAdapter,
  packageId: string
): boolean {
  // 1. Get manifest entry
  const manifestEntry = adapter.getPackageManifestEntry(packageId);
  if (!manifestEntry) {
    throw new Error(`Package manifest entry not found for packageId: ${packageId}`);
  }

  // 2. Reconstruct current state from document
  const allSchemas = adapter.getSchemas();
  const allPortSchemas = adapter.getPortSchemas();
  const allGroups = adapter.getSchemaGroups();
  const allRelationships = adapter.getSchemaRelationships();

  // Filter by packageId
  const currentSchemas = allSchemas.filter(s => s.packageId === packageId);
  const currentPortSchemas = allPortSchemas.filter(p => p.packageId === packageId);
  const currentGroups = allGroups.filter(g => g.packageId === packageId);
  const currentRelationships = allRelationships.filter(r => r.packageId === packageId);

  // Build group ID reverse map (current ID -> original ID from snapshot)
  const groupIdReverseMap = new Map<string, string>();
  for (const currentGroup of currentGroups) {
    // Find matching group in snapshot by name and hierarchy position
    const snapshotGroup = manifestEntry.snapshot.schemaGroups.find(sg =>
      sg.name === currentGroup.name &&
      sg.color === currentGroup.color
    );
    if (snapshotGroup) {
      groupIdReverseMap.set(currentGroup.id, snapshotGroup.id);
    }
  }

  // 3. Build a SchemaPackageDefinition from current state
  const reconstructed: SchemaPackageDefinition = {
    id: manifestEntry.snapshot.id,
    name: manifestEntry.snapshot.name,
    description: manifestEntry.snapshot.description,
    color: manifestEntry.snapshot.color,
    schemas: currentSchemas.map(schema => ({
      ...schema,
      groupId: schema.groupId ? groupIdReverseMap.get(schema.groupId) : undefined,
      packageId: undefined as unknown as string, // Remove packageId for comparison
    })).map(({ packageId, ...rest }) => rest) as ConstructSchema[],
    portSchemas: currentPortSchemas.map(portSchema => ({
      ...portSchema,
      groupId: portSchema.groupId ? groupIdReverseMap.get(portSchema.groupId) : undefined,
      packageId: undefined as unknown as string, // Remove packageId for comparison
    })).map(({ packageId, ...rest }) => rest) as PortSchema[],
    schemaGroups: currentGroups.map(group => {
      const originalId = groupIdReverseMap.get(group.id) || group.id;
      const originalParentId = group.parentId ? groupIdReverseMap.get(group.parentId) : undefined;
      const { packageId, ...rest } = {
        ...group,
        id: originalId,
        parentId: originalParentId,
      };
      return rest as SchemaGroup;
    }),
    schemaRelationships: currentRelationships.map(({ packageId, ...rest }) => rest) as SchemaRelationship[],
  };

  // 4. Compute content hash of reconstructed definition
  const currentHash = computeContentHash(reconstructed);

  // 5. Compare with manifest entry's hash
  return currentHash !== manifestEntry.contentHash;
}
