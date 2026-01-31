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
 * Per-level: The UndoManager is re-created when the active level changes,
 * tracking only the active level's node and edge maps. Undo history is
 * lost when switching levels (acceptable since undo is local anyway).
 */
export function useUndoRedo(): UseUndoRedoReturn {
  const { ydoc, adapter } = useDocumentContext();

  // Yjs UndoManager state
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Get the active level ID from adapter
  const activeLevel = adapter.getActiveLevel();

  // Set up Y.UndoManager per-level
  useEffect(() => {
    const activeLevelId = activeLevel;
    if (!activeLevelId) return;

    // Get the active level's Y.Maps
    const ynodesContainer = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yedgesContainer = ydoc.getMap<Y.Map<unknown>>('edges');

    let levelNodes = ynodesContainer.get(activeLevelId) as Y.Map<unknown> | undefined;
    if (!levelNodes) {
      // Create if doesn't exist yet
      levelNodes = new Y.Map<unknown>();
      ynodesContainer.set(activeLevelId, levelNodes);
    }

    let levelEdges = yedgesContainer.get(activeLevelId) as Y.Map<unknown> | undefined;
    if (!levelEdges) {
      levelEdges = new Y.Map<unknown>();
      yedgesContainer.set(activeLevelId, levelEdges);
    }

    // Create UndoManager that tracks 'user' origin changes for this level
    const undoManager = new Y.UndoManager([levelNodes, levelEdges], {
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
  }, [ydoc, activeLevel]);

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
