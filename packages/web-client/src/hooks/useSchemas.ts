import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { ConstructSchema } from '@carta/domain';

/**
 * Focused hook for schema state and operations.
 * Only re-renders when schemas change.
 */
export function useSchemas() {
  const { adapter } = useDocumentContext();

  const [schemas, setSchemasState] = useState<ConstructSchema[]>(() => adapter.getSchemas());

  useEffect(() => {
    const unsubscribe = adapter.subscribeToSchemas
      ? adapter.subscribeToSchemas(() => setSchemasState(adapter.getSchemas()))
      : adapter.subscribe(() => setSchemasState(adapter.getSchemas()));
    return unsubscribe;
  }, [adapter]);

  // Memoized lookup map for getSchema
  const schemaById = useMemo(() => {
    const map = new Map<string, ConstructSchema>();
    for (const schema of schemas) {
      map.set(schema.type, schema);
    }
    return map;
  }, [schemas]);

  const getSchema = useCallback(
    (type: string) => schemaById.get(type),
    [schemaById]
  );

  const setSchemas = useCallback(
    (newSchemas: ConstructSchema[]) => {
      adapter.setSchemas(newSchemas);
    },
    [adapter]
  );

  const addSchema = useCallback(
    (schema: ConstructSchema) => {
      adapter.addSchema(schema);
    },
    [adapter]
  );

  const updateSchema = useCallback(
    (type: string, updates: Partial<ConstructSchema>) => {
      adapter.updateSchema(type, updates);
    },
    [adapter]
  );

  const removeSchema = useCallback(
    (type: string) => adapter.removeSchema(type),
    [adapter]
  );

  return { schemas, schemaById, getSchema, setSchemas, addSchema, updateSchema, removeSchema };
}
