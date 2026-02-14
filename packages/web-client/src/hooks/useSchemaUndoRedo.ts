import { useCallback, useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { useDocumentContext } from '../contexts/DocumentContext';

interface UseSchemaUndoRedoReturn {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

/**
 * Undo/redo for schema and schema group changes in the metamap.
 * Tracks the 'schemas' and 'schemaGroups' Y.Maps with 'user' origin.
 */
export function useSchemaUndoRedo(): UseSchemaUndoRedoReturn {
  const { ydoc } = useDocumentContext();

  const undoManagerRef = useRef<Y.UndoManager | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
    const yschemaGroups = ydoc.getMap<Y.Map<unknown>>('schemaGroups');

    const undoManager = new Y.UndoManager([yschemas, yschemaGroups], {
      trackedOrigins: new Set(['user']),
    });

    undoManagerRef.current = undoManager;

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

  const undo = useCallback(() => {
    undoManagerRef.current?.undo();
  }, []);

  const redo = useCallback(() => {
    undoManagerRef.current?.redo();
  }, []);

  return { undo, redo, canUndo, canRedo };
}
