import { useState, useEffect, useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext.js';
import { config } from '../config/featureFlags.js';
import type { LibraryEntry, SchemaPackage, ConstructSchema } from '@carta/domain';

export function useLibrary() {
  const { adapter, documentId } = useDocumentContext();

  const [libraryEntries, setLibraryEntriesState] = useState<LibraryEntry[]>(() => {
    return adapter.getLibraryEntries?.() ?? [];
  });

  const [schemaPackages, setSchemaPackagesState] = useState<SchemaPackage[]>(() => {
    return adapter.getSchemaPackages();
  });

  const [schemas, setSchemasState] = useState<ConstructSchema[]>(() => {
    return adapter.getSchemas();
  });

  useEffect(() => {
    const handler = () => {
      setLibraryEntriesState(adapter.getLibraryEntries?.() ?? []);
    };
    const unsubscribe = adapter.subscribeToLibraryEntries
      ? adapter.subscribeToLibraryEntries(handler)
      : adapter.subscribe(handler);
    return unsubscribe;
  }, [adapter]);

  useEffect(() => {
    const handler = () => {
      setSchemaPackagesState(adapter.getSchemaPackages());
    };
    const unsubscribe = adapter.subscribeToSchemaPackages
      ? adapter.subscribeToSchemaPackages(handler)
      : adapter.subscribe(handler);
    return unsubscribe;
  }, [adapter]);

  useEffect(() => {
    const handler = () => {
      setSchemasState(adapter.getSchemas());
    };
    const unsubscribe = adapter.subscribeToSchemas
      ? adapter.subscribeToSchemas(handler)
      : adapter.subscribe(handler);
    return unsubscribe;
  }, [adapter]);

  const publishPackage = useCallback(
    async (packageId: string, changelog?: string): Promise<void> => {
      if (!config.syncUrl) {
        throw new Error('Cannot publish package: no sync server configured');
      }
      const url = `${config.syncUrl}/api/documents/${documentId}/packages/${packageId}/publish`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ changelog }),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to publish package: ${error}`);
      }
    },
    [documentId]
  );

  const applyLibraryEntry = useCallback(
    async (entryId: string, version?: number): Promise<void> => {
      if (!config.syncUrl) {
        throw new Error('Cannot apply library entry: no sync server configured');
      }
      const url = `${config.syncUrl}/api/documents/${documentId}/library/${entryId}/apply`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version }),
      });
      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to apply library entry: ${error}`);
      }
    },
    [documentId]
  );

  return {
    libraryEntries,
    schemaPackages,
    schemas,
    publishPackage,
    applyLibraryEntry,
  };
}
