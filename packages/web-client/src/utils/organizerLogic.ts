import type { OrganizerNodeData, CartaNode } from '@carta/schema';
import {
  computeOrganizerBounds,
  toAbsolutePosition,
  DEFAULT_ORGANIZER_LAYOUT,
  computeLayoutUnitSizes,
  type NodeGeometry,
  type LayoutItem,
  type WagonInfo,
} from '@carta/schema';

/**
 * Compute the absolute canvas position of a node by walking its parentId chain.
 * For nodes without a parent, this returns node.position unchanged.
 */
export function getAbsolutePosition(node: CartaNode, allNodes: CartaNode[]): { x: number; y: number } {
  if (!node.parentId) return node.position;
  const parent = allNodes.find(n => n.id === node.parentId);
  if (!parent) return node.position;
  const parentAbs = getAbsolutePosition(parent, allNodes);
  return { x: parentAbs.x + node.position.x, y: parentAbs.y + node.position.y };
}

/**
 * Validate whether a node can be nested inside an organizer.
 * - Constructs can always be added to organizers
 * - Organizers can only be added if they're wagon organizers whose construct is already a member
 */
export function canNestInOrganizer(node: CartaNode, targetOrganizer: CartaNode, allNodes: CartaNode[]): boolean {
  // Constructs can always be added to organizers
  if (node.type === 'construct') return true;

  // Organizers can only be added if they're wagon organizers
  // whose construct is already a member of the target organizer
  if (node.type === 'organizer') {
    const data = node.data as OrganizerNodeData;
    if (!data.attachedToSemanticId) return false; // non-wagon organizer — reject

    // Find the construct this wagon is attached to
    const ownerConstruct = allNodes.find(n =>
      n.type === 'construct' &&
      (n.data as { semanticId?: string }).semanticId === data.attachedToSemanticId
    );
    // Allow only if the construct is already in the target organizer
    return ownerConstruct?.parentId === targetOrganizer.id;
  }

  return true;
}

/**
 * Compute bounds for a new organizer that will contain the selected nodes.
 * Returns { x, y, width, height } where (x, y) is the top-left position and width/height
 * are the organizer dimensions that enclose all selected nodes with proper padding.
 */
export function computeNewOrganizerBounds(
  selectedNodes: CartaNode[],
  allNodes: CartaNode[],
): { x: number; y: number; width: number; height: number } {
  const layoutItems: LayoutItem[] = selectedNodes.map(n => ({
    id: n.id,
    semanticId: (n.data as any)?.semanticId ?? n.id,
    x: n.position.x,
    y: n.position.y,
    width: n.measured?.width ?? n.width ?? 200,
    height: n.measured?.height ?? n.height ?? 100,
  }));

  const wagonInfos: WagonInfo[] = allNodes
    .filter(n => n.type === 'organizer' && n.parentId)
    .map(n => ({
      id: n.id,
      parentId: n.parentId!,
      x: n.position.x,
      y: n.position.y,
      width: (n.style?.width as number) ?? n.measured?.width ?? n.width ?? 400,
      height: (n.style?.height as number) ?? n.measured?.height ?? n.height ?? 300,
    }));

  const unitSizes = computeLayoutUnitSizes(layoutItems, wagonInfos);

  const nodeGeometries: NodeGeometry[] = selectedNodes.map(n => {
    const layoutUnit = unitSizes.get(n.id) ?? { width: 200, height: 100 };
    return {
      position: n.position,
      width: layoutUnit.width,
      height: layoutUnit.height,
      measured: n.measured,
    };
  });

  return computeOrganizerBounds(nodeGeometries, DEFAULT_ORGANIZER_LAYOUT);
}

/**
 * Given an organizer and all nodes, compute the new node list after detaching
 * all members from the organizer. Members get absolute positions and cleared parentId.
 * The organizer itself is removed from the returned list.
 */
export function computeDetachedNodes(
  organizerId: string,
  organizer: CartaNode,
  allNodes: CartaNode[],
): CartaNode[] {
  const organizerAbsPos = getAbsolutePosition(organizer, allNodes);
  return allNodes
    .filter(n => n.id !== organizerId)
    .map(n => {
      if (n.parentId === organizerId) {
        const absolutePosition = toAbsolutePosition(n.position, organizerAbsPos);
        return { ...n, parentId: undefined, extent: undefined, position: absolutePosition };
      }
      return n;
    });
}

/**
 * Recursively collect all descendant node IDs of a parent node.
 * Includes the parent ID itself in the returned set.
 * The maxDepth parameter prevents infinite loops in case of circular references.
 */
export function collectDescendantIds(parentId: string, allNodes: CartaNode[], maxDepth = 20): Set<string> {
  const ids = new Set<string>([parentId]);
  const findDescendants = (pid: string, depth: number) => {
    if (depth > maxDepth) return;
    for (const node of allNodes) {
      if (node.parentId === pid && !ids.has(node.id)) {
        ids.add(node.id);
        findDescendants(node.id, depth + 1);
      }
    }
  };
  findDescendants(parentId, 0);
  return ids;
}
