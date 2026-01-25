import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Node, Edge } from '@xyflow/react';
import type { DocumentAdapter } from './types';
import type {
  CartaDocument,
  ConstructSchema,
  ConstructNodeData,
  Deployable,
  PortSchema,
} from '../../constructs/types';
import { DEFAULT_PORT_SCHEMAS } from '../../constructs/portRegistry';

/**
 * Options for creating a Yjs adapter
 */
export interface YjsAdapterOptions {
  mode: 'local' | 'shared';
  roomId?: string;
  serverUrl?: string;
}

/**
 * Y.Doc structure:
 * {
 *   'meta': Y.Map { version, title, roomId? }
 *   'nodes': Y.Map<nodeId, Y.Map>      // O(1) by UUID
 *   'edges': Y.Map<edgeId, Y.Map>      // O(1) by ID
 *   'schemas': Y.Map<type, Y.Map>      // O(1) by type
 *   'deployables': Y.Map<id, Y.Map>
 *   'portSchemas': Y.Map<id, Y.Map>
 * }
 */

/**
 * Convert a plain object to a Y.Map (shallow)
 */
function objectToYMap(obj: object): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(obj)) {
    ymap.set(key, value);
  }
  return ymap;
}

/**
 * Convert a Y.Map to a plain object (shallow)
 */
function yMapToObject<T>(ymap: Y.Map<unknown>): T {
  const obj: Record<string, unknown> = {};
  ymap.forEach((value, key) => {
    obj[key] = value;
  });
  return obj as T;
}

/**
 * Generate a deployable ID
 */
function generateDeployableId(): string {
  return 'dep_' + Math.random().toString(36).substring(2, 11);
}

/**
 * Generate a color for deployable visualization
 */
