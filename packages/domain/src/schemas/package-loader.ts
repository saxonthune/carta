import { sha256 } from 'js-sha256';
import type {
  DocumentAdapter,
  SchemaPackageDefinition,
  PackageManifestEntry,
  SchemaGroup,
  ConstructSchema,
  PortSchema,
  SchemaRelationship,
  FieldSchema,
} from '../types/index.js';

export interface ApplyPackageResult {
  status: 'applied' | 'skipped';
  packageId: string;
  schemasLoaded?: number;
}

export interface FieldChange {
  fieldName: string;
  status: 'added' | 'removed' | 'modified';
  detail?: string;
}

export interface SchemaDiff {
  type: string;
  displayName: string;
  status: 'added' | 'removed' | 'modified';
  fieldChanges?: FieldChange[];
}

export interface PortSchemaDiff {
  id: string;
  displayName: string;
  status: 'added' | 'removed' | 'modified';
}

export interface GroupDiff {
  name: string;
  status: 'added' | 'removed' | 'modified';
  detail?: string;
}

export interface RelationshipDiff {
  sourceSchemaType: string;
  targetSchemaType: string;
  status: 'added' | 'removed' | 'modified';
  detail?: string;
}

export interface PackageDiff {
  packageName: string;
  packageColor: string;
  schemas: SchemaDiff[];
  portSchemas: PortSchemaDiff[];
  groups?: GroupDiff[];
  relationships?: RelationshipDiff[];
  summary: { added: number; removed: number; modified: number };
}

/**
 * Compute a deterministic content hash of a SchemaPackageDefinition.
 * Uses JSON.stringify with sorted keys for determinism.
 * Strips runtime-generated IDs (relationship.id, group IDs) for stable comparison.
 */
