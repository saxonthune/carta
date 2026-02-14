import React, { useState, useEffect, useImperativeHandle, forwardRef, useMemo } from 'react';
import { useViewport, type UseViewportOptions, type Transform } from './useViewport.js';
import { useConnectionDrag, type ConnectionDragState } from './useConnectionDrag.js';
import { useBoxSelect } from './useBoxSelect.js';
import { useSelection } from './useSelection.js';
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
  /** Pattern ID for DotGrid SVG pattern (avoids collisions when multiple canvases exist) */
  patternId?: string;
  /** Pointer down on the canvas background (not on a data-no-pan element). Useful for clearing selection. */
  onBackgroundPointerDown?: (event: React.PointerEvent) => void;
  /** Custom background renderer. Receives transform. If not provided, renders DotGrid. */
  renderBackground?: (transform: Transform, patternId?: string) => React.ReactNode;
}

export interface CanvasRef {
  fitView: (rects: Array<{ x: number; y: number; width: number; height: number }>, padding?: number) => void;
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  getTransform: () => Transform;
  zoomIn: () => void;
  zoomOut: () => void;
  clearSelection: () => void;
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
    patternId,
    onBackgroundPointerDown,
    renderBackground,
  },
  ref
) {
  // 1. Setup viewport
  const { transform, containerRef, fitView, screenToCanvas, zoomIn, zoomOut } = useViewport(viewportOptions);

  // 2. Setup connection drag (if enabled)
  const connectionDragResult = useConnectionDrag(
    connectionDrag || {
      onConnect: () => {},
    }
  );
  const { connectionDrag: connectionDragState, startConnection } = connectionDragResult;

  // 3. Setup box select (if enabled) — delegate state to useSelection
  // 3b. Setup unified selection (always on)
  const selection = useSelection({});
  const { selectedIds, clearSelection, isSelected, onNodePointerDown, setSelectedIds } = selection;

  const boxSelectResult = useBoxSelect(
    boxSelect
      ? {
          transform,
          containerRef,
          getNodeRects: boxSelect.getNodeRects,
          onBoxSelectHits: selection.mergeBoxSelection,
        }
      : {
          transform,
          containerRef,
          getNodeRects: () => [],
        }
  );
  const { selectionRect } = boxSelectResult;
  // NOTE: selectedIds and clearSelection now come from useSelection, NOT from boxSelectResult

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
      zoomIn,
      zoomOut,
      clearSelection,
    }),
    [fitView, screenToCanvas, transform, zoomIn, zoomOut, clearSelection]
  );

  // 6. Setup context value
  const contextValue: CanvasContextValue = useMemo(
    () => ({
      transform,
      screenToCanvas,
      startConnection: connectionDrag ? startConnection : () => {},
      connectionDrag: connectionDrag ? connectionDragState : null,
      selectedIds,
      clearSelection,
      isSelected,
      onNodePointerDown,
      setSelectedIds,
      ctrlHeld,
    }),
    [
      transform,
      screenToCanvas,
      connectionDrag,
      startConnection,
      connectionDragState,
      selectedIds,
      clearSelection,
      isSelected,
      onNodePointerDown,
      setSelectedIds,
      ctrlHeld,
    ]
  );

  // 7. Render DOM skeleton
  return (
    <CanvasContext.Provider value={contextValue}>
      <div
        ref={containerRef}
        className={className}
        style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden', userSelect: 'none' }}
        onPointerDown={(e) => {
          if (onBackgroundPointerDown) {
            const target = e.target as HTMLElement;
            if (!target.closest?.('[data-no-pan]')) {
              onBackgroundPointerDown(e);
            }
          }
        }}
      >
        {/* Background grid */}
        {renderBackground ? renderBackground(transform, patternId) : <DotGrid transform={transform} patternId={patternId} />}

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
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
              {renderEdges(transform)}
            </g>
          </svg>
        )}

        {/* Connection preview — container-local coords */}
        {connectionDragState && renderConnectionPreview && (
          <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            {(() => {
              // Convert viewport coords to container-local coords
              const rect = containerRef.current?.getBoundingClientRect();
              const localDrag: ConnectionDragState = {
                ...connectionDragState,
                currentX: connectionDragState.currentX - (rect?.left ?? 0),
                currentY: connectionDragState.currentY - (rect?.top ?? 0),
              };
              return renderConnectionPreview(localDrag, transform);
            })()}
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
