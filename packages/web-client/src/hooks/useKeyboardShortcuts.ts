import { useEffect } from 'react';

interface UseKeyboardShortcutsOptions {
  // State
  selectedNodeIds: string[];
  canPaste: boolean;

  // Actions
  undo: () => void;
  redo: () => void;
  copyNodes: () => void;
  pasteNodes: () => void;
  deleteSelectedNodes: () => void;
  startRename: () => void;
  createOrganizer?: () => void;
  selectAll?: () => void;
}

/**
 * Hook for handling keyboard shortcuts in the map canvas.
 *
 * Shortcuts:
 * - Ctrl+Z: Undo
 * - Ctrl+Y / Ctrl+Shift+Z: Redo
 * - Ctrl+C: Copy selected nodes
 * - Ctrl+V: Paste nodes
 * - Ctrl+G: Organize selected nodes
 * - Ctrl+A: Select all construct nodes on current level
 * - Delete/Backspace: Delete selected nodes
 * - F2: Rename selected node (when single node selected)
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const {
    selectedNodeIds,
    canPaste,
    undo,
    redo,
    copyNodes,
    pasteNodes,
    deleteSelectedNodes,
    startRename,
    createOrganizer,
    selectAll,
  } = options;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Skip if user is typing in an input or textarea
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Undo: Ctrl+Z
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((event.ctrlKey || event.metaKey) && (event.key === 'y' || (event.key === 'z' && event.shiftKey))) {
        event.preventDefault();
        redo();
        return;
      }

      // Copy: Ctrl+C (when nodes selected)
      if ((event.ctrlKey || event.metaKey) && event.key === 'c') {
        if (selectedNodeIds.length > 0) {
          event.preventDefault();
          copyNodes();
        }
        return;
      }

      // Paste: Ctrl+V (when clipboard has content)
      if ((event.ctrlKey || event.metaKey) && event.key === 'v') {
        if (canPaste) {
          event.preventDefault();
          pasteNodes();
        }
        return;
      }

      // Group: Ctrl+G (when multiple nodes selected)
      if ((event.ctrlKey || event.metaKey) && event.key === 'g') {
        if (selectedNodeIds.length >= 2 && createOrganizer) {
          event.preventDefault();
          createOrganizer();
        }
        return;
      }

      // Select All: Ctrl+A
      if ((event.ctrlKey || event.metaKey) && event.key === 'a') {
        if (selectAll) {
          event.preventDefault();
          selectAll();
        }
        return;
      }

      // Shortcuts that require selection
      if (selectedNodeIds.length === 0) return;

      // Delete: Delete or Backspace
      if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault();
        deleteSelectedNodes();
      }
      // Rename: F2 (single selection only)
      else if (event.key === 'F2' && selectedNodeIds.length === 1) {
        event.preventDefault();
        startRename();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeIds, canPaste, undo, redo, copyNodes, pasteNodes, deleteSelectedNodes, startRename, createOrganizer, selectAll]);
}
