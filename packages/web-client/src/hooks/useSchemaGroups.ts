import { useState, useEffect, useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { SchemaGroup } from '@carta/domain';

/**
 * Focused hook for schema group state and operations.
 * Only re-renders when schema groups change.
 */
export function useSchemaGroups() {
  const { adapter } = useDocumentContext();

  const [schemaGroups, setSchemaGroupsState] = useState<SchemaGroup[]>(() => adapter.getSchemaGroups());

  useEffect(() => {
    const unsubscribe = adapter.subscribeToSchemaGroups
      ? adapter.subscribeToSchemaGroups(() => setSchemaGroupsState(adapter.getSchemaGroups()))
      : adapter.subscribe(() => setSchemaGroupsState(adapter.getSchemaGroups()));
    return unsubscribe;
  }, [adapter]);

  const getSchemaGroup = useCallback(
    (id: string) => adapter.getSchemaGroup(id),
    [adapter]
  );

  const getSchemaGroups = useCallback(() => adapter.getSchemaGroups(), [adapter]);

  const setSchemaGroups = useCallback(
    (groups: SchemaGroup[]) => {
      adapter.setSchemaGroups(groups);
    },
    [adapter]
  );

  const addSchemaGroup = useCallback(
    (group: Omit<SchemaGroup, 'id'>) => adapter.addSchemaGroup(group),
    [adapter]
  );

  const updateSchemaGroup = useCallback(
    (id: string, updates: Partial<SchemaGroup>) => {
      adapter.updateSchemaGroup(id, updates);
    },
    [adapter]
  );

  const removeSchemaGroup = useCallback(
    (id: string) => adapter.removeSchemaGroup(id),
    [adapter]
  );

  return {
    schemaGroups,
    getSchemaGroup,
    getSchemaGroups,
    setSchemaGroups,
    addSchemaGroup,
    updateSchemaGroup,
    removeSchemaGroup,
  };
}
