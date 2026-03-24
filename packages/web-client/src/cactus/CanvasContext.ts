import { createContext, useContext } from 'react';
import type { Transform } from './useViewport.js';
import type { ConnectionDragState } from './useConnectionDrag.js';

export interface CanvasContextValue {
  /** Current viewport transform { x, y, k } */
  transform: Transform;
  /** Convert screen coordinates to canvas coordinates */
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  /** Start a connection drag from a source handle */
  startConnection: (nodeId: string, handleId: string, clientX: number, clientY: number) => void;
  /** Current connection drag state, or null */
  connectionDrag: ConnectionDragState | null;
  /** Currently selected node IDs */
  selectedIds: string[];
  /** Clear all selection */
  clearSelection: () => void;
  /** Check if a node is selected */
  isSelected: (id: string) => boolean;
  /** Handle node pointer-down with click/shift/ctrl semantics */
  onNodePointerDown: (nodeId: string, event: React.PointerEvent) => void;
  /** Replace selection with given IDs */
  setSelectedIds: (ids: string[]) => void;
  /** Whether Ctrl/Meta key is currently held */
  ctrlHeld: boolean;
}

export const CanvasContext = createContext<CanvasContextValue | null>(null);

export function useCanvasContext(): CanvasContextValue {
  const context = useContext(CanvasContext);
  if (!context) {
    throw new Error('useCanvasContext must be used within a Canvas component');
  }
  return context;
}
