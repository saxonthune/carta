import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { useDocumentContext } from '../contexts/DocumentContext';

interface UseUndoRedoReturn {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** @deprecated No-op with Yjs - snapshots are automatic via transactions */
  takeSnapshot: () => void;
}

/**
 * Hook for managing undo/redo functionality using Y.UndoManager.
 *
 * Uses Y.UndoManager to track changes with 'user' origin.
 * Each user has their own local undo stack (not shared).
 * MCP changes with 'ai-mcp' origin won't be tracked.
 *
 * Usage:
 * - Use undo() and redo() to navigate history
 * - Use canUndo/canRedo to enable/disable UI buttons
 * - No manual snapshot needed - changes are tracked automatically via Yjs transactions
 */
export function useUndoRedo(): UseUndoRedoReturn {
  const { ydoc } = useDocumentContext();

  // Yjs UndoManager state
  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Set up Y.UndoManager
  useEffect(() => {
    const ynodes = ydoc.getMap('nodes');
    const yedges = ydoc.getMap('edges');

    // Create UndoManager that tracks 'user' origin changes
    // MCP changes with 'ai-mcp' origin won't be tracked
    const undoManager = new Y.UndoManager([ynodes, yedges], {
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
  }, [ydoc]);

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

  /**
   * No-op with Yjs - snapshots are automatic via transactions.
   * Kept for backwards compatibility with existing code.
   * @deprecated
   */
  const takeSnapshot = useCallback(() => {
    // Yjs handles snapshots automatically via transactions with 'user' origin
  }, []);

  return {
    undo,
    redo,
    canUndo,
    canRedo,
    takeSnapshot,
  };
}

export default useUndoRedo;
