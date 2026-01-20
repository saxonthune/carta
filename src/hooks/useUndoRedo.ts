import { useCallback, useState } from 'react';
import { useReactFlow, type Node, type Edge } from '@xyflow/react';

interface HistoryState {
  nodes: Node[];
  edges: Edge[];
}

interface UseUndoRedoOptions {
  maxHistorySize?: number;
}

interface UseUndoRedoReturn {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  takeSnapshot: () => void;
}

/**
 * Hook for managing undo/redo functionality in React Flow
 * 
 * Usage:
 * 1. Call takeSnapshot() before any undoable operation
 * 2. Use undo() and redo() to navigate history
 * 3. Use canUndo/canRedo to enable/disable UI buttons
 */
export function useUndoRedo(options: UseUndoRedoOptions = {}): UseUndoRedoReturn {
  const { maxHistorySize = 100 } = options;
  const { getNodes, getEdges, setNodes, setEdges } = useReactFlow();

  const [past, setPast] = useState<HistoryState[]>([]);
  const [future, setFuture] = useState<HistoryState[]>([]);

  /**
   * Take a snapshot of the current state before making changes
   */
  const takeSnapshot = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();

    setPast((prevPast) => {
      const newPast = [...prevPast, { nodes, edges }];
      // Limit history size
      if (newPast.length > maxHistorySize) {
        newPast.shift();
      }
      return newPast;
    });

    // Clear future when new action is taken
    setFuture([]);
  }, [getNodes, getEdges, maxHistorySize]);

  /**
   * Undo the last action
   */
  const undo = useCallback(() => {
    if (past.length === 0) return;

    const currentNodes = getNodes();
    const currentEdges = getEdges();

    // Get the previous state
    const previous = past[past.length - 1];

    // Move current state to future
    setFuture((prevFuture) => [
      ...prevFuture,
      { nodes: currentNodes, edges: currentEdges },
    ]);

    // Remove from past
    setPast((prevPast) => prevPast.slice(0, -1));

    // Restore the previous state
    setNodes(previous.nodes);
    setEdges(previous.edges);
  }, [past, getNodes, getEdges, setNodes, setEdges]);

  /**
   * Redo the last undone action
   */
  const redo = useCallback(() => {
    if (future.length === 0) return;

    const currentNodes = getNodes();
    const currentEdges = getEdges();

    // Get the next state
    const next = future[future.length - 1];

    // Move current state to past
    setPast((prevPast) => [
      ...prevPast,
      { nodes: currentNodes, edges: currentEdges },
    ]);

    // Remove from future
    setFuture((prevFuture) => prevFuture.slice(0, -1));

    // Restore the next state
    setNodes(next.nodes);
    setEdges(next.edges);
  }, [future, getNodes, getEdges, setNodes, setEdges]);

  return {
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    takeSnapshot,
  };
}

export default useUndoRedo;
