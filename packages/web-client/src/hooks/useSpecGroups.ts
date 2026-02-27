import { useState, useEffect, useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { SpecGroup, SpecGroupItem } from '@carta/schema';

export function useSpecGroups() {
  const { adapter } = useDocumentContext();
  const [specGroups, setSpecGroups] = useState<SpecGroup[]>(() => adapter.getSpecGroups());

  useEffect(() => {
    const handleChange = () => setSpecGroups(adapter.getSpecGroups());
    const unsubscribe = adapter.subscribeToSpecGroups
      ? adapter.subscribeToSpecGroups(handleChange)
      : adapter.subscribe(handleChange);
    return unsubscribe;
  }, [adapter]);

  const createSpecGroup = useCallback(
    (name: string, description?: string) => adapter.createSpecGroup(name, description),
    [adapter]
  );
  const updateSpecGroup = useCallback(
    (id: string, updates: { name?: string; description?: string; order?: number; items?: SpecGroupItem[] }) =>
      adapter.updateSpecGroup(id, updates),
    [adapter]
  );
  const deleteSpecGroup = useCallback(
    (id: string) => adapter.deleteSpecGroup(id),
    [adapter]
  );
  const assignToSpecGroup = useCallback(
    (groupId: string, item: SpecGroupItem) => adapter.assignToSpecGroup(groupId, item),
    [adapter]
  );
  const removeFromSpecGroup = useCallback(
    (itemType: 'page' | 'resource', itemId: string) => adapter.removeFromSpecGroup(itemType, itemId),
    [adapter]
  );

  return { specGroups, createSpecGroup, updateSpecGroup, deleteSpecGroup, assignToSpecGroup, removeFromSpecGroup };
}
