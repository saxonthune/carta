/**
 * Compute sequence badges for nodes inside organizers.
 * Pure function — no React dependencies.
 */

import type { ProcessableNode } from './organizerProcessor.js';
import type { ProcessableEdge } from './presentationModel.js';

export interface SequenceBadgeResult {
  /** Map from node ID to ordinal number (1-based) */
  badges: Map<string, number>;
}

/**
 * For each organizer, find members connected by flow-out→flow-in edges,
 * compute topological layers, and assign ordinals.
 *
 * Nodes without flow edges in the organizer get no badge.
 * Disconnected nodes (no flow edges) get no badge.
 * Branches (multiple outgoing) all advance to next ordinal — no sub-labels.
 */
export function computeSequenceBadges(
  nodes: ProcessableNode[],
  edges: ProcessableEdge[]
): SequenceBadgeResult {
  const badges = new Map<string, number>();

  // Group nodes by parentId (organizer membership)
  const organizerMembers = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId && node.type !== 'organizer') {
      const members = organizerMembers.get(node.parentId) ?? [];
      members.push(node.id);
      organizerMembers.set(node.parentId, members);
    }
  }

  // For each organizer with 2+ members, compute sequence
  for (const [, memberIds] of organizerMembers) {
    if (memberIds.length < 2) continue;

    const memberSet = new Set(memberIds);

    // Find flow-out → flow-in edges between members of this organizer
    // Edges use sourceHandle/targetHandle for port IDs
    const flowEdges: Array<{ source: string; target: string }> = [];
    for (const edge of edges) {
      const eAny = edge as Record<string, unknown>;
      const sourceHandle = (eAny.sourceHandle ?? '') as string;
      if (
        sourceHandle === 'flow-out' &&
        memberSet.has(edge.source) &&
        memberSet.has(edge.target)
      ) {
        flowEdges.push({ source: edge.source, target: edge.target });
      }
    }

    if (flowEdges.length === 0) continue;

    // Build adjacency
    const downstream = new Map<string, string[]>();
    const upstream = new Map<string, string[]>();
    for (const id of memberIds) {
      downstream.set(id, []);
      upstream.set(id, []);
    }
    for (const e of flowEdges) {
      downstream.get(e.source)?.push(e.target);
      upstream.get(e.target)?.push(e.source);
    }

    // Find nodes that participate in any flow edge
    const participants = new Set<string>();
    for (const e of flowEdges) {
      participants.add(e.source);
      participants.add(e.target);
    }

    // Topological layer assignment (longest path from sources)
    // Sources = participants with no incoming flow edges within this organizer
    const layers = new Map<string, number>();
    const sources = [...participants].filter(id => (upstream.get(id)?.length ?? 0) === 0);

    for (const id of sources) {
      layers.set(id, 0);
    }

    // Iterative relaxation
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 100) {
      changed = false;
      iterations++;
      for (const id of participants) {
        const ups = upstream.get(id) ?? [];
        if (ups.length === 0) continue;
        const upLayers = ups.map(u => layers.get(u)).filter((l): l is number => l !== undefined);
        if (upLayers.length === ups.length) {
          const newLayer = Math.max(...upLayers) + 1;
          if (layers.get(id) !== newLayer) {
            layers.set(id, newLayer);
            changed = true;
          }
        }
      }
    }

    // Convert layers to 1-based ordinals
    for (const [nodeId, layer] of layers) {
      badges.set(nodeId, layer + 1);
    }
  }

  return { badges };
}
