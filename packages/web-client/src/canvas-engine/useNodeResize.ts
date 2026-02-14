import { useState, useRef, useCallback, useEffect } from 'react';

export interface ResizeDirection {
  horizontal: 'left' | 'right' | 'none';
  vertical: 'top' | 'bottom' | 'none';
}

export interface NodeResizeCallbacks {
  onResizeStart?: (nodeId: string, direction: ResizeDirection) => void;
  onResize?: (nodeId: string, deltaWidth: number, deltaHeight: number, direction: ResizeDirection) => void;
  onResizeEnd?: (nodeId: string) => void;
}

export interface UseNodeResizeOptions {
  zoomScale: number;
  callbacks: NodeResizeCallbacks;
}

export interface UseNodeResizeResult {
  resizingNodeId: string | null;
  onResizePointerDown: (nodeId: string, direction: ResizeDirection, event: React.PointerEvent) => void;
}

export function useNodeResize(options: UseNodeResizeOptions): UseNodeResizeResult {
  const [resizingNodeId, setResizingNodeId] = useState<string | null>(null);
  const zoomScaleRef = useRef(options.zoomScale);
  const callbacksRef = useRef(options.callbacks);
  const resizeStartRef = useRef<{ x: number; y: number; direction: ResizeDirection } | null>(null);

  // Keep refs up to date
  useEffect(() => {
    zoomScaleRef.current = options.zoomScale;
  }, [options.zoomScale]);

  useEffect(() => {
    callbacksRef.current = options.callbacks;
  }, [options.callbacks]);

  const onResizePointerDown = useCallback(
    (nodeId: string, direction: ResizeDirection, event: React.PointerEvent) => {
      event.stopPropagation();

      // Record resize start position and direction
      resizeStartRef.current = {
        x: event.clientX,
        y: event.clientY,
        direction,
      };

      setResizingNodeId(nodeId);
      callbacksRef.current.onResizeStart?.(nodeId, direction);

      const handlePointerMove = (e: PointerEvent) => {
        const start = resizeStartRef.current;
        if (!start) return;

        const k = zoomScaleRef.current;
        const dx = (e.clientX - start.x) / k;
        const dy = (e.clientY - start.y) / k;

        // Apply direction signs
        let deltaWidth = 0;
        let deltaHeight = 0;

        if (start.direction.horizontal === 'right') {
          deltaWidth = dx;
        } else if (start.direction.horizontal === 'left') {
          deltaWidth = -dx;
        }

        if (start.direction.vertical === 'bottom') {
          deltaHeight = dy;
        } else if (start.direction.vertical === 'top') {
          deltaHeight = -dy;
        }

        callbacksRef.current.onResize?.(nodeId, deltaWidth, deltaHeight, start.direction);
      };

      const handlePointerUp = () => {
        callbacksRef.current.onResizeEnd?.(nodeId);
        setResizingNodeId(null);
        resizeStartRef.current = null;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    []
  );

  return {
    resizingNodeId,
    onResizePointerDown,
  };
}
