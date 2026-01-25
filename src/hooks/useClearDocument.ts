import { useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';

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
        adapter.setSchemaGroups([]);
      }
    });
    // No reload needed - Yjs subscription propagates changes automatically
  }, [adapter]);

  return { clearDocument };
}
