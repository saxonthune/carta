import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { useViewport, type UseViewportOptions, type Transform } from './useViewport.js';
import { useConnectionDrag, type ConnectionDragState } from './useConnectionDrag.js';
import { useBoxSelect } from './useBoxSelect.js';
import { DotGrid } from './DotGrid.js';
import { CanvasContext, type CanvasContextValue } from './CanvasContext.js';

export interface CanvasProps {
  /** Viewport options */
  viewportOptions?: UseViewportOptions;
  /** Connection drag callbacks */
  connectionDrag?: {
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
  };
  /** Box select config — if provided, box select is enabled */
  boxSelect?: {
    getNodeRects: () => Array<{ id: string; x: number; y: number; width: number; height: number }>;
  };
  /** Render the SVG edge layer. Receives transform for the <g> group. */
  renderEdges?: (transform: Transform) => React.ReactNode;
  /** Render the connection preview line during connection drag. Receives drag state. */
  renderConnectionPreview?: (drag: ConnectionDragState, transform: Transform) => React.ReactNode;
  /** CSS class for the container */
  className?: string;
  /** Child nodes rendered inside the transformed div */
  children: React.ReactNode;
}

export interface CanvasRef {
  fitView: (rects: Array<{ x: number; y: number; width: number; height: number }>, padding?: number) => void;
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  getTransform: () => Transform;
}

export const Canvas = forwardRef<CanvasRef, CanvasProps>(function Canvas(
  {
    viewportOptions,
    connectionDrag,
    boxSelect,
    renderEdges,
    renderConnectionPreview,
    className,
    children,
  },
  ref
) {
  // 1. Setup viewport
  const { transform, containerRef, fitView, screenToCanvas } = useViewport(viewportOptions);

  // 2. Setup connection drag (if enabled)
  const connectionDragResult = useConnectionDrag(
    connectionDrag || {
      onConnect: () => {},
    }
  );
  const { connectionDrag: connectionDragState, startConnection } = connectionDragResult;

  // 3. Setup box select (if enabled)
  const boxSelectResult = useBoxSelect(
    boxSelect
      ? {
          transform,
          containerRef,
          getNodeRects: boxSelect.getNodeRects,
        }
      : {
          transform,
          containerRef,
          getNodeRects: () => [],
        }
  );
  const { selectedIds, clearSelection, selectionRect } = boxSelectResult;

  // 4. Track Ctrl/Meta key state
  const [ctrlHeld, setCtrlHeld] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setCtrlHeld(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setCtrlHeld(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // 5. Expose imperative methods
  useImperativeHandle(
    ref,
    () => ({
      fitView,
      screenToCanvas,
      getTransform: () => transform,
    }),
    [fitView, screenToCanvas, transform]
  );

  // 6. Setup context value
  const contextValue: CanvasContextValue = useMemo(
    () => ({
      transform,
      screenToCanvas,
      startConnection: connectionDrag ? startConnection : () => {},
      connectionDrag: connectionDrag ? connectionDragState : null,
      selectedIds: boxSelect ? selectedIds : [],
      clearSelection: boxSelect ? clearSelection : () => {},
      ctrlHeld,
    }),
    [
      transform,
      screenToCanvas,
      connectionDrag,
      startConnection,
      connectionDragState,
      boxSelect,
      selectedIds,
      clearSelection,
      ctrlHeld,
    ]
  );

  // 7. Render DOM skeleton
  return (
    <CanvasContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={className}
        style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
      >
        {/* Background grid */}
        <DotGrid transform={transform} />

        {/* Node layer — transformed */}
        <div
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
            transformOrigin: '0 0',
            position: 'absolute',
            inset: 0,
          }}
        >
          {children}
        </div>

        {/* Edge layer — SVG with same transform */}
        {renderEdges && (
          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
              {renderEdges(transform)}
            </g>
          </svg>
        )}

        {/* Connection preview — screen coords */}
        {connectionDragState && renderConnectionPreview && (
          <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {renderConnectionPreview(connectionDragState, transform)}
          </svg>
        )}

        {/* Box select overlay */}
        {selectionRect && (
          <div
            style={{
              position: 'absolute',
              left: selectionRect.x,
              top: selectionRect.y,
              width: selectionRect.width,
              height: selectionRect.height,
              border: '1px solid var(--color-accent)',
              backgroundColor: 'var(--color-accent-10)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    </CanvasContext.Provider>
  );
});
