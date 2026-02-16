import { useMemo } from 'react';
import type { CartaNode, CartaEdge } from '@carta/types';
import { computePresentation, type PresentationOutput, computeSequenceBadges } from '../presentation';

/**
 * Hook wrapper around the pure presentation model.
 * Processes organizer collapse/hide/layout via the presentation model
 * and builds edge remap for collapsed organizers.
 */
export function usePresentation(nodes: CartaNode[], edges: CartaEdge[]): PresentationOutput {
  return useMemo(() => {
    const result = computePresentation({ nodes: nodes as any, edges: edges as any });

    // Compute sequence badges for organizer members
    const { badges } = computeSequenceBadges(result.processedNodes as any, edges as any);

    // Inject badge data into node data
    if (badges.size > 0) {
      result.processedNodes = result.processedNodes.map(node => {
        const badge = badges.get(node.id);
        if (badge !== undefined) {
          return { ...node, data: { ...node.data, sequenceBadge: badge } };
        }
        return node;
      });
    }

    return result;
  }, [nodes, edges]);
}
