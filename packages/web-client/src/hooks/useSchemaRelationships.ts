import { useState, useEffect, useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { SchemaRelationship } from '@carta/schema';

/**
 * Focused hook for schema relationship state and operations.
 * Only re-renders when schema relationships change.
 */
export function useSchemaRelationships() {
  const { adapter } = useDocumentContext();

  const [relationships, setRelationships] = useState<SchemaRelationship[]>(
    () => adapter.getSchemaRelationships()
  );

  useEffect(() => {
    const unsubscribe = adapter.subscribeToSchemaRelationships
      ? adapter.subscribeToSchemaRelationships(() => setRelationships(adapter.getSchemaRelationships()))
      : adapter.subscribe(() => setRelationships(adapter.getSchemaRelationships()));
    return unsubscribe;
  }, [adapter]);

  const addRelationship = useCallback(
    (rel: SchemaRelationship) => adapter.addSchemaRelationship(rel),
    [adapter]
  );

  const updateRelationship = useCallback(
    (id: string, updates: Partial<SchemaRelationship>) => adapter.updateSchemaRelationship(id, updates),
    [adapter]
  );

  const removeRelationship = useCallback(
    (id: string) => adapter.removeSchemaRelationship(id),
    [adapter]
  );

  /** Get all relationships where the given schema type is source or target */
  const getRelationshipsForSchema = useCallback(
    (schemaType: string) => relationships.filter(
      r => r.sourceSchemaType === schemaType || r.targetSchemaType === schemaType
    ),
    [relationships]
  );

  return {
    relationships,
    addRelationship,
    updateRelationship,
    removeRelationship,
    getRelationshipsForSchema,
  };
}
