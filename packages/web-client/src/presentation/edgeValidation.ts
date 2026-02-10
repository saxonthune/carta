/**
 * Edge validation for filtering edges with invalid port references.
 *
 * After schema changes (port deletions, schema recreation), edges may reference
 * sourceHandle/targetHandle IDs that no longer exist on the node's schema.
 * This module provides defensive filtering at the presentation layer.
 */

import type { Edge, Node } from '@xyflow/react';
import type { ConstructSchema, ConstructNodeData, OrganizerNodeData } from '@carta/domain';
import { getPortsForSchema } from '@carta/domain';

/**
 * Filter out edges whose sourceHandle or targetHandle references
 * a port ID that doesn't exist on the source/target node's schema.
 * Returns only valid edges. Logs dropped edges at debug level.
 *
 * Special cases that pass through:
 * - Organizer nodes (use 'group-connect' handle)
 * - Null handles (wagon attachment edges use sourceHandle: null)
 * - Edges where we can't determine the schema (pass through to avoid false positives)
 */
export function filterInvalidEdges(
  edges: Edge[],
  nodes: Node[],
  getSchema: (type: string) => ConstructSchema | undefined
): Edge[] {
  // Build port lookup: nodeId → Set<portId>
  const nodePortMap = new Map<string, Set<string>>();

  for (const node of nodes) {
    if (node.type === 'organizer') {
      // Organizers use 'group-connect' handle, always valid
      nodePortMap.set(node.id, new Set(['group-connect']));
    } else if (node.type === 'construct') {
      const data = node.data as ConstructNodeData;
      const schema = getSchema(data.constructType);
      if (schema) {
        const ports = getPortsForSchema(schema.ports);
        nodePortMap.set(node.id, new Set(ports.map(p => p.id)));
      }
      // If no schema found, skip this node (pass through edges touching it)
    }
  }

  const validEdges: Edge[] = [];
  const droppedEdges: Edge[] = [];

  for (const edge of edges) {
    // Handle null sourceHandle (wagon attachment edges)
    if (edge.sourceHandle === null || edge.targetHandle === null) {
      validEdges.push(edge);
      continue;
    }

    // Special case: 'group-connect' handle (organizer connections)
    if (edge.sourceHandle === 'group-connect' || edge.targetHandle === 'group-connect') {
      validEdges.push(edge);
      continue;
    }

    // Validate source handle
    const sourcePorts = nodePortMap.get(edge.source);
    if (sourcePorts !== undefined && edge.sourceHandle && !sourcePorts.has(edge.sourceHandle)) {
      droppedEdges.push(edge);
      continue;
    }

    // Validate target handle
    const targetPorts = nodePortMap.get(edge.target);
    if (targetPorts !== undefined && edge.targetHandle && !targetPorts.has(edge.targetHandle)) {
      droppedEdges.push(edge);
      continue;
    }

    // If we couldn't determine port validity (missing schema), pass through
    validEdges.push(edge);
  }

  if (droppedEdges.length > 0) {
    console.debug(
      `[edge-validation] Filtered ${droppedEdges.length} edge(s) with invalid port references:`,
      droppedEdges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle }))
    );
  }

  return validEdges;
}
