import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext.js';
import {
  standardLibrary,
  applyPackage,
  isPackageModified,
  type SchemaPackageDefinition,
  type PackageManifestEntry,
  type ApplyPackageResult,
} from '@carta/domain';

export type PackageLoadStatus = 'available' | 'loaded' | 'modified';

export interface PackagePickerItem {
  definition: SchemaPackageDefinition;
  status: PackageLoadStatus;
  manifestEntry?: PackageManifestEntry;
  schemaCount: number; // how many schemas in the doc match this packageId
}

export function usePackagePicker() {
  const { adapter } = useDocumentContext();

  // Read manifest entries reactively
  const [manifestEntries, setManifestEntries] = useState<PackageManifestEntry[]>(() => {
    return adapter.getPackageManifest();
  });

  useEffect(() => {
    const handler = () => setManifestEntries(adapter.getPackageManifest());
    const unsubscribe = adapter.subscribeToPackageManifest
      ? adapter.subscribeToPackageManifest(handler)
      : adapter.subscribe(handler);
    return unsubscribe;
  }, [adapter]);

  // Compute picker items from standardLibrary + manifest
  const items: PackagePickerItem[] = useMemo(() => {
    const allSchemas = adapter.getSchemas();
    return standardLibrary.map((def) => {
      const entry = manifestEntries.find(e => e.packageId === def.id);
      const schemaCount = allSchemas.filter(s => s.packageId === def.id).length;
      if (!entry) {
        return { definition: def, status: 'available' as const, schemaCount };
      }
      // Check drift
      const modified = isPackageModified(adapter, def.id);
      return {
        definition: def,
        status: modified ? 'modified' as const : 'loaded' as const,
        manifestEntry: entry,
        schemaCount,
      };
    });
  }, [manifestEntries, adapter]);

  // Load action
  const loadPackage = useCallback((definition: SchemaPackageDefinition): ApplyPackageResult => {
    return applyPackage(adapter, definition);
  }, [adapter]);

  // Repair action — remove all package artifacts and re-apply
  const repairPackage = useCallback((definition: SchemaPackageDefinition): ApplyPackageResult => {
    // 1. Remove stale manifest entry so applyPackage won't skip
    adapter.removePackageManifestEntry(definition.id);
    // 2. Remove existing schemas belonging to this package
    const schemas = adapter.getSchemas().filter(s => s.packageId === definition.id);
    for (const s of schemas) {
      adapter.removeSchema(s.type);
    }
    // 3. Remove existing port schemas belonging to this package
    const portSchemas = adapter.getPortSchemas().filter(p => p.packageId === definition.id);
    for (const p of portSchemas) {
      adapter.removePortSchema(p.id);
    }
    // 4. Remove existing groups belonging to this package
    const groups = adapter.getSchemaGroups().filter(g => g.packageId === definition.id);
    for (const g of groups) {
      adapter.removeSchemaGroup(g.id);
    }
    // 5. Remove existing relationships belonging to this package
    const relationships = adapter.getSchemaRelationships().filter(r => r.packageId === definition.id);
    for (const r of relationships) {
      adapter.removeSchemaRelationship(r.id);
    }
    // 6. Remove the package shell itself
    adapter.removeSchemaPackage(definition.id);
    // 7. Re-apply from standard library
    return applyPackage(adapter, definition);
  }, [adapter]);

  return { items, loadPackage, repairPackage };
}
