import { useState, useCallback, useRef } from 'react';

export interface NarrativeEndpoint {
  name: string;
  schemaType: string;
  portLabel: string;
  portColor: string;
}

/** Edge-detail narrative (existing): shows source→target port relationship */
export interface EdgeNarrative {
  kind: 'edge';
  from: NarrativeEndpoint;
  to: NarrativeEndpoint;
  position: { x: number; y: number };
  anchor: 'above' | 'below';
}

/** Simple text hint (new): shows a short message, e.g. during drag */
export interface HintNarrative {
  kind: 'hint';
  text: string;
  variant: 'attach' | 'detach' | 'neutral';
  position: { x: number; y: number };
}

export type NarrativeState = EdgeNarrative | HintNarrative;

export function useNarrative() {
  const [narrative, setNarrative] = useState<NarrativeState | null>(null);
  const hintRef = useRef<NarrativeState | null>(null);

  const showNarrative = useCallback((state: NarrativeState) => {
    hintRef.current = state;
    setNarrative(state);
  }, []);

  const hideNarrative = useCallback(() => {
    hintRef.current = null;
    setNarrative(null);
  }, []);

  /** Update hint position without triggering re-render (for drag perf) */
  const updateHintPosition = useCallback((x: number, y: number) => {
    if (hintRef.current) {
      hintRef.current = { ...hintRef.current, position: { x, y } };
    }
  }, []);

  return { narrative, showNarrative, hideNarrative, updateHintPosition, hintRef };
}
