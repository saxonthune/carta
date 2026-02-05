/**
 * Presentation model: pure transformation from domain state to render-ready data.
 * Combines organizer processing, layout strategies, and edge handling.
 */

import type { ProcessableNode } from './organizerProcessor';
import {
  computeCollapsedSet,
  computeHiddenDescendants,
  computeEdgeRemap,
  applyLayoutStrategies,
} from './organizerProcessor';

/** Minimal edge shape (compatible with React Flow Edge) */
export interface ProcessableEdge {
  id: string;
  source: string;
  target: string;
  [key: string]: unknown;
}

export interface PresentationInput {
  nodes: ProcessableNode[];
  edges: ProcessableEdge[];
}

export interface PresentationOutput {
  /** Nodes with hidden flags set and layout positions applied */
  processedNodes: ProcessableNode[];
  /** Original edges (remapping is done separately in Map.tsx for handle logic) */
  processedEdges: ProcessableEdge[];
  /** Map from hidden nodeId → collapsed ancestor organizerId */
  edgeRemap: Map<string, string>;
}

/**
 * Compute the full presentation model from domain state.
 * Pure function — no side effects, no React dependencies.
 */
export function computePresentation(input: PresentationInput): PresentationOutput {
  const { nodes, edges } = input;

  // 1. Compute collapsed organizers
  const collapsedSet = computeCollapsedSet(nodes);

  // 2. Compute hidden descendants
  const hiddenSet = computeHiddenDescendants(nodes, collapsedSet);

  // 3. Build edge remap
  const edgeRemap = computeEdgeRemap(nodes, hiddenSet, collapsedSet);

  // 4. Apply layout strategies (stack/grid position overrides)
  const layoutNodes = applyLayoutStrategies(nodes);

  // 5. Apply collapse hiding
  const processedNodes = layoutNodes.map(node => {
    if (hiddenSet.has(node.id)) {
      return { ...node, hidden: true };
    }
    return node;
  });

  return {
    processedNodes,
    processedEdges: edges,
    edgeRemap,
  };
}
