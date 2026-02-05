/**
 * Pure functions for organizer processing.
 * Extracted from usePresentation — no React dependencies.
 */

import type { OrganizerNodeData, OrganizerLayout } from '@carta/domain';
import { stackLayout, gridLayout } from './layoutStrategies';

/** Minimal node shape for processing (compatible with React Flow Node) */
export interface ProcessableNode {
  id: string;
  type?: string;
  parentId?: string;
  hidden?: boolean;
  data: Record<string, unknown>;
  position: { x: number; y: number };
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
}

/**
 * Compute the set of collapsed organizer IDs.
 */
export function computeCollapsedSet(nodes: ProcessableNode[]): Set<string> {
  const collapsed = new Set<string>();
  for (const node of nodes) {
    if (node.type === 'organizer') {
      const data = node.data as unknown as OrganizerNodeData;
      if (data.collapsed) {
        collapsed.add(node.id);
      }
    }
  }
  return collapsed;
}

/**
 * Compute the set of node IDs hidden because their ancestor organizer is collapsed.
 */
export function computeHiddenDescendants(
  nodes: ProcessableNode[],
  collapsedSet: Set<string>
): Set<string> {
  const hidden = new Set<string>();

  // Build parent-to-children map
  const childrenMap = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId) {
      const children = childrenMap.get(node.parentId) || [];
      children.push(node.id);
      childrenMap.set(node.parentId, children);
    }
  }

  // Recursively find all descendants of collapsed organizers
  const addDescendants = (organizerId: string, depth = 0) => {
    if (depth > 20) return;
    const children = childrenMap.get(organizerId) || [];
    for (const childId of children) {
      hidden.add(childId);
      addDescendants(childId, depth + 1);
    }
  };

  for (const organizerId of collapsedSet) {
    addDescendants(organizerId);
  }

  return hidden;
}

/**
 * Build edge remap: maps hidden node IDs to their top-level collapsed ancestor.
 * Used to re-route edges to the collapsed organizer chip.
 */
export function computeEdgeRemap(
  nodes: ProcessableNode[],
  hiddenSet: Set<string>,
  collapsedSet: Set<string>
): Map<string, string> {
  const remap = new Map<string, string>();

  // Build node lookup for parent-walking
  const nodeMap = new Map<string, ProcessableNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  const findCollapsedAncestor = (nodeId: string): string | undefined => {
    const node = nodeMap.get(nodeId);
    if (!node?.parentId) return undefined;

    let current = node;
    let collapsedAncestor: string | undefined;
    let depth = 0;

    while (current.parentId && depth < 20) {
      if (collapsedSet.has(current.parentId)) {
        collapsedAncestor = current.parentId;
      }
      const parent = nodeMap.get(current.parentId);
      if (!parent) break;
      current = parent;
      depth++;
    }

    return collapsedAncestor;
  };

  for (const nodeId of hiddenSet) {
    const collapsedAncestor = findCollapsedAncestor(nodeId);
    if (collapsedAncestor) {
      remap.set(nodeId, collapsedAncestor);
    }
  }

  return remap;
}

/**
 * Apply layout strategies to organizer members.
 * For non-freeform layouts, adjusts member positions and visibility.
 */
export function applyLayoutStrategies(nodes: ProcessableNode[]): ProcessableNode[] {
  // Build organizer → members map (ordered by position in array)
  const organizerMembers = new Map<string, ProcessableNode[]>();
  const organizerNodes = new Map<string, ProcessableNode>();

  for (const node of nodes) {
    if (node.type === 'organizer') {
      organizerNodes.set(node.id, node);
      if (!organizerMembers.has(node.id)) {
        organizerMembers.set(node.id, []);
      }
    }
    if (node.parentId && organizerNodes.has(node.parentId)) {
      const members = organizerMembers.get(node.parentId) || [];
      members.push(node);
      organizerMembers.set(node.parentId, members);
    }
  }

  // For each non-freeform organizer, apply layout
  const positionOverrides = new Map<string, { x: number; y: number }>();
  const hiddenByLayout = new Set<string>();

  for (const [organizerId, organizer] of organizerNodes) {
    const data = organizer.data as unknown as OrganizerNodeData;
    const layout: OrganizerLayout = data.layout || 'freeform';
    if (layout === 'freeform' || data.collapsed) continue;

    const members = organizerMembers.get(organizerId) || [];
    if (members.length === 0) continue;

    const memberGeometries = members.map(m => ({
      position: m.position,
      width: m.width,
      height: m.height,
      measured: m.measured,
    }));

    let result;
    if (layout === 'stack') {
      result = stackLayout(memberGeometries, data.stackIndex ?? 0);
    } else {
      result = gridLayout(memberGeometries, data.gridColumns ?? 3);
    }

    // Apply position overrides and visibility
    for (let i = 0; i < members.length; i++) {
      const pos = result.positions.get(i);
      if (pos) {
        positionOverrides.set(members[i].id, pos);
      }
      if (!result.visibleIndices.has(i)) {
        hiddenByLayout.add(members[i].id);
      }
    }
  }

  // Apply overrides if any exist
  if (positionOverrides.size === 0 && hiddenByLayout.size === 0) {
    return nodes;
  }

  return nodes.map(node => {
    const posOverride = positionOverrides.get(node.id);
    const shouldHide = hiddenByLayout.has(node.id);

    if (!posOverride && !shouldHide) return node;

    return {
      ...node,
      ...(posOverride ? { position: posOverride } : {}),
      ...(shouldHide ? { hidden: true } : {}),
    };
  });
}
