/**
 * Pin constraint resolution algorithm.
 * Pure function — no Yjs, no side effects.
 *
 * Resolves a directed graph of relative position constraints
 * between organizers into absolute positions.
 */

import type { PinConstraint, PinDirection } from '../types/index.js';

export interface PinLayoutNode {
  id: string;           // organizer or wagon-composite ID
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PinLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  warnings: string[];   // e.g., cycle detection messages
}

/**
 * Compute position offset for a source node relative to a target node.
 *
 * @param target - The reference organizer
 * @param source - The organizer being positioned
 * @param direction - Where source sits relative to target
 * @param gap - Spacing between the two organizers
 */
function computeOffset(
  target: PinLayoutNode,
  source: PinLayoutNode,
  direction: PinDirection,
  gap: number
): { x: number; y: number } {
  const result = { x: 0, y: 0 };

  // Compute axis offsets based on direction
  switch (direction) {
    case 'N':
      result.x = target.x + target.width / 2 - source.width / 2;
      result.y = target.y - gap - source.height;
      break;
    case 'S':
      result.x = target.x + target.width / 2 - source.width / 2;
      result.y = target.y + target.height + gap;
      break;
    case 'E':
      result.x = target.x + target.width + gap;
      result.y = target.y + target.height / 2 - source.height / 2;
      break;
    case 'W':
      result.x = target.x - gap - source.width;
      result.y = target.y + target.height / 2 - source.height / 2;
      break;
    case 'NE':
      result.x = target.x + target.width + gap;
      result.y = target.y - gap - source.height;
      break;
    case 'NW':
      result.x = target.x - gap - source.width;
      result.y = target.y - gap - source.height;
      break;
    case 'SE':
      result.x = target.x + target.width + gap;
      result.y = target.y + target.height + gap;
      break;
    case 'SW':
      result.x = target.x - gap - source.width;
      result.y = target.y + target.height + gap;
      break;
  }

  return result;
}

/**
 * Topological sort using Kahn's algorithm with cycle detection.
 * Returns sorted node IDs and any detected cycles.
 */
function topologicalSort(
  nodeIds: Set<string>,
  edges: Map<string, Array<{ sourceId: string; direction: PinDirection; gap: number }>>
): { sorted: string[]; cycles: string[] } {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  // Initialize all nodes
  for (const nodeId of nodeIds) {
    inDegree.set(nodeId, 0);
    adjList.set(nodeId, []);
  }

  // Build adjacency list and in-degree count
  // Edge direction: target → source (source depends on target)
  for (const [targetId, sources] of edges) {
    for (const { sourceId } of sources) {
      adjList.get(targetId)?.push(sourceId);
      inDegree.set(sourceId, (inDegree.get(sourceId) || 0) + 1);
    }
  }

  // Queue nodes with no dependencies
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    // Process neighbors
    const neighbors = adjList.get(current) || [];
    for (const neighbor of neighbors) {
      const newDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }

  // Check for cycles
  const cycles: string[] = [];
  if (sorted.length !== nodeIds.size) {
    // Nodes not in sorted list are part of a cycle
    for (const nodeId of nodeIds) {
      if (!sorted.includes(nodeId)) {
        cycles.push(nodeId);
      }
    }
  }

  return { sorted, cycles };
}

/**
 * Resolve pin constraints into absolute positions.
 *
 * Algorithm:
 * 1. Build adjacency graph: target → [sources that depend on it]
 * 2. Identify root nodes (no dependencies)
 * 3. Topological sort with cycle detection
 * 4. For each node in order, compute position from target + offset
 * 5. De-overlap is the caller's responsibility
 *
 * @param nodes - All organizer nodes with their current positions/sizes
 * @param constraints - Pin constraints to resolve
 * @param defaultGap - Default spacing between organizers (default: 60)
 */
export function resolvePinConstraints(
  nodes: PinLayoutNode[],
  constraints: PinConstraint[],
  defaultGap: number = 60
): PinLayoutResult {
  const warnings: string[] = [];
  const positions = new Map<string, { x: number; y: number }>();

  // Build node lookup
  const nodeMap = new Map<string, PinLayoutNode>();
  for (const node of nodes) {
    nodeMap.set(node.id, node);
    // Initialize all nodes with their current positions
    positions.set(node.id, { x: node.x, y: node.y });
  }

  // Build adjacency: targetId → [{ sourceId, direction, gap }]
  const adjacency = new Map<string, Array<{ sourceId: string; direction: PinDirection; gap: number }>>();
  const constrainedNodes = new Set<string>();

  for (const constraint of constraints) {
    const { sourceOrganizerId, targetOrganizerId, direction, gap } = constraint;

    // Validate nodes exist
    if (!nodeMap.has(sourceOrganizerId)) {
      warnings.push(`Source organizer not found: ${sourceOrganizerId}`);
      continue;
    }
    if (!nodeMap.has(targetOrganizerId)) {
      warnings.push(`Target organizer not found: ${targetOrganizerId}`);
      continue;
    }

    constrainedNodes.add(sourceOrganizerId);
    constrainedNodes.add(targetOrganizerId);

    if (!adjacency.has(targetOrganizerId)) {
      adjacency.set(targetOrganizerId, []);
    }
    adjacency.get(targetOrganizerId)!.push({
      sourceId: sourceOrganizerId,
      direction,
      gap: gap ?? defaultGap
    });
  }

  // If no valid constraints, return current positions
  if (constrainedNodes.size === 0) {
    return { positions, warnings };
  }

  // Topological sort to detect cycles and determine processing order
  const { sorted, cycles } = topologicalSort(constrainedNodes, adjacency);

  if (cycles.length > 0) {
    warnings.push(`Cycle detected involving organizers: ${cycles.join(', ')}`);
    // Remove cycles by skipping constraints involving cycle nodes
    for (const cycleNode of cycles) {
      constrainedNodes.delete(cycleNode);
    }
  }

  // Process nodes in topological order
  for (const nodeId of sorted) {
    // Skip cycle nodes
    if (cycles.includes(nodeId)) {
      continue;
    }

    const node = nodeMap.get(nodeId)!;

    // If this node is a source in any constraint, compute its position
    for (const [targetId, sources] of adjacency) {
      for (const { sourceId, direction, gap } of sources) {
        if (sourceId === nodeId) {
          const targetNode = nodeMap.get(targetId);
          if (!targetNode) continue;

          // Get target's resolved position (or current if not yet resolved)
          const targetPos = positions.get(targetId) || { x: targetNode.x, y: targetNode.y };

          // Create a temporary target node with resolved position for offset calculation
          const resolvedTarget: PinLayoutNode = {
            ...targetNode,
            x: targetPos.x,
            y: targetPos.y
          };

          const offset = computeOffset(resolvedTarget, node, direction, gap);
          positions.set(nodeId, { x: offset.x, y: offset.y });
        }
      }
    }
  }

  return { positions, warnings };
}
