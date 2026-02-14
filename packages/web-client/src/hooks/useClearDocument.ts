import { useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';

export function useClearDocument() {
  const { adapter } = useDocumentContext();

  const clearDocument = useCallback((mode: 'instances' | 'all') => {
    adapter.transaction(() => {
      if (mode === 'instances') {
        // Clear only nodes and edges on active page, preserve schemas
        adapter.setNodes([]);
        adapter.setEdges([]);
      } else {
        // Clear everything: all pages' data, schemas, etc.
        const pages = adapter.getPages();
        for (const page of pages) {
          adapter.setActivePage(page.id);
          adapter.setNodes([]);
          adapter.setEdges([]);
        }
        // Delete all but first page, then recreate as "Main"
        if (pages.length > 1) {
          const firstPage = pages[0];
          for (let i = 1; i < pages.length; i++) {
            adapter.deletePage(pages[i].id);
          }
          adapter.updatePage(firstPage.id, { name: 'Main' });
          adapter.setActivePage(firstPage.id);
        } else if (pages.length === 1) {
          adapter.updatePage(pages[0].id, { name: 'Main' });
          adapter.setActivePage(pages[0].id);
        }
        // Clear shared data
        adapter.setSchemas([]);
        adapter.setPortSchemas([]);
        adapter.setSchemaGroups([]);
      }
    });
    // No reload needed - Yjs subscription propagates changes automatically
  }, [adapter]);

  return { clearDocument };
}
