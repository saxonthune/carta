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
    return standardLibrary.map((def) => {
      const entry = manifestEntries.find(e => e.packageId === def.id);
      if (!entry) {
        return { definition: def, status: 'available' as const };
      }
      // Check drift
      const modified = isPackageModified(adapter, def.id);
      return {
        definition: def,
        status: modified ? 'modified' as const : 'loaded' as const,
        manifestEntry: entry,
      };
    });
  }, [manifestEntries, adapter]);

  // Load action
  const loadPackage = useCallback((definition: SchemaPackageDefinition): ApplyPackageResult => {
    return applyPackage(adapter, definition);
  }, [adapter]);

  return { items, loadPackage };
}
