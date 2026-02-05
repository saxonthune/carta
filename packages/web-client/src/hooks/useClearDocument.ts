import { useCallback } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';

export function useClearDocument() {
  const { adapter } = useDocumentContext();

  const clearDocument = useCallback((mode: 'instances' | 'all') => {
    adapter.transaction(() => {
      if (mode === 'instances') {
        // Clear only nodes and edges on active level, preserve schemas and deployables
        adapter.setNodes([]);
        adapter.setEdges([]);
      } else {
        // Clear everything: all levels' data, schemas, etc.
        // Delete all levels except keep one
        const levels = adapter.getLevels();
        for (const level of levels) {
          // Switch to each level and clear it
          adapter.setActiveLevel(level.id);
          adapter.setNodes([]);
          adapter.setEdges([]);
        }
        // Delete all but first level, then recreate as "Main"
        if (levels.length > 1) {
          const firstLevel = levels[0];
          for (let i = 1; i < levels.length; i++) {
            adapter.deleteLevel(levels[i].id);
          }
          adapter.updateLevel(firstLevel.id, { name: 'Main' });
          adapter.setActiveLevel(firstLevel.id);
        } else if (levels.length === 1) {
          adapter.updateLevel(levels[0].id, { name: 'Main' });
          adapter.setActiveLevel(levels[0].id);
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
