import { useState, useRef, useCallback, useEffect } from 'react';

export interface ConnectionDragState {
  sourceNodeId: string;
  sourceHandle: string;
  // Current cursor position in screen coords (for preview line)
  currentX: number;
  currentY: number;
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
}

export interface UseConnectionDragResult {
  connectionDrag: ConnectionDragState | null;
  startConnection: (sourceNodeId: string, sourceHandle: string, event: React.PointerEvent) => void;
}

export function useConnectionDrag({
  onConnect,
  isValidConnection,
}: UseConnectionDragOptions): UseConnectionDragResult {
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDragState | null>(null);
  const onConnectRef = useRef(onConnect);
  const isValidConnectionRef = useRef(isValidConnection);

  // Keep refs up to date
  useEffect(() => {
    onConnectRef.current = onConnect;
  }, [onConnect]);

  useEffect(() => {
    isValidConnectionRef.current = isValidConnection;
  }, [isValidConnection]);

  const startConnection = useCallback(
    (sourceNodeId: string, sourceHandle: string, event: React.PointerEvent) => {
      setConnectionDrag({
        sourceNodeId,
        sourceHandle,
        currentX: event.clientX,
        currentY: event.clientY,
      });

      const handlePointerMove = (e: PointerEvent) => {
        setConnectionDrag((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currentX: e.clientX,
            currentY: e.clientY,
          };
        });
      };

      const handlePointerUp = (e: PointerEvent) => {
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
