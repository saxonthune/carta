import { useState, useRef, useCallback, useEffect } from 'react';

export interface NodeDragCallbacks {
  onDragStart?: (nodeId: string, event: PointerEvent) => void;
  onDrag?: (nodeId: string, deltaX: number, deltaY: number) => void;
  onDragEnd?: (nodeId: string) => void;
}

export interface UseNodeDragOptions {
  /** Current zoom scale — needed to convert screen deltas to canvas deltas */
  zoomScale: number;
  /** CSS selector for the drag handle within each node. If omitted, entire node is draggable. */
  handleSelector?: string;
  callbacks: NodeDragCallbacks;
}

export interface UseNodeDragResult {
  /** Currently dragging node ID, or null */
  draggingNodeId: string | null;
  /** Attach to each node's onPointerDown */
  onPointerDown: (nodeId: string, event: React.PointerEvent) => void;
}

export function useNodeDrag(options: UseNodeDragOptions): UseNodeDragResult {
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const zoomScaleRef = useRef(options.zoomScale);
  const callbacksRef = useRef(options.callbacks);
  const handleSelectorRef = useRef(options.handleSelector);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  // Keep refs up to date
  useEffect(() => {
    zoomScaleRef.current = options.zoomScale;
  }, [options.zoomScale]);

  useEffect(() => {
    callbacksRef.current = options.callbacks;
  }, [options.callbacks]);

  useEffect(() => {
    handleSelectorRef.current = options.handleSelector;
  }, [options.handleSelector]);

  const onPointerDown = useCallback(
    (nodeId: string, event: React.PointerEvent) => {
      // Only respond to primary (left) mouse button — middle/right should pass through to pan
      if (event.button !== 0) return;

      // If handleSelector is set, check if event target is inside the handle
      if (handleSelectorRef.current) {
        const target = event.target as HTMLElement;
        if (!target.closest(handleSelectorRef.current)) return;
      }

      event.stopPropagation();

      // Record drag start position
      dragStartRef.current = {
        x: event.clientX,
        y: event.clientY,
      };

      setDraggingNodeId(nodeId);
      callbacksRef.current.onDragStart?.(nodeId, event.nativeEvent);

      const handlePointerMove = (e: PointerEvent) => {
        const start = dragStartRef.current;
        if (!start) return;

        const k = zoomScaleRef.current;
        const cumulativeX = (e.clientX - start.x) / k;
        const cumulativeY = (e.clientY - start.y) / k;
        callbacksRef.current.onDrag?.(nodeId, cumulativeX, cumulativeY);
      };

      const handlePointerUp = () => {
        callbacksRef.current.onDragEnd?.(nodeId);
        setDraggingNodeId(null);
        dragStartRef.current = null;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    []
  );

  return {
    draggingNodeId,
    onPointerDown,
  };
}
