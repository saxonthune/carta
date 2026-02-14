import { useState, useEffect, useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';

/**
 * Focused hook for document metadata (title, description).
 * Only re-renders when meta changes.
 */
export function useDocumentMeta() {
  const { adapter } = useDocumentContext();

  const [title, setTitleState] = useState<string>(() => adapter.getTitle());
  const [description, setDescriptionState] = useState<string>(() => adapter.getDescription());

  useEffect(() => {
    const handleChange = () => {
      setTitleState(adapter.getTitle());
      setDescriptionState(adapter.getDescription());
    };
    const unsubscribe = adapter.subscribeToMeta
      ? adapter.subscribeToMeta(handleChange)
      : adapter.subscribe(handleChange);
    return unsubscribe;
  }, [adapter]);

  const setTitle = useCallback(
    (newTitle: string) => {
      adapter.setTitle(newTitle);
    },
    [adapter]
  );

  const setDescription = useCallback(
    (newDescription: string) => {
      adapter.setDescription(newDescription);
    },
    [adapter]
  );

  return { title, description, setTitle, setDescription };
}
