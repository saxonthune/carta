import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { computePresentation, type PresentationOutput } from '../presentation';

/**
 * Hook wrapper around the pure presentation model.
 * Processes organizer collapse/hide/layout via the presentation model
 * and builds edge remap for collapsed organizers.
 */
export function usePresentation(nodes: Node[], edges: Edge[]): PresentationOutput {
  return useMemo(
    () => computePresentation({ nodes: nodes as any, edges: edges as any }),
    [nodes, edges]
  );
}
