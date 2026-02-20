import { useMemo, useRef } from 'react';
import type { CartaNode, CartaEdge } from '@carta/types';
import type { ConstructSchema, ConstructValues } from '@carta/domain';
import { usePresentation } from './usePresentation';

const NODE_DRAG_HANDLE = '.node-drag-handle';

export interface MapNodePipelineInputs {
  nodes: CartaNode[];
  edges: CartaEdge[];
  renamingNodeId: string | null;
  renamingOrganizerId: string | null;
  isTraceActive: boolean;
  traceResult: { nodeDistances: Map<string, number> } | null;
  nodeActions: Record<string, (...args: any[]) => void>;
  orgRenameStart: (id: string) => void;
  orgRenameStop: () => void;
  searchText: string | undefined;
  getSchema: (type: string) => ConstructSchema | undefined;
}

export interface MapNodePipelineOutputs {
  sortedNodes: CartaNode[];
  organizerIds: Set<string>;
  processedNodes: CartaNode[];
  edgeRemap: Map<string, string>;
}

export function useMapNodePipeline(inputs: MapNodePipelineInputs): MapNodePipelineOutputs {
  const {
    nodes,
    edges,
    renamingNodeId,
    renamingOrganizerId,
    isTraceActive,
    traceResult,
    nodeActions,
    orgRenameStart,
    orgRenameStop,
    searchText,
    getSchema,
  } = inputs;

  // Presentation model for collapse/hide logic and edge remapping
  const { processedNodes: nodesWithHiddenFlags, edgeRemap } = usePresentation(nodes, edges);

  // Count children per parent node (organizers)
  const childCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const node of nodes) {
      if (node.parentId) {
        counts[node.parentId] = (counts[node.parentId] || 0) + 1;
      }
    }
    return counts;
  }, [nodes]);

  // Set of organizer IDs for expandParent assignment
  const organizerIds = useMemo(() => new Set(
    nodesWithHiddenFlags.filter(n => n.type === 'organizer').map(n => n.id)
  ), [nodesWithHiddenFlags]);

  // Cache previous output so we can reuse node references when overlay data hasn't changed.
  // This prevents RF from re-rendering all 50 nodes when only 1-2 actually changed.
  const prevNodesCache = useRef<globalThis.Map<string, CartaNode>>(new globalThis.Map());

  const nodesWithCallbacks = useMemo(() => {
    const cache = prevNodesCache.current;
    const newCache = new globalThis.Map<string, CartaNode>();

    const result = nodesWithHiddenFlags.map((node) => {
      const prev = cache.get(node.id);
      const prevData = prev?.data as Record<string, unknown> | undefined;

      if (node.type === 'organizer') {
        const childCount = childCountMap[node.id] || 0;
        const isDimmed = isTraceActive && !traceResult?.nodeDistances.has(node.id);
        const isRenaming = renamingOrganizerId === node.id;

        // Reuse previous reference if overlay data unchanged and base node unchanged
        if (prev && prev.type === 'organizer' &&
            prevData?.childCount === childCount &&
            prevData?.isDimmed === isDimmed &&
            prevData?.isRenaming === isRenaming &&
            (prev as unknown as { _baseRef: unknown })._baseRef === node) {
          newCache.set(node.id, prev);
          return prev;
        }

        const newNode = {
          ...node,
          dragHandle: NODE_DRAG_HANDLE,
          _baseRef: node, // track base node identity for cache hit detection
          data: {
            ...node.data,
            childCount,
            isDimmed,
            nodeActions,
            isRenaming,
            onStartRenaming: orgRenameStart.bind(null, node.id),
            onStopRenaming: orgRenameStop,
          },
        } as CartaNode;
        newCache.set(node.id, newNode);
        return newNode;
      }

      // Construct node
      const isRenaming = node.id === renamingNodeId;
      const dimmed = isTraceActive && !traceResult?.nodeDistances.has(node.id);

      if (prev && prev.type !== 'organizer' &&
          prevData?.isRenaming === isRenaming &&
          prevData?.dimmed === dimmed &&
          (prev as unknown as { _baseRef: unknown })._baseRef === node) {
        newCache.set(node.id, prev);
        return prev;
      }

      const newNode = {
        ...node,
        dragHandle: NODE_DRAG_HANDLE,
        _baseRef: node,
        data: {
          ...node.data,
          nodeId: node.id,
          isRenaming,
          dimmed,
          nodeActions,
        },
      } as CartaNode;
      newCache.set(node.id, newNode);
      return newNode;
    });

    prevNodesCache.current = newCache;
    return result;
  }, [nodesWithHiddenFlags, childCountMap, organizerIds, renamingNodeId, renamingOrganizerId, nodeActions, isTraceActive, traceResult, orgRenameStart, orgRenameStop]);

  // Sort nodes: parents must come before their children (React Flow requirement)
  const sortedNodes = useMemo(() => {
    const result: CartaNode[] = [];
    const added = new Set<string>();
    const nodeById = new globalThis.Map(nodesWithCallbacks.map(n => [n.id, n] as [string, CartaNode]));

    // Recursive function to add a node and its ancestors first
    const addNode = (node: CartaNode, depth = 0) => {
      if (added.has(node.id) || depth > 20) return;

      // If this node has a parent, add the parent first
      if (node.parentId && !added.has(node.parentId)) {
        const parent = nodeById.get(node.parentId);
        if (parent) addNode(parent, depth + 1);
      }

      added.add(node.id);
      result.push(node);
    };

    // Add all nodes, ensuring parent-first ordering
    for (const node of nodesWithCallbacks) {
      addNode(node);
    }

    // Filter by search text if present
    if (!searchText?.trim()) return result;

    const lowerSearch = searchText.toLowerCase();
    return result.filter((node) => {
      // Organizers always show if any children match
      if (node.type === 'organizer') return true;

      // Only filter construct nodes - type guard
      if (!('constructType' in node.data) || !('semanticId' in node.data) || !('values' in node.data)) {
        return true;
      }

      const constructType = node.data.constructType as string;
      const semanticId = node.data.semanticId as string;
      const values = node.data.values as ConstructValues;

      const schema = getSchema(constructType);
      if (!schema) {
        // Schema-less constructs: match on constructType and semanticId only
        if (constructType.toLowerCase().includes(lowerSearch)) return true;
        if (semanticId?.toLowerCase().includes(lowerSearch)) return true;
        return false;
      }

      // Match against semantic ID
      if (semanticId?.toLowerCase().includes(lowerSearch)) return true;

      // Match against display name (derived from pill field or semanticId)
      const pillField = schema.fields.find(f => f.displayTier === 'pill');
      if (pillField) {
        const pillValue = String(values[pillField.name] || '');
        if (pillValue.toLowerCase().includes(lowerSearch)) return true;
      }

      // Match against any field values
      for (const field of schema.fields) {
        const value = String(values[field.name] || '');
        if (value.toLowerCase().includes(lowerSearch)) return true;
      }

      return false;
    });
  }, [nodesWithCallbacks, searchText, getSchema]);

  return {
    sortedNodes,
    organizerIds,
    processedNodes: nodesWithHiddenFlags as CartaNode[],
    edgeRemap,
  };
}
