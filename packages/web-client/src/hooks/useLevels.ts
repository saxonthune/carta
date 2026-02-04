import { useState, useEffect, useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { Level } from '@carta/domain';

/**
 * Focused hook for level state and operations.
 * Only re-renders when levels or active level change.
 */
export function useLevels() {
  const { adapter } = useDocumentContext();

  const [levels, setLevelsState] = useState<Level[]>(() => adapter.getLevels());
  const [activeLevel, setActiveLevelState] = useState<string | undefined>(() => adapter.getActiveLevel());

  useEffect(() => {
    const handleChange = () => {
      setLevelsState(adapter.getLevels());
      setActiveLevelState(adapter.getActiveLevel());
    };
    const unsubscribe = adapter.subscribeToLevels
      ? adapter.subscribeToLevels(handleChange)
      : adapter.subscribe(handleChange);
    return unsubscribe;
  }, [adapter]);

  const setActiveLevel = useCallback(
    (levelId: string) => {
      adapter.setActiveLevel(levelId);
    },
    [adapter]
  );

  const createLevel = useCallback(
    (name: string, description?: string) => adapter.createLevel(name, description),
    [adapter]
  );

  const deleteLevel = useCallback(
    (levelId: string) => adapter.deleteLevel(levelId),
    [adapter]
  );

  const updateLevel = useCallback(
    (levelId: string, updates: Partial<Omit<Level, 'id' | 'nodes' | 'edges' | 'deployables'>>) => {
      adapter.updateLevel(levelId, updates);
    },
    [adapter]
  );

  const duplicateLevel = useCallback(
    (levelId: string, newName: string) => adapter.duplicateLevel(levelId, newName),
    [adapter]
  );

  const copyNodesToLevel = useCallback(
    (nodeIds: string[], targetLevelId: string) => {
      adapter.copyNodesToLevel(nodeIds, targetLevelId);
    },
    [adapter]
  );

  return {
    levels,
    activeLevel,
    setActiveLevel,
    createLevel,
    deleteLevel,
    updateLevel,
    duplicateLevel,
    copyNodesToLevel,
  };
}
