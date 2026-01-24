import type { Node, Edge } from '@xyflow/react';
import type { ConstructNodeData, ConstructSchema, Deployable } from '../../constructs/types';

/**
 * Document adapter interface for abstracting persistence layer.
 * Currently implemented with localStorage, future: Yjs Y.Doc
 */
export interface DocumentAdapter {
  // Load/save lifecycle
  initialize(): Promise<void>;
  dispose(): void;

  // State access - Graph
  getNodes(): Node[];
  getEdges(): Edge[];
  getTitle(): string;

  // State access - Schemas
  getSchemas(): ConstructSchema[];
  getSchema(type: string): ConstructSchema | undefined;

  // State access - Deployables
  getDeployables(): Deployable[];
  getDeployable(id: string): Deployable | undefined;

  // Mutations - Graph (will become Y.Doc transactions in Yjs)
  setNodes(nodes: Node[] | ((prev: Node[]) => Node[])): void;
  setEdges(edges: Edge[] | ((prev: Edge[]) => Edge[])): void;
  setTitle(title: string): void;
  generateNodeId(): string;
  updateNode(nodeId: string, updates: Partial<ConstructNodeData>): void;

  // Mutations - Schemas
  setSchemas(schemas: ConstructSchema[]): void;
  addSchema(schema: ConstructSchema): void;
  updateSchema(type: string, updates: Partial<ConstructSchema>): void;
  removeSchema(type: string): boolean;

  // Mutations - Deployables
  setDeployables(deployables: Deployable[]): void;
  addDeployable(deployable: Omit<Deployable, 'id'>): Deployable;
  updateDeployable(id: string, updates: Partial<Deployable>): void;
  removeDeployable(id: string): boolean;

  // Batched operations (for Yjs transact)
  transaction<T>(fn: () => T): T;

  // Subscriptions for observing changes
  subscribe(listener: () => void): () => void;
}

/**
 * Options for creating an adapter
 */
export interface AdapterOptions {
  storageKey?: string;
}
