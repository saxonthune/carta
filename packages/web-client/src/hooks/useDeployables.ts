import { useState, useEffect, useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { Deployable } from '@carta/domain';

/**
 * Focused hook for deployable state and operations.
 * Only re-renders when deployables (or active level) change.
 */
export function useDeployables() {
  const { adapter } = useDocumentContext();

  const [deployables, setDeployablesState] = useState<Deployable[]>(() => adapter.getDeployables());

  useEffect(() => {
    const unsubscribe = adapter.subscribeToDeployables
      ? adapter.subscribeToDeployables(() => setDeployablesState(adapter.getDeployables()))
      : adapter.subscribe(() => setDeployablesState(adapter.getDeployables()));
    return unsubscribe;
  }, [adapter]);

  const getDeployable = useCallback(
    (id: string) => adapter.getDeployable(id),
    [adapter]
  );

  const setDeployables = useCallback(
    (newDeployables: Deployable[]) => {
      adapter.setDeployables(newDeployables);
    },
    [adapter]
  );

  const addDeployable = useCallback(
    (deployable: Omit<Deployable, 'id'>) => adapter.addDeployable(deployable),
    [adapter]
  );

  const updateDeployable = useCallback(
    (id: string, updates: Partial<Deployable>) => {
      adapter.updateDeployable(id, updates);
    },
    [adapter]
  );

  const removeDeployable = useCallback(
    (id: string) => adapter.removeDeployable(id),
    [adapter]
  );

  return {
    deployables,
    getDeployable,
    setDeployables,
    addDeployable,
    updateDeployable,
    removeDeployable,
  };
}
