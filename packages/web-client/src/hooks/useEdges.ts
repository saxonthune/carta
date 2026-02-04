import { useState, useEffect, useCallback } from 'react';
import type { Edge } from '@xyflow/react';
import { useDocumentContext } from '../contexts/DocumentContext';

/**
 * Focused hook for edge state and operations.
 * Only re-renders when edges (or active level) change.
 */
export function useEdges() {
  const { adapter } = useDocumentContext();

  const [edges, setEdgesState] = useState<Edge[]>(() => adapter.getEdges() as Edge[]);

  useEffect(() => {
    const unsubscribe = adapter.subscribeToEdges
      ? adapter.subscribeToEdges(() => setEdgesState(adapter.getEdges() as Edge[]))
      : adapter.subscribe(() => setEdgesState(adapter.getEdges() as Edge[]));
    return unsubscribe;
  }, [adapter]);

  const setEdges = useCallback(
    (edgesOrUpdater: Edge[] | ((prev: Edge[]) => Edge[])) => {
      adapter.setEdges(edgesOrUpdater as unknown[] | ((prev: unknown[]) => unknown[]));
    },
    [adapter]
  );

  return { edges, setEdges };
}
