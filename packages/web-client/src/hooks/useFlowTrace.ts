import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Edge, NodeMouseHandler } from '@xyflow/react';
import { traceGraph, type TraceResult } from '../presentation/traceGraph.js';

/**
 * Manages Alt+hover flow trace state.
 * Alt+hover a construct to see its forward flow traced with hop badges.
 */
export function useFlowTrace(allEdges: Edge[]) {
  const [altPressed, setAltPressed] = useState(false);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  // Track Alt key state
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltPressed(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setAltPressed(false);
    };
    // Clear alt state if window loses focus while Alt is held
    const onBlur = () => setAltPressed(false);

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const isTraceActive = altPressed && hoveredNodeId != null;

  const traceResult: TraceResult | null = useMemo(
    () => (isTraceActive ? traceGraph(hoveredNodeId!, allEdges) : null),
    [isTraceActive, hoveredNodeId, allEdges],
  );

  const onNodeMouseEnter: NodeMouseHandler = useCallback((_event, node) => {
    setHoveredNodeId(node.id);
  }, []);

  const onNodeMouseLeave: NodeMouseHandler = useCallback(() => {
    setHoveredNodeId(null);
  }, []);

  return { traceResult, isTraceActive, onNodeMouseEnter, onNodeMouseLeave };
}
