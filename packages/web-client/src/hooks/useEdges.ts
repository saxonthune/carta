import { useState, useEffect, useCallback } from 'react';
import type { CartaEdge } from '@carta/types';
import { useDocumentContext } from '../contexts/DocumentContext';

/**
 * Focused hook for edge state and operations.
 * Only re-renders when edges (or active level) change.
 */
export function useEdges() {
  const { adapter } = useDocumentContext();

  const [edges, setEdgesState] = useState<CartaEdge[]>(() => adapter.getEdges() as CartaEdge[]);

  useEffect(() => {
    const unsubscribe = adapter.subscribeToEdges
      ? adapter.subscribeToEdges(() => setEdgesState(adapter.getEdges() as CartaEdge[]))
      : adapter.subscribe(() => setEdgesState(adapter.getEdges() as CartaEdge[]));
    return unsubscribe;
  }, [adapter]);

  const setEdges = useCallback(
    (edgesOrUpdater: CartaEdge[] | ((prev: CartaEdge[]) => CartaEdge[])) => {
      adapter.setEdges(edgesOrUpdater);
    },
    [adapter]
  );

  return { edges, setEdges };
}
