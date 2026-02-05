/**
 * Pure geometry functions for organizer operations.
 * These are platform-agnostic and unit-testable.
 */

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface OrganizerLayoutConfig {
  padding: number;
  headerHeight: number;
}

export const DEFAULT_ORGANIZER_LAYOUT: OrganizerLayoutConfig = {
  padding: 20,
  headerHeight: 40,
};

/**
 * Node-like structure for geometry calculations.
 * Compatible with React Flow Node type.
 */
export interface NodeGeometry {
  position: Position;
  width?: number;
  height?: number;
  measured?: { width?: number; height?: number };
}

/**
 * Node with parent relationship for sorting.
 */
export interface NodeWithParent {
  id: string;
  parentId?: string;
}

/**
 * Compute the bounding box that contains all given nodes.
 * Uses measured dimensions when available, falling back to explicit dimensions.
 */
export function computeOrganizerBounds(
  nodes: NodeGeometry[],
  config: OrganizerLayoutConfig = DEFAULT_ORGANIZER_LAYOUT
): Bounds {
  if (nodes.length === 0) {
    return { x: 0, y: 0, width: config.padding * 2, height: config.padding * 2 + config.headerHeight };
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    const w = node.measured?.width ?? node.width ?? 200;
    const h = node.measured?.height ?? node.height ?? 100;

    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + w);
    maxY = Math.max(maxY, node.position.y + h);
  }

  return {
    x: minX - config.padding,
    y: minY - config.padding - config.headerHeight,
    width: maxX - minX + config.padding * 2,
    height: maxY - minY + config.padding * 2 + config.headerHeight,
  };
}

/**
 * Convert an absolute position to a position relative to a parent.
 */
export function toRelativePosition(nodePos: Position, parentPos: Position): Position {
  return {
    x: nodePos.x - parentPos.x,
    y: nodePos.y - parentPos.y,
  };
}

/**
 * Convert a relative position to an absolute position.
 */
export function toAbsolutePosition(nodePos: Position, parentPos: Position): Position {
  return {
    x: nodePos.x + parentPos.x,
    y: nodePos.y + parentPos.y,
  };
}

/**
 * Compute the minimum size needed to contain all children.
 * Children positions are assumed to be relative to the organizer.
 */
export function computeMinOrganizerSize(
  children: NodeGeometry[],
  config: OrganizerLayoutConfig = DEFAULT_ORGANIZER_LAYOUT
): Size {
  if (children.length === 0) {
    return {
      width: config.padding * 2,
      height: config.padding * 2 + config.headerHeight,
    };
  }

  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const child of children) {
    const w = child.measured?.width ?? child.width ?? 200;
    const h = child.measured?.height ?? child.height ?? 100;

    maxX = Math.max(maxX, child.position.x + w);
    maxY = Math.max(maxY, child.position.y + h);
  }

  return {
    width: maxX + config.padding,
    height: maxY + config.padding,
  };
}

/**
 * Sort nodes so that parents come before their children.
 * This is required by React Flow for proper rendering.
 *
 * Uses topological sort to handle nested organizers.
 * Cycles are detected and broken (nodes in cycles are placed at the end).
 */
export function sortParentsFirst<T extends NodeWithParent>(nodes: T[]): T[] {
  const result: T[] = [];
  const added = new Set<string>();
  const visiting = new Set<string>(); // For cycle detection

  // Build id -> node map
  const nodeMap = new Map<string, T>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
  }

  // Recursive function to add a node and its ancestors first
  const addNode = (node: T, depth = 0): boolean => {
    // Cycle detection
    if (visiting.has(node.id)) {
      return false; // Cycle detected
    }
    if (added.has(node.id)) {
      return true; // Already processed
    }
    if (depth > 100) {
      return false; // Max depth exceeded
    }

    visiting.add(node.id);

    // If this node has a parent, add the parent first
    if (node.parentId) {
      const parent = nodeMap.get(node.parentId);
      if (parent && !added.has(node.parentId)) {
        addNode(parent, depth + 1);
      }
    }

    visiting.delete(node.id);
    added.add(node.id);
    result.push(node);
    return true;
  };

  // Add all nodes, ensuring parent-first ordering
  for (const node of nodes) {
    addNode(node);
  }

  return result;
}

