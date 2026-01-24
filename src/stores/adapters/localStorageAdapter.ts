import type { Node, Edge } from '@xyflow/react';
import type { DocumentAdapter, AdapterOptions } from './types';
import type { ConstructSchema, Deployable } from '../../constructs/types';
import { useDocumentStore, getDocumentState } from '../documentStore';

/**
 * localStorage-based document adapter.
 * Wraps the Zustand store for persistence.
 *
 * Future Yjs adapter will have same interface but use Y.Doc internally.
 */
export function createLocalStorageAdapter(_options: AdapterOptions = {}): DocumentAdapter {
  // Note: storageKey is handled by the Zustand store itself
  let unsubscribe: (() => void) | null = null;

  return {
    async initialize(): Promise<void> {
      // Load is handled by store initialization
      // In Yjs, this would connect to the room
    },

    dispose(): void {
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    },

    // State access - Graph
    getNodes(): Node[] {
      return getDocumentState().nodes;
    },

    getEdges(): Edge[] {
      return getDocumentState().edges;
    },

    getTitle(): string {
      return getDocumentState().title;
    },

    // State access - Schemas
    getSchemas(): ConstructSchema[] {
      return getDocumentState().schemas;
    },

    getSchema(type: string): ConstructSchema | undefined {
      return getDocumentState().getSchema(type);
    },

    // State access - Deployables
    getDeployables(): Deployable[] {
      return getDocumentState().deployables;
    },

    getDeployable(id: string): Deployable | undefined {
      return getDocumentState().getDeployable(id);
    },

    // Mutations - Graph
    setNodes(nodesOrUpdater) {
      getDocumentState().setNodes(nodesOrUpdater);
    },

    setEdges(edgesOrUpdater) {
      getDocumentState().setEdges(edgesOrUpdater);
    },

    setTitle(title) {
      getDocumentState().setTitle(title);
    },

    generateNodeId(): string {
      return getDocumentState().getNextNodeId();
    },

    updateNode(nodeId, updates) {
      getDocumentState().updateNode(nodeId, updates);
    },

    // Mutations - Schemas
    setSchemas(schemas) {
      getDocumentState().setSchemas(schemas);
    },

    addSchema(schema) {
      getDocumentState().addSchema(schema);
    },

    updateSchema(type, updates) {
      getDocumentState().updateSchema(type, updates);
    },

    removeSchema(type) {
      return getDocumentState().removeSchema(type);
    },

    // Mutations - Deployables
    setDeployables(deployables) {
      getDocumentState().setDeployables(deployables);
    },

    addDeployable(deployable) {
      return getDocumentState().addDeployable(deployable);
    },

    updateDeployable(id, updates) {
      getDocumentState().updateDeployable(id, updates);
    },

    removeDeployable(id) {
      return getDocumentState().removeDeployable(id);
    },

    transaction<T>(fn: () => T): T {
      // localStorage adapter doesn't need transactions
      // Yjs adapter would wrap this in Y.Doc.transact()
      return fn();
    },

    subscribe(listener): () => void {
      unsubscribe = useDocumentStore.subscribe(listener);
      return () => {
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
      };
    },
  };
}
