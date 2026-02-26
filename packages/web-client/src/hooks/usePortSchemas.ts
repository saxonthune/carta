import { useState, useEffect, useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { PortSchema } from '@carta/schema';

/**
 * Focused hook for port schema state and operations.
 * Only re-renders when port schemas change.
 */
export function usePortSchemas() {
  const { adapter } = useDocumentContext();

  const [portSchemas, setPortSchemasState] = useState<PortSchema[]>(() => adapter.getPortSchemas());

  useEffect(() => {
    const unsubscribe = adapter.subscribeToPortSchemas
      ? adapter.subscribeToPortSchemas(() => setPortSchemasState(adapter.getPortSchemas()))
      : adapter.subscribe(() => setPortSchemasState(adapter.getPortSchemas()));
    return unsubscribe;
  }, [adapter]);

  const getPortSchema = useCallback(
    (id: string) => adapter.getPortSchema(id),
    [adapter]
  );

  const getPortSchemas = useCallback(() => adapter.getPortSchemas(), [adapter]);

  const setPortSchemas = useCallback(
    (newSchemas: PortSchema[]) => {
      adapter.setPortSchemas(newSchemas);
    },
    [adapter]
  );

  const addPortSchema = useCallback(
    (schema: PortSchema) => {
      adapter.addPortSchema(schema);
    },
    [adapter]
  );

  const updatePortSchema = useCallback(
    (id: string, updates: Partial<PortSchema>) => {
      adapter.updatePortSchema(id, updates);
    },
    [adapter]
  );

  const removePortSchema = useCallback(
    (id: string) => adapter.removePortSchema(id),
    [adapter]
  );

  return {
    portSchemas,
    getPortSchema,
    getPortSchemas,
    setPortSchemas,
    addPortSchema,
    updatePortSchema,
    removePortSchema,
  };
}
