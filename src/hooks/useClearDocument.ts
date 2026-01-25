import { useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';

// Key used to flag that user intentionally cleared everything (skip re-seeding built-ins)
export const SKIP_BUILTIN_SEED_KEY = 'carta-skip-builtin-seed';

export function useClearDocument() {
  const { adapter } = useDocumentContext();

  const clearDocument = useCallback((mode: 'instances' | 'all') => {
    adapter.transaction(() => {
      if (mode === 'instances') {
        // Clear only nodes and edges, preserve schemas and deployables
        adapter.setNodes([]);
        adapter.setEdges([]);
      } else {
        // Clear everything except title
        adapter.setNodes([]);
        adapter.setEdges([]);
        adapter.setSchemas([]);
        adapter.setDeployables([]);
        adapter.setPortSchemas([]);
        // Flag to prevent re-seeding built-in schemas on reload
        sessionStorage.setItem(SKIP_BUILTIN_SEED_KEY, 'true');
      }
    });
    // No reload needed - Yjs subscription propagates changes automatically
  }, [adapter]);

  return { clearDocument };
}
