import { useState, useRef, useCallback, useEffect } from 'react';

export interface ConnectionDragState {
  sourceNodeId: string;
  sourceHandle: string;
  /** Start position in canvas coordinates (zoom-invariant anchor) */
  startCanvasX: number;
  startCanvasY: number;
  /** Current cursor position in screen coordinates (updated each frame) */
  currentScreenX: number;
  currentScreenY: number;
}

export interface UseConnectionDragOptions {
  onConnect: (connection: {
    source: string;
    sourceHandle: string;
    target: string;
    targetHandle: string;
  }) => void;
  isValidConnection?: (connection: {
    source: string;
    sourceHandle: string;
    target: string;
    targetHandle: string;
  }) => boolean;
  /** Convert screen coords to canvas coords (for zoom-invariant start anchor) */
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
}

export interface UseConnectionDragResult {
  connectionDrag: ConnectionDragState | null;
  startConnection: (sourceNodeId: string, sourceHandle: string, clientX: number, clientY: number) => void;
}

export function useConnectionDrag({
  onConnect,
  isValidConnection,
  screenToCanvas,
}: UseConnectionDragOptions): UseConnectionDragResult {
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null);
  const onConnectRef = useRef(onConnect);
  const isValidConnectionRef = useRef(isValidConnection);
  const screenToCanvasRef = useRef(screenToCanvas);

  // Keep refs up to date
  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  useEffect(() => {
    isValidConnectionRef.current = isValidConnection;
  }, [isValidConnection]);

  useEffect(() => {
    screenToCanvasRef.current = screenToCanvas;
  }, [screenToCanvas]);

  const startConnection = useCallback(
    (sourceNodeId: string, sourceHandle: string, clientX: number, clientY: number) => {
      const canvasStart = screenToCanvasRef.current(clientX, clientY);
      setConnectionDrag({
        sourceNodeId,
        sourceHandle,
        startCanvasX: canvasStart.x,
        startCanvasY: canvasStart.y,
        currentScreenX: clientX,
        currentScreenY: clientY,
      });

      // RAF-throttled cursor tracking: collect latest position, flush once per frame
      let latestX = clientX;
      let latestY = clientY;
      let rafId = 0;

      const flushPosition = () => {
        rafId = 0;
        setConnectionDrag((prev) => {
          if (!prev) return prev;
          if (prev.currentScreenX === latestX && prev.currentScreenY === latestY) return prev;
          return { ...prev, currentScreenX: latestX, currentScreenY: latestY };
        });
      };

      const handlePointerMove = (e: PointerEvent) => {
        latestX = e.clientX;
        latestY = e.clientY;
        if (!rafId) {
          rafId = requestAnimationFrame(flushPosition);
        }
      };

      const handlePointerUp = (e: PointerEvent) => {
        if (rafId) cancelAnimationFrame(rafId);

        // Hit-test to find a connection target
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        const targetElement = elements.find((el) =>
          el.hasAttribute('data-connection-target')
        ) as HTMLElement | undefined;

        if (targetElement) {
          const targetNodeId = targetElement.getAttribute('data-node-id');
          const targetHandleId = targetElement.getAttribute('data-handle-id');

          if (targetNodeId && targetHandleId) {
            const connection = {
              source: sourceNodeId,
              sourceHandle,
              target: targetNodeId,
              targetHandle: targetHandleId,
            };

            // Validate connection if validator provided
            const isValid = isValidConnectionRef.current
              ? isValidConnectionRef.current(connection)
              : true;

            if (isValid) {
              onConnectRef.current(connection);
            }
          }
        }

        // Clean up
        setConnectionDrag(null);
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    },
    []
  );

  return {
    connectionDrag,
    startConnection,
  };
}
