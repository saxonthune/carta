import { useState, useCallback } from 'react';
import type { CartaNode, CartaEdge } from '@carta/types';
import type { ConstructSchema } from '@carta/schema';

export interface ContextMenuState {
  x: number;
  y: number;
  type: 'pane' | 'node' | 'edge';
  nodeId?: string;
  edgeId?: string;
}

export interface AddMenuState {
  x: number;
  y: number;
}

export interface EditorState {
  open: boolean;
  editSchema?: ConstructSchema;
}

export function useMapState() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [addMenu, setAddMenu] = useState<AddMenuState | null>(null);
  const [editorState, setEditorState] = useState<EditorState>({ open: false });
  const [debugNodeId, setDebugNodeId] = useState<string | null>(null);
  const [mouseDownPos, setMouseDownPos] = useState<{ x: number; y: number } | null>(null);

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();

      // Only show context menu if mouse hasn't moved significantly
      // If mouseDownPos is null, show menu anyway (event timing edge case)
      let shouldShowMenu = true;

      if (mouseDownPos) {
        const dx = Math.abs(event.clientX - mouseDownPos.x);
        const dy = Math.abs(event.clientY - mouseDownPos.y);
        const threshold = 5; // pixels

        if (dx >= threshold || dy >= threshold) {
          shouldShowMenu = false;
        }
      }

      if (shouldShowMenu) {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          type: 'pane',
        });
      }

      setMouseDownPos(null);
    },
    [mouseDownPos]
  );

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: CartaNode) => {
      event.preventDefault();

      // Only show context menu if mouse hasn't moved significantly
      // If mouseDownPos is null, show menu anyway (event timing edge case)
      let shouldShowMenu = true;

      if (mouseDownPos) {
        const dx = Math.abs(event.clientX - mouseDownPos.x);
        const dy = Math.abs(event.clientY - mouseDownPos.y);
        const threshold = 5; // pixels

        if (dx >= threshold || dy >= threshold) {
          shouldShowMenu = false;
        }
      }

      if (shouldShowMenu) {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          type: 'node',
          nodeId: node.id,
        });
      }

      setMouseDownPos(null);
    },
    [mouseDownPos]
  );

  const onSelectionContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        type: 'node',
      });
    },
    []
  );

  const onEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: CartaEdge) => {
      event.preventDefault();

      // Only show context menu if mouse hasn't moved significantly
      // If mouseDownPos is null, show menu anyway (event timing edge case)
      let shouldShowMenu = true;

      if (mouseDownPos) {
        const dx = Math.abs(event.clientX - mouseDownPos.x);
        const dy = Math.abs(event.clientY - mouseDownPos.y);
        const threshold = 5; // pixels

        if (dx >= threshold || dy >= threshold) {
          shouldShowMenu = false;
        }
      }

      if (shouldShowMenu) {
        setContextMenu({
          x: event.clientX,
          y: event.clientY,
          type: 'edge',
          edgeId: edge.id,
        });
      }

      setMouseDownPos(null);
    },
    [mouseDownPos]
  );

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    // Track mouse position on right-click
    if (event.button === 2) {
      setMouseDownPos({ x: event.clientX, y: event.clientY });
    }
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setContextMenu(null);
    setAddMenu(null);
  }, []);

  return {
    // State
    contextMenu,
    addMenu,
    editorState,
    debugNodeId,
    // Setters
    setContextMenu,
    setAddMenu,
    setEditorState,
    setDebugNodeId,
    // Handlers
    onPaneContextMenu,
    onNodeContextMenu,
    onSelectionContextMenu,
    onEdgeContextMenu,
    onMouseDown,
    closeContextMenu,
    onPaneClick,
  };
}
