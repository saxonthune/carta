import { useState, useCallback } from 'react';

export interface NarrativeEndpoint {
  name: string;
  schemaType: string;
  portLabel: string;
  portColor: string;
}

export interface NarrativeState {
  /** Source-polarity endpoint (left side) */
  from: NarrativeEndpoint;
  /** Sink-polarity endpoint (right side) */
  to: NarrativeEndpoint;
  position: { x: number; y: number };
  anchor: 'above' | 'below';
}

export function useNarrative() {
  const [narrative, setNarrative] = useState<NarrativeState | null>(null);

  const showNarrative = useCallback((state: NarrativeState) => {
    setNarrative(state);
  }, []);

  const hideNarrative = useCallback(() => {
    setNarrative(null);
  }, []);

  return { narrative, showNarrative, hideNarrative };
}