/**
 * Result of a full organizer fit calculation.
 * Handles children that have been dragged above/left of the organizer content area.
 */
export interface OrganizerFitResult {
  /** How much to shift the organizer's position (negative = move left/up) */
  positionDelta: Position;
  /** New size for the organizer after accounting for the shift */
  size: Size;
  /** Delta to apply to ALL children's positions (= -positionDelta) */
  childPositionDelta: Position;
}

/**
 * Compute a full organizer refit: new size AND position/child adjustments.
 * Unlike computeMinOrganizerSize which only grows rightward/downward,
 * this handles children at negative relative positions by shifting
 * the organizer position and adjusting all children.
 *
 * Children positions are assumed to be relative to the organizer.
 */
export function computeOrganizerFit(
  children: NodeGeometry[],
  config: OrganizerLayoutConfig = DEFAULT_ORGANIZER_LAYOUT
): OrganizerFitResult {
  const noShift: OrganizerFitResult = {
    positionDelta: { x: 0, y: 0 },
    size: {
      width: config.padding * 2,
      height: config.padding * 2 + config.headerHeight,
    },
    childPositionDelta: { x: 0, y: 0 },
  };

  if (children.length === 0) return noShift;

  const idealMinX = config.padding;
  const idealMinY = config.padding + config.headerHeight;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const child of children) {
    const w = child.measured?.width ?? child.width ?? 200;
    const h = child.measured?.height ?? child.height ?? 100;

    minX = Math.min(minX, child.position.x);
    minY = Math.min(minY, child.position.y);
    maxX = Math.max(maxX, child.position.x + w);
    maxY = Math.max(maxY, child.position.y + h);
  }

  const shiftX = minX < idealMinX ? minX - idealMinX : 0;
  const shiftY = minY < idealMinY ? minY - idealMinY : 0;

  return {
    positionDelta: { x: shiftX || 0, y: shiftY || 0 },
    size: {
      width: maxX - shiftX + config.padding,
      height: maxY - shiftY + config.padding,
    },
    childPositionDelta: { x: (-shiftX) || 0, y: (-shiftY) || 0 },
  };
}

/**
 * Check if a node's bounding box overlaps with an organizer's bounding box.
 * Used for drag-drop organizer membership detection.
 */
export function nodeOverlapsOrganizer(
  nodePos: Position,
  nodeSize: Size,
  organizerPos: Position,
  organizerSize: Size
): boolean {
  const nodeRight = nodePos.x + nodeSize.width;
  const nodeBottom = nodePos.y + nodeSize.height;
  const organizerRight = organizerPos.x + organizerSize.width;
  const organizerBottom = organizerPos.y + organizerSize.height;

  // Check for overlap (not just touching)
  return (
    nodePos.x < organizerRight &&
    nodeRight > organizerPos.x &&
    nodePos.y < organizerBottom &&
    nodeBottom > organizerPos.y
  );
}

/**
 * Check if a node is fully contained within an organizer.
 * More strict than overlap - requires node to be entirely inside organizer.
 */
export function nodeContainedInOrganizer(
  nodePos: Position,
  nodeSize: Size,
  organizerPos: Position,
  organizerSize: Size
): boolean {
  const nodeRight = nodePos.x + nodeSize.width;
  const nodeBottom = nodePos.y + nodeSize.height;
  const organizerRight = organizerPos.x + organizerSize.width;
  const organizerBottom = organizerPos.y + organizerSize.height;

  return (
    nodePos.x >= organizerPos.x &&
    nodeRight <= organizerRight &&
    nodePos.y >= organizerPos.y &&
    nodeBottom <= organizerBottom
  );
}
