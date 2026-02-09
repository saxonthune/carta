import { useState, useEffect, useCallback } from 'react';
import { useStore, useReactFlow } from '@xyflow/react';

export interface ZoomDebugProps {
  /** Additional debug lines to display below zoom */
  debugLines?: string[];
  /** Position: 'top-left' or 'bottom-left' */
  position?: 'top-left' | 'bottom-left';
}

/**
 * Debug overlay showing current zoom level with click-to-edit functionality.
 * Used in both Map and Metamap views during development.
 */
export function ZoomDebug({ debugLines, position = 'bottom-left' }: ZoomDebugProps) {
  const zoom = useStore((state) => state.transform[2]);
  const { getViewport, setViewport, screenToFlowPosition } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    const flowPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    setMousePos({ x: Math.round(flowPos.x), y: Math.round(flowPos.y) });
  }, [screenToFlowPosition]);

  const handleMouseLeave = useCallback(() => setMousePos(null), []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [handleMouseMove, handleMouseLeave]);

  const commitZoom = () => {
    setEditing(false);
    const parsed = parseFloat(inputValue);
    if (isNaN(parsed)) return;
    const clamped = Math.min(Math.max(parsed, 0.15), 2);
    const { x, y } = getViewport();
    setViewport({ x, y, zoom: clamped }, { duration: 200 });
  };

  const positionClass = position === 'top-left'
    ? 'top-3 left-3'
    : 'bottom-8 left-2';

  return (
    <div className={`absolute ${positionClass} bg-black/80 text-white px-3 py-2 rounded text-xs font-mono z-50`}>
      <div className="flex items-center gap-1">
        <span>Zoom:</span>
        {editing ? (
          <input
            autoFocus
            className="w-14 bg-transparent border-b border-white/50 text-white text-xs font-mono outline-none"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onBlur={commitZoom}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitZoom();
              if (e.key === 'Escape') setEditing(false);
            }}
          />
        ) : (
          <span
            className="cursor-pointer border-b border-transparent hover:border-white/50"
            onClick={() => {
              setInputValue(zoom.toFixed(3));
              setEditing(true);
            }}
          >
            {zoom.toFixed(3)}
          </span>
        )}
      </div>
      {mousePos && (
        <div>Cursor: {mousePos.x}, {mousePos.y}</div>
      )}
      {debugLines?.map((line, i) => (
        <div key={i}>{line}</div>
      ))}
    </div>
  );
}
