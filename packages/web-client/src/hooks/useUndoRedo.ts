import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { useDocumentContext } from '../contexts/DocumentContext';

interface UseUndoRedoReturn {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Hook for managing undo/redo functionality using Y.UndoManager.
 *
 * Uses Y.UndoManager to track changes with 'user' origin.
 * Each user has their own local undo stack (not shared).
 * MCP changes with 'ai-mcp' origin won't be tracked.
 *
 * Per-page: The UndoManager is re-created when the active page changes,
 * tracking only the active page's node and edge maps. Undo history is
 * lost when switching pages (acceptable since undo is local anyway).
 */
export function useUndoRedo(): UseUndoRedoReturn {
  const { ydoc, adapter } = useDocumentContext();

  // Yjs UndoManager state
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Get the active page ID from adapter
  const activePage = adapter.getActivePage();

  // Set up Y.UndoManager per-page
  useEffect(() => {
    const activePageId = activePage;
    if (!activePageId) return;

    // Get the active page's Y.Maps
    const ynodesContainer = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yedgesContainer = ydoc.getMap<Y.Map<unknown>>('edges');

    let pageNodes = ynodesContainer.get(activePageId) as Y.Map<unknown> | undefined;
    if (!pageNodes) {
      pageNodes = new Y.Map<unknown>();
      ynodesContainer.set(activePageId, pageNodes);
    }

    let pageEdges = yedgesContainer.get(activePageId) as Y.Map<unknown> | undefined;
    if (!pageEdges) {
      pageEdges = new Y.Map<unknown>();
      yedgesContainer.set(activePageId, pageEdges);
    }

    // Create UndoManager that tracks 'user' origin changes for this page
    const undoManager = new Y.UndoManager([pageNodes, pageEdges], {
      trackedOrigins: new Set(['user']),
    });

    undoManagerRef.current = undoManager;

    // Update canUndo/canRedo state
    const updateState = () => {
      setCanUndo(undoManager.canUndo());
      setCanRedo(undoManager.canRedo());
    };

    undoManager.on('stack-item-added', updateState);
    undoManager.on('stack-item-popped', updateState);
    undoManager.on('stack-cleared', updateState);

    updateState();

    return () => {
      undoManager.destroy();
      undoManagerRef.current = null;
    };
  }, [ydoc, activePage]);

  /**
   * Undo the last action
   */
  const undo = useCallback(() => {
    undoManagerRef.current?.undo();
  }, []);

  /**
   * Redo the last undone action
   */
  const redo = useCallback(() => {
    undoManagerRef.current?.redo();
  }, []);

  return {
    undo,
    redo,
    canUndo,
    canRedo,
  };
}

export default useUndoRedo;