export function computeContentHash(definition: SchemaPackageDefinition): string {
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

/**
 * Check if the current standard library version is newer than the loaded snapshot.
 * Compares the snapshot stored in the manifest against the current library definition.
 *
 * @param manifestEntry - Package manifest entry containing the snapshot
 * @param libraryDefinition - Current library definition to compare against
 * @returns true if library version differs from snapshot, false if unchanged
 */
export function isLibraryNewer(
  manifestEntry: PackageManifestEntry,
  libraryDefinition: SchemaPackageDefinition
): boolean {
  const snapshotHash = computeContentHash(manifestEntry.snapshot);
  const libraryHash = computeContentHash(libraryDefinition);
  return snapshotHash !== libraryHash;
}

/**
 * Compare two sets of field schemas and return changes.
 */
function diffFields(snapshotFields: FieldSchema[], currentFields: FieldSchema[]): FieldChange[] {
  const changes: FieldChange[] = [];
  const snapshotByName = new Map(snapshotFields.map(f => [f.name, f]));
  const currentByName = new Map(currentFields.map(f => [f.name, f]));

  for (const [name, snapshotField] of snapshotByName) {
    const currentField = currentByName.get(name);
    if (!currentField) {
      changes.push({ fieldName: name, status: 'removed' });
    } else if (snapshotField.type !== currentField.type) {
      changes.push({ fieldName: name, status: 'modified', detail: `type: ${snapshotField.type} → ${currentField.type}` });
    } else if (snapshotField.displayTier !== currentField.displayTier) {
      changes.push({ fieldName: name, status: 'modified', detail: `tier: ${snapshotField.displayTier || 'inspector'} → ${currentField.displayTier || 'inspector'}` });
    }
  }

  for (const [name] of currentByName) {
    if (!snapshotByName.has(name)) {
      changes.push({ fieldName: name, status: 'added' });
    }
  }

  return changes;
}

/**
 * Diff two arrays of construct schemas by type.
 */
function diffSchemaArrays(
  snapshotSchemas: ConstructSchema[],
  currentSchemas: ConstructSchema[]
): SchemaDiff[] {
  const snapshotByType = new Map(snapshotSchemas.map(s => [s.type, s]));
  const currentByType = new Map(currentSchemas.map(s => [s.type, s]));

  const schemaDiffs: SchemaDiff[] = [];

  // Check for removed and modified schemas
  for (const [type, snapshotSchema] of snapshotByType) {
    const currentSchema = currentByType.get(type);
    if (!currentSchema) {
      schemaDiffs.push({
        type,
        displayName: snapshotSchema.displayName,
        status: 'removed',
      });
    } else {
      // Compare fields
      const fieldChanges = diffFields(snapshotSchema.fields, currentSchema.fields);
      if (fieldChanges.length > 0) {
        schemaDiffs.push({
          type,
          displayName: currentSchema.displayName,
          status: 'modified',
          fieldChanges,
        });
      }
    }
  }

  // Check for added schemas
  for (const [type, currentSchema] of currentByType) {
    if (!snapshotByType.has(type)) {
      schemaDiffs.push({
        type,
        displayName: currentSchema.displayName,
        status: 'added',
      });
    }
  }

  return schemaDiffs;
}

/**
 * Diff two arrays of port schemas by id.
 */
function diffPortSchemaArrays(
  snapshotPorts: PortSchema[],
  currentPorts: PortSchema[]
): PortSchemaDiff[] {
  const snapshotPortById = new Map(snapshotPorts.map(p => [p.id, p]));
  const currentPortById = new Map(currentPorts.map(p => [p.id, p]));

  const portDiffs: PortSchemaDiff[] = [];

  for (const [id, snapshotPort] of snapshotPortById) {
    const currentPort = currentPortById.get(id);
    if (!currentPort) {
      portDiffs.push({ id, displayName: snapshotPort.displayName, status: 'removed' });
    } else if (JSON.stringify(snapshotPort) !== JSON.stringify(currentPort)) {
      portDiffs.push({ id, displayName: currentPort.displayName, status: 'modified' });
    }
  }

  for (const [id, currentPort] of currentPortById) {
    if (!snapshotPortById.has(id)) {
      portDiffs.push({ id, displayName: currentPort.displayName, status: 'added' });
    }
  }

  return portDiffs;
}

/**
 * Diff two arrays of schema groups by name.
 */
function diffGroupArrays(
  snapshotGroups: SchemaGroup[],
  currentGroups: SchemaGroup[]
): GroupDiff[] {
  const snapshotByName = new Map(snapshotGroups.map(g => [g.name, g]));
  const currentByName = new Map(currentGroups.map(g => [g.name, g]));

  const groupDiffs: GroupDiff[] = [];

  for (const [name, snapshotGroup] of snapshotByName) {
    const currentGroup = currentByName.get(name);
    if (!currentGroup) {
      groupDiffs.push({ name, status: 'removed' });
    } else {
      const changes: string[] = [];
      if (snapshotGroup.color !== currentGroup.color) {
        changes.push(`color: ${snapshotGroup.color ?? 'none'} → ${currentGroup.color ?? 'none'}`);
      }
      const snapshotHasParent = snapshotGroup.parentId !== undefined;
      const currentHasParent = currentGroup.parentId !== undefined;
      if (snapshotHasParent !== currentHasParent) {
        changes.push(`parent: ${snapshotHasParent ? 'yes' : 'none'} → ${currentHasParent ? 'yes' : 'none'}`);
      }
      if (changes.length > 0) {
        groupDiffs.push({ name, status: 'modified', detail: changes.join(', ') });
      }
    }
  }

  for (const [name] of currentByName) {
    if (!snapshotByName.has(name)) {
      groupDiffs.push({ name, status: 'added' });
    }
  }

  return groupDiffs;
}

/**
 * Diff two arrays of schema relationships by sourceSchemaType+targetSchemaType composite key.
 */
function diffRelationshipArrays(
  snapshotRels: SchemaRelationship[],
  currentRels: SchemaRelationship[]
): RelationshipDiff[] {
  const key = (r: SchemaRelationship) => `${r.sourceSchemaType}::${r.targetSchemaType}`;
  const snapshotByKey = new Map(snapshotRels.map(r => [key(r), r]));
  const currentByKey = new Map(currentRels.map(r => [key(r), r]));

  const relDiffs: RelationshipDiff[] = [];

  for (const [k, snapshotRel] of snapshotByKey) {
    const currentRel = currentByKey.get(k);
    if (!currentRel) {
      relDiffs.push({ sourceSchemaType: snapshotRel.sourceSchemaType, targetSchemaType: snapshotRel.targetSchemaType, status: 'removed' });
    } else {
      const changes: string[] = [];
      if (snapshotRel.sourcePortId !== currentRel.sourcePortId) {
        changes.push(`sourcePortId: ${snapshotRel.sourcePortId} → ${currentRel.sourcePortId}`);
      }
      if (snapshotRel.targetPortId !== currentRel.targetPortId) {
        changes.push(`targetPortId: ${snapshotRel.targetPortId} → ${currentRel.targetPortId}`);
      }
      if (changes.length > 0) {
        relDiffs.push({ sourceSchemaType: snapshotRel.sourceSchemaType, targetSchemaType: snapshotRel.targetSchemaType, status: 'modified', detail: changes.join(', ') });
      }
    }
  }

  for (const [k, currentRel] of currentByKey) {
    if (!snapshotByKey.has(k)) {
      relDiffs.push({ sourceSchemaType: currentRel.sourceSchemaType, targetSchemaType: currentRel.targetSchemaType, status: 'added' });
    }
  }

  return relDiffs;
}

/**
 * Compute a diff between a package's snapshot and its current state in the document.
 * Shows added/removed/modified schemas and port schemas with field-level details.
 *
 * @param adapter - Document adapter interface
 * @param packageId - Package ID to diff
 * @returns PackageDiff or null if manifest entry not found
 */
export function computePackageDiff(
  adapter: DocumentAdapter,
  packageId: string
): PackageDiff | null {
  const manifestEntry = adapter.getPackageManifestEntry(packageId);
  if (!manifestEntry) return null;

  const snapshotSchemas = manifestEntry.snapshot.schemas;
  const snapshotPortSchemas = manifestEntry.snapshot.portSchemas;
  const snapshotGroups = manifestEntry.snapshot.schemaGroups;
  const snapshotRelationships = manifestEntry.snapshot.schemaRelationships;

  const currentSchemas = adapter.getSchemas().filter(s => s.packageId === packageId);
  const currentPortSchemas = adapter.getPortSchemas().filter(p => p.packageId === packageId);
  const currentGroups = adapter.getSchemaGroups()
    .filter(g => g.packageId === packageId)
    .map(({ packageId: _pid, ...rest }) => rest) as SchemaGroup[];
  const currentRelationships = adapter.getSchemaRelationships()
    .filter(r => r.packageId === packageId)
    .map(({ packageId: _pid, ...rest }) => rest) as SchemaRelationship[];

  const schemaDiffs = diffSchemaArrays(snapshotSchemas, currentSchemas);
  const portDiffs = diffPortSchemaArrays(snapshotPortSchemas, currentPortSchemas);
  const groupDiffs = diffGroupArrays(snapshotGroups, currentGroups);
  const relDiffs = diffRelationshipArrays(snapshotRelationships, currentRelationships);

  const summary = {
    added: schemaDiffs.filter(d => d.status === 'added').length +
      portDiffs.filter(d => d.status === 'added').length +
      groupDiffs.filter(d => d.status === 'added').length +
      relDiffs.filter(d => d.status === 'added').length,
    removed: schemaDiffs.filter(d => d.status === 'removed').length +
      portDiffs.filter(d => d.status === 'removed').length +
      groupDiffs.filter(d => d.status === 'removed').length +
      relDiffs.filter(d => d.status === 'removed').length,
    modified: schemaDiffs.filter(d => d.status === 'modified').length +
      portDiffs.filter(d => d.status === 'modified').length +
      groupDiffs.filter(d => d.status === 'modified').length +
      relDiffs.filter(d => d.status === 'modified').length,
  };

  return {
    packageName: manifestEntry.displayName,
    packageColor: manifestEntry.snapshot.color,
    schemas: schemaDiffs,
    portSchemas: portDiffs,
    groups: groupDiffs.length > 0 ? groupDiffs : undefined,
    relationships: relDiffs.length > 0 ? relDiffs : undefined,
    summary,
  };
}

/**
 * Compute a diff between two schema package definitions.
 * This is used to compare snapshot vs library when detecting updates.
 *
 * @param baseline - Baseline definition (typically the snapshot)
 * @param current - Current definition (typically the library)
 * @returns PackageDiff showing differences
 */
export function computePackageDiffFromDefinitions(
  baseline: SchemaPackageDefinition,
  current: SchemaPackageDefinition
): PackageDiff {
  const schemaDiffs = diffSchemaArrays(baseline.schemas, current.schemas);
  const portDiffs = diffPortSchemaArrays(baseline.portSchemas, current.portSchemas);

  const summary = {
    added: schemaDiffs.filter(d => d.status === 'added').length,
    removed: schemaDiffs.filter(d => d.status === 'removed').length,
    modified: schemaDiffs.filter(d => d.status === 'modified').length,
  };

  return {
    packageName: current.name,
    packageColor: current.color,
    schemas: schemaDiffs,
    portSchemas: portDiffs,
    summary,
  };
}

/**
 * Extract a package definition from the document for publishing.
 * Strips packageId from all items since the definition is self-contained.
 *
 * @param adapter - Document adapter interface
 * @param packageId - Package ID to extract
 * @returns SchemaPackageDefinition or null if package not found
 */
export function extractPackageDefinition(
  adapter: DocumentAdapter,
  packageId: string
): SchemaPackageDefinition | null {
  const pkg = adapter.getSchemaPackage(packageId);
  if (!pkg) return null;

  const schemas = adapter.getSchemas()
    .filter(s => s.packageId === packageId)
    .map(({ packageId: _pid, ...rest }) => rest) as ConstructSchema[];

  const portSchemas = adapter.getPortSchemas()
    .filter(p => p.packageId === packageId)
    .map(({ packageId: _pid, ...rest }) => rest) as PortSchema[];

  const schemaGroups = adapter.getSchemaGroups()
    .filter(g => g.packageId === packageId)
    .map(({ packageId: _pid, ...rest }) => rest) as SchemaGroup[];

  const schemaRelationships = adapter.getSchemaRelationships()
    .filter(r => r.packageId === packageId)
    .map(({ packageId: _pid, ...rest }) => rest) as SchemaRelationship[];

  return {
    id: pkg.id,
    name: pkg.name,
    description: pkg.description || '',
    color: pkg.color,
    schemas,
    portSchemas,
    schemaGroups,
    schemaRelationships,
  };
}

/**
 * Debug helper: dumps the intermediate state used by isPackageModified to the caller.
 * Use this to diagnose why a package shows as "Modified" when "View Changes" shows nothing.
 *
 * @param adapter - Document adapter interface
 * @param packageId - Package ID to debug
 * @returns Diagnostic object with snapshot, reconstructed state, and group mapping details
 */
export function debugPackageDrift(
  adapter: DocumentAdapter,
  packageId: string
) {
  const manifestEntry = adapter.getPackageManifestEntry(packageId);
  if (!manifestEntry) return { error: 'No manifest entry found' };

  const allSchemas = adapter.getSchemas();
  const allPortSchemas = adapter.getPortSchemas();
  const allGroups = adapter.getSchemaGroups();
  const allRelationships = adapter.getSchemaRelationships();

  const currentSchemas = allSchemas.filter(s => s.packageId === packageId);
  const currentPortSchemas = allPortSchemas.filter(p => p.packageId === packageId);
  const currentGroups = allGroups.filter(g => g.packageId === packageId);
  const currentRelationships = allRelationships.filter(r => r.packageId === packageId);

  // Build group mapping diagnostics
  const groupMapping: Array<{ current: string; snapshot: string | null; name: string; color: string | undefined }> = [];
  const groupIdReverseMap = new Map<string, string>();
  for (const currentGroup of currentGroups) {
    const snapshotGroup = manifestEntry.snapshot.schemaGroups.find(sg =>
      sg.name === currentGroup.name && sg.color === currentGroup.color
    );
    groupMapping.push({
      current: currentGroup.id,
      snapshot: snapshotGroup?.id ?? null,
      name: currentGroup.name,
      color: currentGroup.color,
    });
    if (snapshotGroup) {
      groupIdReverseMap.set(currentGroup.id, snapshotGroup.id);
    }
  }

  // Build reconstructed definition (same logic as isPackageModified)
  const reconstructed: SchemaPackageDefinition = {
    id: manifestEntry.snapshot.id,
    name: manifestEntry.snapshot.name,
    description: manifestEntry.snapshot.description,
    color: manifestEntry.snapshot.color,
    schemas: currentSchemas.map(schema => ({
      ...schema,
      groupId: schema.groupId ? groupIdReverseMap.get(schema.groupId) : undefined,
      packageId: undefined as unknown as string,
    })).map(({ packageId: _pid, ...rest }) => rest) as ConstructSchema[],
    portSchemas: currentPortSchemas.map(portSchema => ({
      ...portSchema,
      groupId: portSchema.groupId ? groupIdReverseMap.get(portSchema.groupId) : undefined,
      packageId: undefined as unknown as string,
    })).map(({ packageId: _pid, ...rest }) => rest) as PortSchema[],
    schemaGroups: currentGroups.map(group => {
      const originalId = groupIdReverseMap.get(group.id) || group.id;
      const originalParentId = group.parentId ? groupIdReverseMap.get(group.parentId) : undefined;
      const { packageId: _pid, ...rest } = { ...group, id: originalId, parentId: originalParentId };
      return rest as SchemaGroup;
    }),
    schemaRelationships: currentRelationships.map(({ packageId: _pid, ...rest }) => rest) as SchemaRelationship[],
  };

  const manifestHash = manifestEntry.contentHash;
  const reconstructedHash = computeContentHash(reconstructed);

  return {
    manifestHash,
    reconstructedHash,
    isModified: manifestHash !== reconstructedHash,
    snapshot: manifestEntry.snapshot,
    reconstructed,
    groupMapping,
    unmappedGroups: groupMapping.filter(g => g.snapshot === null),
    schemaCount: { snapshot: manifestEntry.snapshot.schemas.length, current: currentSchemas.length },
    portSchemaCount: { snapshot: manifestEntry.snapshot.portSchemas.length, current: currentPortSchemas.length },
    groupCount: { snapshot: manifestEntry.snapshot.schemaGroups.length, current: currentGroups.length },
    relationshipCount: { snapshot: manifestEntry.snapshot.schemaRelationships.length, current: currentRelationships.length },
  };
}
