import { useState, useRef, useEffect } from 'react';
import { zoom as d3Zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import { select } from 'd3-selection';
import 'd3-transition';

export interface Transform {
  x: number;
  y: number;
  k: number;
}

export interface UseViewportOptions {
  minZoom?: number; // default 0.15
  maxZoom?: number; // default 2
}

export interface UseViewportResult {
  transform: Transform;
  containerRef: React.RefObject<HTMLDivElement>;
  fitView: (
    rects: Array<{ x: number; y: number; width: number; height: number }>,
    padding?: number
  ) => void;
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
}

export function useViewport(options: UseViewportOptions = {}): UseViewportResult {
  const { minZoom = 0.15, maxZoom = 2 } = options;

  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown> | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const zoomBehavior = d3Zoom<HTMLDivElement, unknown>()
      .scaleExtent([minZoom, maxZoom])
      .filter((event) => {
        // Allow wheel events always for zoom
        if (event.type === 'wheel') return true;
        // Allow mousedown on all buttons for pan
        if (event.type === 'mousedown') return true;
        // Allow touchstart for mobile
        if (event.type === 'touchstart') return true;
        return false;
      })
      .on('zoom', (event) => {
        setTransform({
          x: event.transform.x,
          y: event.transform.y,
          k: event.transform.k,
        });
      });

    zoomRef.current = zoomBehavior;
    select(container).call(zoomBehavior);

    return () => {
      select(container).on('.zoom', null);
    };
  }, [minZoom, maxZoom]);

  const fitView = (
    rects: Array<{ x: number; y: number; width: number; height: number }>,
    padding = 0.1
  ) => {
    if (!containerRef.current || !zoomRef.current || rects.length === 0) return;

    // Compute bounding box of all rects
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const rect of rects) {
      minX = Math.min(minX, rect.x);
      minY = Math.min(minY, rect.y);
      maxX = Math.max(maxX, rect.x + rect.width);
      maxY = Math.max(maxY, rect.y + rect.height);
    }

    const bboxWidth = maxX - minX;
    const bboxHeight = maxY - minY;
    const containerRect = containerRef.current.getBoundingClientRect();

    // Calculate scale to fit with padding
    const availableWidth = containerRect.width * (1 - padding * 2);
    const availableHeight = containerRect.height * (1 - padding * 2);

    const scaleX = availableWidth / bboxWidth;
    const scaleY = availableHeight / bboxHeight;
    const scale = Math.min(scaleX, scaleY, maxZoom);

    // Center the bbox
    const scaledWidth = bboxWidth * scale;
    const scaledHeight = bboxHeight * scale;

    const tx = (containerRect.width - scaledWidth) / 2 - minX * scale;
    const ty = (containerRect.height - scaledHeight) / 2 - minY * scale;

    const newTransform = zoomIdentity.translate(tx, ty).scale(scale);

    select(containerRef.current)
      .transition()
      .duration(300)
      .call(zoomRef.current.transform, newTransform);
  };

  const screenToCanvas = (screenX: number, screenY: number): { x: number; y: number } => {
    if (!containerRef.current) return { x: screenX, y: screenY };

    const rect = containerRef.current.getBoundingClientRect();
    const x = (screenX - rect.left - transform.x) / transform.k;
    const y = (screenY - rect.top - transform.y) / transform.k;

    return { x, y };
  };

  return {
    transform,
    containerRef: containerRef as React.RefObject<HTMLDivElement>,
    fitView,
    screenToCanvas,
  };
}
