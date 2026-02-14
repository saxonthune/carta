import { useState, useRef, useCallback, useEffect } from 'react';
import type { Transform } from './useViewport.js';

export interface NodeRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UseBoxSelectOptions {
  /** Current viewport transform — needed to convert screen drag to canvas coords */
  transform: Transform;
  /** Container element ref — box select listens for pointer events here */
  containerRef: React.RefObject<HTMLElement>;
  /** Returns current node rects in canvas coordinates for hit-testing */
  getNodeRects: () => NodeRect[];
  /** Called when selection changes */
  onSelectionChange?: (selectedIds: string[]) => void;
}

export interface UseBoxSelectResult {
  /** Currently selected node IDs */
  selectedIds: string[];
  /** Clear selection programmatically */
  clearSelection: () => void;
  /** The selection rectangle in screen coordinates, or null if not dragging */
  selectionRect: { x: number; y: number; width: number; height: number } | null;
}

export function useBoxSelect({
  transform,
  containerRef,
  getNodeRects,
  onSelectionChange,
}: UseBoxSelectOptions): UseBoxSelectResult {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionRect, setSelectionRect] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  const transformRef = useRef(transform);
  transformRef.current = transform;
  const getNodeRectsRef = useRef(getNodeRects);
  getNodeRectsRef.current = getNodeRects;
  const onSelectionChangeRef = useRef(onSelectionChange);
  onSelectionChangeRef.current = onSelectionChange;

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
    onSelectionChangeRef.current?.([]);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handlePointerDown = (e: PointerEvent) => {
      // Only initiate box select on Shift+click on the background
      if (!e.shiftKey) return;

      // Don't initiate on interactive elements
      const target = e.target as HTMLElement;
      if (target.closest?.('[data-no-pan]')) return;

      e.preventDefault();
      e.stopPropagation();

      const startX = e.clientX;
      const startY = e.clientY;

      const handlePointerMove = (moveEvent: PointerEvent) => {
        const currentX = moveEvent.clientX;
        const currentY = moveEvent.clientY;

        // Selection rect in screen coords
        const rect = {
          x: Math.min(startX, currentX),
          y: Math.min(startY, currentY),
          width: Math.abs(currentX - startX),
          height: Math.abs(currentY - startY),
        };
        setSelectionRect(rect);

        // Convert screen rect to canvas coords for hit-testing
        const t = transformRef.current;
        const containerRect = container.getBoundingClientRect();
        const canvasRect = {
          x: (rect.x - containerRect.left - t.x) / t.k,
          y: (rect.y - containerRect.top - t.y) / t.k,
          width: rect.width / t.k,
          height: rect.height / t.k,
        };

        // Hit-test: select nodes whose rects intersect the selection rect
        const nodeRects = getNodeRectsRef.current();
        const hits = nodeRects
          .filter((nr) => rectsIntersect(canvasRect, nr))
          .map((nr) => nr.id);

        setSelectedIds(hits);
        onSelectionChangeRef.current?.(hits);
      };

      const handlePointerUp = () => {
        setSelectionRect(null);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    };

    container.addEventListener('pointerdown', handlePointerDown);
    return () => container.removeEventListener('pointerdown', handlePointerDown);
  }, [containerRef]);

  return { selectedIds, clearSelection, selectionRect };
}

function rectsIntersect(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number }
): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}
