import { useState, useEffect, useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext.js';
import type { SchemaPackage } from '@carta/domain';

export function useSchemaPackages() {
  const { adapter } = useDocumentContext();

  const [schemaPackages, setSchemaPackagesState] = useState<SchemaPackage[]>(() => {
    return adapter.getSchemaPackages();
  });

  useEffect(() => {
    const handler = () => {
      setSchemaPackagesState(adapter.getSchemaPackages());
    };
    const unsubscribe = adapter.subscribeToSchemaPackages
      ? adapter.subscribeToSchemaPackages(handler)
      : adapter.subscribe(handler);
    return unsubscribe;
  }, [adapter]);

  const getSchemaPackage = useCallback(
    (id: string) => adapter.getSchemaPackage(id),
    [adapter]
  );

  return {
    schemaPackages,
    getSchemaPackage,
  };
}
