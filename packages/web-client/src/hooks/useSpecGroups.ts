import { useState, useEffect, useCallback } from 'react';
import type { GroupMeta } from '@carta/schema';
import { useDocumentContext } from '../contexts/DocumentContext';

export function useSpecGroups() {
  const { adapter } = useDocumentContext();
  const [groupMetadata, setGroupMetadata] = useState<Record<string, GroupMeta>>(() => adapter.getGroupMetadata());

  useEffect(() => {
    const handleChange = () => setGroupMetadata(adapter.getGroupMetadata());
    const unsubscribe = adapter.subscribeToGroupMetadata
      ? adapter.subscribeToGroupMetadata(handleChange)
      : adapter.subscribe(handleChange);
    return unsubscribe;
  }, [adapter]);

  const setGroupMeta = useCallback(
    (key: string, meta: GroupMeta) => adapter.setGroupMetadata(key, meta),
    [adapter],
  );

  const deleteGroupMeta = useCallback(
    (key: string) => adapter.deleteGroupMetadata(key),
    [adapter],
  );

  const setPageGroup = useCallback(
    (pageId: string, groupKey: string | null) => adapter.updatePage(pageId, { group: groupKey }),
    [adapter],
  );

  return { groupMetadata, setGroupMetadata: setGroupMeta, deleteGroupMetadata: deleteGroupMeta, setPageGroup };
}
