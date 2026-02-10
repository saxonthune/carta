import { useCallback } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { useDocumentContext } from '../contexts/DocumentContext';
import { useSchemas } from './useSchemas';
import type { ConstructNodeData } from '@carta/domain';
import { getPortsForSchema } from '@carta/domain';

/**
 * Hook for source-level edge cleanup in Yjs.
 *
 * Provides a `revalidateEdges()` function that removes edges with invalid
 * sourceHandle/targetHandle references from the Yjs document.
 *
 * This is the "source cleanup" layer (complements the presentation-layer
 * defensive filtering in edgeValidation.ts).
 */
export function useEdgeCleanup() {
  const { adapter } = useDocumentContext();
  const { getSchema } = useSchemas();

  const revalidateEdges = useCallback(() => {
    const edges = adapter.getEdges() as Edge[];
    const nodes = adapter.getNodes() as Node[];

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

    // Filter to only valid edges
    const validEdges = edges.filter(edge => {
      // Handle null sourceHandle (wagon attachment edges)
      if (edge.sourceHandle === null || edge.targetHandle === null) {
        return true;
      }

      // Special case: 'group-connect' handle (organizer connections)
      if (edge.sourceHandle === 'group-connect' || edge.targetHandle === 'group-connect') {
        return true;
      }

      // Validate source handle
      const sourcePorts = nodePortMap.get(edge.source);
      if (sourcePorts !== undefined && edge.sourceHandle && !sourcePorts.has(edge.sourceHandle)) {
        return false;
      }

      // Validate target handle
      const targetPorts = nodePortMap.get(edge.target);
      if (targetPorts !== undefined && edge.targetHandle && !targetPorts.has(edge.targetHandle)) {
        return false;
      }

      // If we couldn't determine port validity (missing schema), pass through
      return true;
    });

    const removedCount = edges.length - validEdges.length;

    if (removedCount > 0) {
      const removedEdges = edges.filter(e => !validEdges.includes(e));
      console.debug(
        `[edge-cleanup] Removing ${removedCount} edge(s) with invalid port references from Yjs:`,
        removedEdges.map(e => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle }))
      );
      adapter.setEdges(validEdges);
    }

    return removedCount;
  }, [adapter, getSchema]);

  return { revalidateEdges };
}
