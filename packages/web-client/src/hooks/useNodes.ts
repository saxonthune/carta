import { useState, useEffect, useCallback, useRef } from 'react';
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

  // When true, subscriber skips state updates (used during drag to avoid
  // remote Yjs changes overwriting local React Flow positions)
  const suppressUpdatesRef = useRef(false);

  // Optional RF pusher — registered by Map.tsx once reactFlow is available
  const rfPusherRef = useRef<((nodes: Node[]) => void) | null>(null);

  useEffect(() => {
    const handler = () => {
      if (suppressUpdatesRef.current) return;
      const freshNodes = adapter.getNodes() as Node[];
      setNodesState(freshNodes);
      // Also push to RF if pusher is registered
      rfPusherRef.current?.(freshNodes);
    };
    // Subscribe to node-specific changes (falls back to full subscribe if granular not available)
    const unsubscribe = adapter.subscribeToNodes
      ? adapter.subscribeToNodes(handler)
      : adapter.subscribe(handler);
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

  const registerRFPusher = useCallback((pusher: (nodes: Node[]) => void) => {
    rfPusherRef.current = pusher;
  }, []);

  return { nodes, setNodes, setNodesLocal: setNodesState, suppressUpdates: suppressUpdatesRef, updateNode, getNextNodeId, registerRFPusher };
}
