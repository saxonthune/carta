import { useState, useEffect, useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { Page } from '@carta/schema';

/**
 * Focused hook for page state and operations.
 * Only re-renders when pages or active page change.
 */
export function usePages() {
  const { adapter } = useDocumentContext();

  const [pages, setPagesState] = useState<Page[]>(() => adapter.getPages());
  const [activePage, setActivePageState] = useState<string | undefined>(() => adapter.getActivePage());

  useEffect(() => {
    const handleChange = () => {
      setPagesState(adapter.getPages());
      setActivePageState(adapter.getActivePage());
    };
    const unsubscribe = adapter.subscribeToPages
      ? adapter.subscribeToPages(handleChange)
      : adapter.subscribe(handleChange);
    return unsubscribe;
  }, [adapter]);

  const setActivePage = useCallback(
    (pageId: string) => {
      adapter.setActivePage(pageId);
    },
    [adapter]
  );

  const createPage = useCallback(
    (name: string, description?: string) => adapter.createPage(name, description),
    [adapter]
  );

  const deletePage = useCallback(
    (pageId: string) => adapter.deletePage(pageId),
    [adapter]
  );

  const updatePage = useCallback(
    (pageId: string, updates: Partial<Omit<Page, 'id' | 'nodes' | 'edges' | 'deployables'>>) => {
      adapter.updatePage(pageId, updates);
    },
    [adapter]
  );

  const duplicatePage = useCallback(
    (pageId: string, newName: string) => adapter.duplicatePage(pageId, newName),
    [adapter]
  );

  const copyNodesToPage = useCallback(
    (nodeIds: string[], targetPageId: string) => {
      adapter.copyNodesToPage(nodeIds, targetPageId);
    },
    [adapter]
  );

  return {
    pages,
    activePage,
    setActivePage,
    createPage,
    deletePage,
    updatePage,
    duplicatePage,
    copyNodesToPage,
  };
}
