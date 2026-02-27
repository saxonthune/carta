import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { Resource } from '@carta/schema';

export function useResources() {
  const { adapter } = useDocumentContext();

  const [resources, setResourcesState] = useState<Array<{ id: string; name: string; format: string; currentHash: string; versionCount: number }>>(() => adapter.getResources());

  useEffect(() => {
    const unsubscribe = adapter.subscribeToResources
      ? adapter.subscribeToResources(() => setResourcesState(adapter.getResources()))
      : adapter.subscribe(() => setResourcesState(adapter.getResources()));
    return unsubscribe;
  }, [adapter]);

  const resourceById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; format: string; currentHash: string; versionCount: number }>();
    for (const r of resources) {
      map.set(r.id, r);
    }
    return map;
  }, [resources]);

  const getResource = useCallback(
    (id: string) => resourceById.get(id),
    [resourceById]
  );

  // Full resource with body — call adapter directly since this is on-demand
  const getFullResource = useCallback(
    (id: string): Resource | undefined => adapter.getResource(id),
    [adapter]
  );

  return { resources, resourceById, getResource, getFullResource };
}
