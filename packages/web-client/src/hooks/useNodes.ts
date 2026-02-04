import { useState, useEffect, useCallback } from 'react';
import type { Node } from '@xyflow/react';
import { useDocumentContext } from '../contexts/DocumentContext';
import type { ConstructNodeData } from '@carta/domain';

/**
 * Focused hook for node state and operations.
 * Only re-renders when nodes (or active level) change.
 */
export function useNodes() {
  const { adapter } = useDocumentContext();

  const [nodes, setNodesState] = useState<Node[]>(() => adapter.getNodes() as Node[]);

  useEffect(() => {
    // Subscribe to node-specific changes (falls back to full subscribe if granular not available)
    const unsubscribe = adapter.subscribeToNodes
      ? adapter.subscribeToNodes(() => setNodesState(adapter.getNodes() as Node[]))
      : adapter.subscribe(() => setNodesState(adapter.getNodes() as Node[]));
    return unsubscribe;
  }, [adapter]);

  const setNodes = useCallback(
    (nodesOrUpdater: Node[] | ((prev: Node[]) => Node[])) => {
      adapter.setNodes(nodesOrUpdater as unknown[] | ((prev: unknown[]) => unknown[]));
    },
    [adapter]
  );

  const updateNode = useCallback(
    (nodeId: string, updates: Partial<ConstructNodeData>) => {
      adapter.updateNode(nodeId, updates);
    },
    [adapter]
  );

  const getNextNodeId = useCallback(() => {
    return adapter.generateNodeId();
  }, [adapter]);

  return { nodes, setNodes, updateNode, getNextNodeId };
}