function generateDeployableColor(): string {
  const colors = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#ec4899', // pink
    '#6b7280', // gray
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Yjs-based document adapter for collaborative editing.
 *
 * Modes:
 * - 'local': Y.Doc + y-indexeddb (static deployment, no server)
 * - 'shared': Y.Doc + y-websocket + y-indexeddb (requires WebSocket server)
 */
export function createYjsAdapter(options: YjsAdapterOptions): DocumentAdapter & {
  ydoc: Y.Doc;
  connectToRoom: (roomId: string, serverUrl: string) => Promise<void>;
  disconnectFromRoom: () => void;
} {
  const { mode, roomId } = options;

  // Create Y.Doc
  const ydoc = new Y.Doc();

  // Get shared types
  const ymeta = ydoc.getMap('meta');
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const ydeployables = ydoc.getMap<Y.Map<unknown>>('deployables');
  const yportSchemas = ydoc.getMap<Y.Map<unknown>>('portSchemas');

  // Persistence
  let indexeddbProvider: IndexeddbPersistence | null = null;
  let wsProvider: unknown = null; // Will be WebsocketProvider when connected
  let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

  // Listeners for subscriptions
  const listeners = new Set<() => void>();

  // Notify all listeners of changes
  const notifyListeners = () => {
    listeners.forEach((listener) => listener());
  };

  // Set up Y.Doc observers
  const setupObservers = () => {
    ymeta.observeDeep(notifyListeners);
    ynodes.observeDeep(notifyListeners);
    yedges.observeDeep(notifyListeners);
    yschemas.observeDeep(notifyListeners);
    ydeployables.observeDeep(notifyListeners);
    yportSchemas.observeDeep(notifyListeners);
  };

  // Initialize with default values if empty
  const initializeDefaults = () => {
    ydoc.transact(() => {
      if (!ymeta.has('version')) {
        ymeta.set('version', 3);
      }
      if (!ymeta.has('title')) {
        ymeta.set('title', 'Untitled Project');
      }
      if (mode === 'shared' && roomId && !ymeta.has('roomId')) {
        ymeta.set('roomId', roomId);
      }

      // Initialize default port schemas if none exist
      if (yportSchemas.size === 0) {
        for (const ps of DEFAULT_PORT_SCHEMAS) {
          yportSchemas.set(ps.id, objectToYMap(ps));
        }
      }
    }, 'init');
  };

  return {
    ydoc,

    async initialize(): Promise<void> {
      // Set up IndexedDB persistence
      const dbName = roomId || 'carta-local';
      indexeddbProvider = new IndexeddbPersistence(dbName, ydoc);

      // Wait for initial sync
      await new Promise<void>((resolve) => {
        if (indexeddbProvider!.synced) {
          resolve();
        } else {
          indexeddbProvider!.on('synced', () => resolve());
        }
      });

      // Initialize defaults after loading from IndexedDB
      initializeDefaults();

      // Set up observers
      setupObservers();
    },

    dispose(): void {
      // Unobserve all
      ymeta.unobserveDeep(notifyListeners);
      ynodes.unobserveDeep(notifyListeners);
      yedges.unobserveDeep(notifyListeners);
      yschemas.unobserveDeep(notifyListeners);
      ydeployables.unobserveDeep(notifyListeners);
      yportSchemas.unobserveDeep(notifyListeners);

      // Clean up providers
      if (indexeddbProvider) {
        indexeddbProvider.destroy();
        indexeddbProvider = null;
      }
      if (wsProvider) {
        (wsProvider as { destroy: () => void }).destroy();
        wsProvider = null;
      }

      ydoc.destroy();
    },

    // State access - Graph
    getNodes(): Node[] {
      const nodes: Node[] = [];
      ynodes.forEach((ynode, id) => {
        const nodeObj = yMapToObject<Node>(ynode);
        nodes.push({ ...nodeObj, id });
      });
      return nodes;
    },

    getEdges(): Edge[] {
      const edges: Edge[] = [];
      yedges.forEach((yedge, id) => {
        const edgeObj = yMapToObject<Edge>(yedge);
        edges.push({ ...edgeObj, id });
      });
      return edges;
    },

    getTitle(): string {
      return (ymeta.get('title') as string) || 'Untitled Project';
    },

    // State access - Schemas
    getSchemas(): ConstructSchema[] {
      const schemas: ConstructSchema[] = [];
      yschemas.forEach((yschema) => {
        schemas.push(yMapToObject<ConstructSchema>(yschema));
      });
      return schemas;
    },

    getSchema(type: string): ConstructSchema | undefined {
      const yschema = yschemas.get(type);
      if (!yschema) return undefined;
      return yMapToObject<ConstructSchema>(yschema);
    },

    // State access - Deployables
    getDeployables(): Deployable[] {
      const deployables: Deployable[] = [];
      ydeployables.forEach((ydeployable) => {
        deployables.push(yMapToObject<Deployable>(ydeployable));
      });
      return deployables;
    },

    getDeployable(id: string): Deployable | undefined {
      const ydeployable = ydeployables.get(id);
      if (!ydeployable) return undefined;
      return yMapToObject<Deployable>(ydeployable);
    },

    // State access - Port Schemas
    getPortSchemas(): PortSchema[] {
      const schemas: PortSchema[] = [];
      yportSchemas.forEach((yschema) => {
        schemas.push(yMapToObject<PortSchema>(yschema));
      });
      return schemas;
    },

    getPortSchema(id: string): PortSchema | undefined {
      const yschema = yportSchemas.get(id);
      if (!yschema) return undefined;
      return yMapToObject<PortSchema>(yschema);
    },

    // Mutations - Graph
    setNodes(nodesOrUpdater) {
      ydoc.transact(() => {
        const newNodes =
          typeof nodesOrUpdater === 'function'
            ? nodesOrUpdater(this.getNodes())
            : nodesOrUpdater;

        // Clear existing and add new
        ynodes.clear();
        for (const node of newNodes as Node[]) {
          const { id, ...rest } = node;
          ynodes.set(id, objectToYMap(rest as Record<string, unknown>));
        }
      }, 'user');
    },

    setEdges(edgesOrUpdater) {
      ydoc.transact(() => {
        const newEdges =
          typeof edgesOrUpdater === 'function'
            ? edgesOrUpdater(this.getEdges())
            : edgesOrUpdater;

        // Clear existing and add new
        yedges.clear();
        for (const edge of newEdges as Edge[]) {
          const { id, ...rest } = edge;
          yedges.set(id, objectToYMap(rest as Record<string, unknown>));
        }
      }, 'user');
    },

    setTitle(title: string) {
      ydoc.transact(() => {
        ymeta.set('title', title);
      }, 'user');
    },

    generateNodeId(): string {
      return crypto.randomUUID();
    },

    updateNode(nodeId: string, updates: Partial<ConstructNodeData>) {
      ydoc.transact(() => {
        const ynode = ynodes.get(nodeId);
        if (!ynode) return;

        // Handle semantic ID changes - need to update connections in other nodes
        const oldSemanticId = updates.semanticId
          ? (ynode.get('data') as Record<string, unknown>)?.semanticId as string | undefined
          : undefined;

        // Update the target node
        const currentData = (ynode.get('data') as Record<string, unknown>) || {};
        ynode.set('data', { ...currentData, ...updates });

        // If semantic ID changed, update references in other nodes
        if (oldSemanticId && updates.semanticId) {
          ynodes.forEach((otherYnode, otherId) => {
            if (otherId === nodeId) return;
            const otherData = otherYnode.get('data') as ConstructNodeData | undefined;
            if (!otherData?.connections?.length) return;

            const updatedConnections = otherData.connections.map((conn) =>
              conn.targetSemanticId === oldSemanticId
                ? { ...conn, targetSemanticId: updates.semanticId! }
                : conn
            );

            if (updatedConnections.some((c, i) => c !== otherData.connections![i])) {
              otherYnode.set('data', { ...otherData, connections: updatedConnections });
            }
          });
        }
      }, 'user');
    },

    // Mutations - Schemas
    setSchemas(schemas: ConstructSchema[]) {
      ydoc.transact(() => {
        yschemas.clear();
        for (const schema of schemas) {
          yschemas.set(schema.type, objectToYMap(schema as unknown as Record<string, unknown>));
        }
      }, 'user');
    },

    addSchema(schema: ConstructSchema) {
      ydoc.transact(() => {
        yschemas.set(schema.type, objectToYMap(schema as unknown as Record<string, unknown>));
      }, 'user');
    },

    updateSchema(type: string, updates: Partial<ConstructSchema>) {
      ydoc.transact(() => {
        const yschema = yschemas.get(type);
        if (!yschema) return;
        const current = yMapToObject<ConstructSchema>(yschema);
        yschemas.set(type, objectToYMap({ ...current, ...updates } as unknown as Record<string, unknown>));
      }, 'user');
    },

    removeSchema(type: string): boolean {
      const exists = yschemas.has(type);
      if (exists) {
        ydoc.transact(() => {
          yschemas.delete(type);
        }, 'user');
      }
      return exists;
    },

    // Mutations - Deployables
    setDeployables(deployables: Deployable[]) {
      ydoc.transact(() => {
        ydeployables.clear();
        for (const d of deployables) {
          ydeployables.set(d.id, objectToYMap(d as unknown as Record<string, unknown>));
        }
      }, 'user');
    },

    addDeployable(deployable: Omit<Deployable, 'id'>): Deployable {
      const id = generateDeployableId();
      const color = deployable.color || generateDeployableColor();
      const newDeployable: Deployable = { ...deployable, id, color };
      ydoc.transact(() => {
        ydeployables.set(id, objectToYMap(newDeployable as unknown as Record<string, unknown>));
      }, 'user');
      return newDeployable;
    },

    updateDeployable(id: string, updates: Partial<Deployable>) {
      ydoc.transact(() => {
        const ydeployable = ydeployables.get(id);
        if (!ydeployable) return;
        const current = yMapToObject<Deployable>(ydeployable);
        ydeployables.set(id, objectToYMap({ ...current, ...updates } as unknown as Record<string, unknown>));
      }, 'user');
    },

    removeDeployable(id: string): boolean {
      const exists = ydeployables.has(id);
      if (exists) {
        ydoc.transact(() => {
          ydeployables.delete(id);
        }, 'user');
      }
      return exists;
    },

    // Mutations - Port Schemas
    setPortSchemas(schemas: PortSchema[]) {
      ydoc.transact(() => {
        yportSchemas.clear();
        for (const schema of schemas) {
          yportSchemas.set(schema.id, objectToYMap(schema as unknown as Record<string, unknown>));
        }
      }, 'user');
    },

    addPortSchema(schema: PortSchema) {
      ydoc.transact(() => {
        yportSchemas.set(schema.id, objectToYMap(schema as unknown as Record<string, unknown>));
      }, 'user');
    },

    updatePortSchema(id: string, updates: Partial<PortSchema>) {
      ydoc.transact(() => {
        const yschema = yportSchemas.get(id);
        if (!yschema) return;
        const current = yMapToObject<PortSchema>(yschema);
        yportSchemas.set(id, objectToYMap({ ...current, ...updates } as unknown as Record<string, unknown>));
      }, 'user');
    },

    removePortSchema(id: string): boolean {
      const exists = yportSchemas.has(id);
      if (exists) {
        ydoc.transact(() => {
          yportSchemas.delete(id);
        }, 'user');
      }
      return exists;
    },

    // Transaction with origin for MCP attribution
    transaction<T>(fn: () => T, origin: string = 'user'): T {
      let result: T;
      ydoc.transact(() => {
        result = fn();
      }, origin);
      return result!;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    toJSON(): CartaDocument {
      return {
        version: (ymeta.get('version') as number) || 3,
        title: this.getTitle(),
        nodes: this.getNodes(),
        edges: this.getEdges(),
        schemas: this.getSchemas(),
        deployables: this.getDeployables(),
        portSchemas: this.getPortSchemas(),
      };
    },

    getConnectionStatus(): 'disconnected' | 'connecting' | 'connected' {
      return connectionStatus;
    },

    getConnectedClients(): number {
      // Will be implemented when WebSocket is connected
      return wsProvider ? 1 : 0;
    },

    // WebSocket connection methods
    async connectToRoom(newRoomId: string, serverUrl: string): Promise<void> {
      if (wsProvider) {
        (wsProvider as { destroy: () => void }).destroy();
      }

      connectionStatus = 'connecting';
      notifyListeners();

      // Dynamic import to avoid bundling y-websocket in local mode
      const { WebsocketProvider } = await import('y-websocket');
      wsProvider = new WebsocketProvider(serverUrl, newRoomId, ydoc);

      // Update connection status based on WebSocket state
      const ws = wsProvider as { on: (event: string, cb: () => void) => void };
      ws.on('sync', () => {
        connectionStatus = 'connected';
        notifyListeners();
      });

      // Store room ID in meta
      ydoc.transact(() => {
        ymeta.set('roomId', newRoomId);
      }, 'system');
    },

    disconnectFromRoom(): void {
      if (wsProvider) {
        (wsProvider as { destroy: () => void }).destroy();
        wsProvider = null;
        connectionStatus = 'disconnected';
        notifyListeners();
      }
    },
  };
}
