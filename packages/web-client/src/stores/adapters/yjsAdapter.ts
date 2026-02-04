import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Node, Edge } from '@xyflow/react';
import type {
  DocumentAdapter,
  CartaDocumentV4,
  ConstructSchema,
  ConstructNodeData,
  Deployable,
  PortSchema,
  SchemaGroup,
  Level,
  VisualGroup,
} from '@carta/domain';
import {
  objectToYMap,
  yMapToObject,
  generateDeployableId,
  generateDeployableColor,
  generateSchemaGroupId,
  generateLevelId,
  generateVisualGroupId,
  migrateToLevels,
  migrateToVisualGroups,
} from '@carta/document';
import { updateDocumentMetadata } from '../documentRegistry';

/**
 * Options for creating a Yjs adapter
 */
export interface YjsAdapterOptions {
  mode: 'local' | 'shared';
  roomId?: string;
  serverUrl?: string;
  /** Skip IndexedDB persistence (for testing) */
  skipPersistence?: boolean;
}

/**
 * Y.Doc structure (v4 with levels):
 * {
 *   'meta': Y.Map { version, title, description, activeLevel, initialized, migrationVersion }
 *   'levels': Y.Map<levelId, Y.Map { id, name, description, order }>
 *   'nodes': Y.Map<levelId, Y.Map<nodeId, Y.Map>>       // Nested: level → nodes
 *   'edges': Y.Map<levelId, Y.Map<edgeId, Y.Map>>       // Nested: level → edges
 *   'deployables': Y.Map<levelId, Y.Map<depId, Y.Map>>   // Nested: level → deployables
 *   'visualGroups': Y.Map<levelId, Y.Map<groupId, Y.Map>> // Nested: level → visual groups (use '__metamap__' for schema groups)
 *   'schemas': Y.Map<type, Y.Map>                        // Shared (unchanged)
 *   'portSchemas': Y.Map<id, Y.Map>                      // Shared (unchanged)
 *   'schemaGroups': Y.Map<id, Y.Map>                     // Shared (unchanged)
 * }
 */

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
  const ylevels = ydoc.getMap<Y.Map<unknown>>('levels');
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const ydeployables = ydoc.getMap<Y.Map<unknown>>('deployables');
  const yportSchemas = ydoc.getMap<Y.Map<unknown>>('portSchemas');
  const yschemaGroups = ydoc.getMap<Y.Map<unknown>>('schemaGroups');
  const yvisualGroups = ydoc.getMap<Y.Map<unknown>>('visualGroups');

  // Persistence
  let indexeddbProvider: IndexeddbPersistence | null = null;
  let wsProvider: unknown = null; // Will be WebsocketProvider when connected
  let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

  // Listeners for subscriptions
  const listeners = new Set<() => void>();

  // Track whether observers have been set up (to avoid unobserving before setup)
  let observersSetUp = false;
  let registrySyncSetUp = false;

  // Notify all listeners of changes
  const notifyListeners = () => {
    listeners.forEach((listener) => listener());
  };

  // Set up Y.Doc observers
  const setupObservers = () => {
    ymeta.observeDeep(notifyListeners);
    ylevels.observeDeep(notifyListeners);
    ynodes.observeDeep(notifyListeners);
    yedges.observeDeep(notifyListeners);
    yschemas.observeDeep(notifyListeners);
    ydeployables.observeDeep(notifyListeners);
    yportSchemas.observeDeep(notifyListeners);
    yschemaGroups.observeDeep(notifyListeners);
    yvisualGroups.observeDeep(notifyListeners);
    observersSetUp = true;
  };

  // Debounced registry metadata sync (2s, leading edge)
  let registryTimer: ReturnType<typeof setTimeout> | null = null;
  let registryPending = false;
  const syncRegistryMetadata = () => {
    if (!roomId || options.skipPersistence) return;
    if (registryTimer && !registryPending) {
      // Leading edge already fired, just mark pending for trailing
      registryPending = true;
      return;
    }
    if (!registryTimer) {
      // Leading edge: fire immediately
      doRegistrySync();
      registryTimer = setTimeout(() => {
        registryTimer = null;
        if (registryPending) {
          registryPending = false;
          doRegistrySync();
        }
      }, 2000);
    }
  };
  const doRegistrySync = () => {
    const title = (ymeta.get('title') as string) || 'Untitled Project';
    const levelNodes = getActiveLevelNodes();
    let nodeCount = 0;
    levelNodes.forEach(() => { nodeCount++; });
    updateDocumentMetadata(roomId!, { title, nodeCount }).catch(() => {
      // Best-effort — don't break the app if registry update fails
    });
  };
  const setupRegistrySync = () => {
    if (!roomId || options.skipPersistence) return;
    ymeta.observe(syncRegistryMetadata);
    ynodes.observeDeep(syncRegistryMetadata);
    registrySyncSetUp = true;
  };

  /**
   * Get the active level ID, falling back to first level
   */
  function getActiveLevelId(): string | undefined {
    const active = ymeta.get('activeLevel') as string | undefined;
    if (active && ylevels.has(active)) return active;
    // Fall back to first level by order
    let firstId: string | undefined;
    let firstOrder = Infinity;
    ylevels.forEach((ylevel, id) => {
      const order = ylevel.get('order') as number;
      if (order < firstOrder) {
        firstOrder = order;
        firstId = id;
      }
    });
    return firstId;
  }

  /**
   * Get the Y.Map for nodes of the active level
   */
  function getActiveLevelNodes(): Y.Map<Y.Map<unknown>> {
    const levelId = getActiveLevelId();
    if (!levelId) {
      // Return empty map if no levels exist
      return new Y.Map<Y.Map<unknown>>();
    }
    let levelNodes = ynodes.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
    if (!levelNodes) {
      levelNodes = new Y.Map<Y.Map<unknown>>();
      ynodes.set(levelId, levelNodes as unknown as Y.Map<unknown>);
    }
    return levelNodes;
  }

  /**
   * Get the Y.Map for edges of the active level
   */
  function getActiveLevelEdges(): Y.Map<Y.Map<unknown>> {
    const levelId = getActiveLevelId();
    if (!levelId) {
      return new Y.Map<Y.Map<unknown>>();
    }
    let levelEdges = yedges.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
    if (!levelEdges) {
      levelEdges = new Y.Map<Y.Map<unknown>>();
      yedges.set(levelId, levelEdges as unknown as Y.Map<unknown>);
    }
    return levelEdges;
  }

  /**
   * Get the Y.Map for deployables of the active level
   */
  function getActiveLevelDeployables(): Y.Map<Y.Map<unknown>> {
    const levelId = getActiveLevelId();
    if (!levelId) {
      return new Y.Map<Y.Map<unknown>>();
    }
    let levelDeployables = ydeployables.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
    if (!levelDeployables) {
      levelDeployables = new Y.Map<Y.Map<unknown>>();
      ydeployables.set(levelId, levelDeployables as unknown as Y.Map<unknown>);
    }
    return levelDeployables;
  }

  // Initialize with default values if empty
  const initializeDefaults = () => {
    ydoc.transact(() => {
      if (!ymeta.has('version')) {
        ymeta.set('version', 4);
      }
      if (!ymeta.has('title')) {
        ymeta.set('title', 'Untitled Project');
      }
      if (mode === 'shared' && roomId && !ymeta.has('roomId')) {
        ymeta.set('roomId', roomId);
      }

      // Migrate flat data to levels if needed
      migrateToLevels(ydoc);

      // Migrate deployables and schemaGroups to visualGroups
      migrateToVisualGroups(ydoc);

      // Ensure at least one level exists
      if (ylevels.size === 0) {
        const levelId = generateLevelId();
        const levelData = new Y.Map<unknown>();
        levelData.set('id', levelId);
        levelData.set('name', 'Main');
        levelData.set('order', 0);
        ylevels.set(levelId, levelData);
        ymeta.set('activeLevel', levelId);
      }
    }, 'init');
  };

  const adapter: DocumentAdapter & {
    ydoc: Y.Doc;
    connectToRoom: (roomId: string, serverUrl: string) => Promise<void>;
    disconnectFromRoom: () => void;
  } = {
    ydoc,

    async initialize(): Promise<void> {
      // Set up IndexedDB persistence (unless skipped for testing)
      if (!options.skipPersistence) {
        const dbName = roomId ? `carta-doc-${roomId}` : 'carta-local';
        const SYNC_TIMEOUT_MS = 10_000;

        const createAndSync = () => {
          const provider = new IndexeddbPersistence(dbName, ydoc);
          const syncPromise = new Promise<void>((resolve, reject) => {
            if (provider.synced) {
              resolve();
              return;
            }
            const timeout = setTimeout(() => {
              reject(new Error(`IndexedDB sync timed out for "${dbName}"`));
            }, SYNC_TIMEOUT_MS);
            provider.on('synced', () => {
              clearTimeout(timeout);
              resolve();
            });
          });
          return { provider, syncPromise };
        };

        const deleteDB = () =>
          new Promise<void>((resolve) => {
            const req = indexedDB.deleteDatabase(dbName);
            req.onsuccess = () => resolve();
            req.onerror = () => resolve(); // best-effort
            req.onblocked = () => resolve();
          });

        // y-indexeddb has fire-and-forget internal promises that surface as
        // unhandled rejections when the DB is corrupt. Capture them so we can
        // detect corruption and suppress console noise.
        let idbError: DOMException | null = null;
        const handleRejection = (e: PromiseRejectionEvent) => {
          if (e.reason instanceof DOMException) {
            idbError = e.reason as DOMException;
            e.preventDefault();
          }
        };
        window.addEventListener('unhandledrejection', handleRejection);

        try {
          const { provider, syncPromise } = createAndSync();
          indexeddbProvider = provider;
          await syncPromise;
        } catch {
          // Sync timed out — likely corrupt DB (synced event never fired)
          console.warn(`IndexedDB sync failed for "${dbName}", clearing and retrying`);
          if (indexeddbProvider) {
            (indexeddbProvider as any)._destroyed = true;
            try { indexeddbProvider.doc.off('update', (indexeddbProvider as any)._storeUpdate); } catch { /* noop */ }
          }
          await deleteDB();
          const { provider, syncPromise } = createAndSync();
          indexeddbProvider = provider;
          await syncPromise;
        } finally {
          window.removeEventListener('unhandledrejection', handleRejection);
          // TS narrows idbError to 'never' because assignment happens in event handler
          const capturedError = idbError as DOMException | null;
          if (capturedError) {
            console.warn('Recovered from IndexedDB corruption:', capturedError.message);
          }
        }
      }

      // Initialize defaults after loading from IndexedDB
      initializeDefaults();

      // Set up observers
      setupObservers();

      // Set up debounced registry metadata sync for local documents
      setupRegistrySync();
      // Initial sync to ensure registry has current metadata
      if (roomId && !options.skipPersistence) {
        doRegistrySync();
      }
    },

    dispose(): void {
      // Clean up registry sync (only if it was set up)
      if (registryTimer) {
        clearTimeout(registryTimer);
        registryTimer = null;
      }
      if (registrySyncSetUp) {
        ymeta.unobserve(syncRegistryMetadata);
        ynodes.unobserveDeep(syncRegistryMetadata);
      }

      // Unobserve all (only if they were set up)
      if (observersSetUp) {
        ymeta.unobserveDeep(notifyListeners);
        ylevels.unobserveDeep(notifyListeners);
        ynodes.unobserveDeep(notifyListeners);
        yedges.unobserveDeep(notifyListeners);
        yschemas.unobserveDeep(notifyListeners);
        ydeployables.unobserveDeep(notifyListeners);
        yportSchemas.unobserveDeep(notifyListeners);
        yschemaGroups.unobserveDeep(notifyListeners);
        yvisualGroups.unobserveDeep(notifyListeners);
      }

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

    // State access - Graph (reads from active level)
    getNodes(): Node[] {
      const levelNodes = getActiveLevelNodes();
      const nodes: Node[] = [];
      levelNodes.forEach((ynode, id) => {
        const nodeObj = yMapToObject<Node>(ynode);
        nodes.push({ ...nodeObj, id });
      });
      return nodes;
    },

    getEdges(): Edge[] {
      const levelEdges = getActiveLevelEdges();
      const edges: Edge[] = [];
      levelEdges.forEach((yedge, id) => {
        const edgeObj = yMapToObject<Edge>(yedge);
        edges.push({ ...edgeObj, id });
      });
      return edges;
    },

    getTitle(): string {
      return (ymeta.get('title') as string) || 'Untitled Project';
    },

    getDescription(): string {
      return (ymeta.get('description') as string) || '';
    },

    // State access - Levels
    getLevels(): Level[] {
      const levels: Level[] = [];
      ylevels.forEach((ylevel) => {
        const level = yMapToObject<Level>(ylevel);
        // Populate nodes/edges/deployables from their respective maps
        const levelId = level.id;
        const levelNodesMap = ynodes.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
        const levelEdgesMap = yedges.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
        const levelDeployablesMap = ydeployables.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;

        const nodes: unknown[] = [];
        levelNodesMap?.forEach((ynode, id) => {
          nodes.push({ ...yMapToObject<Node>(ynode), id });
        });

        const edges: unknown[] = [];
        levelEdgesMap?.forEach((yedge, id) => {
          edges.push({ ...yMapToObject<Edge>(yedge), id });
        });

        const deployables: Deployable[] = [];
        levelDeployablesMap?.forEach((ydep) => {
          deployables.push(yMapToObject<Deployable>(ydep));
        });

        levels.push({ ...level, nodes, edges, deployables });
      });
      return levels.sort((a, b) => a.order - b.order);
    },

    getLevel(id: string): Level | undefined {
      const ylevel = ylevels.get(id);
      if (!ylevel) return undefined;
      const level = yMapToObject<Level>(ylevel);

      const levelNodesMap = ynodes.get(id) as Y.Map<Y.Map<unknown>> | undefined;
      const levelEdgesMap = yedges.get(id) as Y.Map<Y.Map<unknown>> | undefined;
      const levelDeployablesMap = ydeployables.get(id) as Y.Map<Y.Map<unknown>> | undefined;

      const nodes: unknown[] = [];
      levelNodesMap?.forEach((ynode, nid) => {
        nodes.push({ ...yMapToObject<Node>(ynode), id: nid });
      });

      const edges: unknown[] = [];
      levelEdgesMap?.forEach((yedge, eid) => {
        edges.push({ ...yMapToObject<Edge>(yedge), id: eid });
      });

      const deployables: Deployable[] = [];
      levelDeployablesMap?.forEach((ydep) => {
        deployables.push(yMapToObject<Deployable>(ydep));
      });

      return { ...level, nodes, edges, deployables };
    },

    getActiveLevel(): string | undefined {
      return getActiveLevelId();
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

    // State access - Deployables (reads from active level)
    getDeployables(): Deployable[] {
      const levelDeployables = getActiveLevelDeployables();
      const deployables: Deployable[] = [];
      levelDeployables.forEach((ydeployable) => {
        deployables.push(yMapToObject<Deployable>(ydeployable));
      });
      return deployables;
    },

    getDeployable(id: string): Deployable | undefined {
      const levelDeployables = getActiveLevelDeployables();
      const ydeployable = levelDeployables.get(id) as Y.Map<unknown> | undefined;
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

    // State access - Schema Groups
    getSchemaGroups(): SchemaGroup[] {
      const groups: SchemaGroup[] = [];
      yschemaGroups.forEach((ygroup) => {
        groups.push(yMapToObject<SchemaGroup>(ygroup));
      });
      return groups;
    },

    getSchemaGroup(id: string): SchemaGroup | undefined {
      const ygroup = yschemaGroups.get(id);
      if (!ygroup) return undefined;
      return yMapToObject<SchemaGroup>(ygroup);
    },

    // Mutations - Graph (writes to active level)
    setNodes(nodesOrUpdater) {
      ydoc.transact(() => {
        const newNodes =
          typeof nodesOrUpdater === 'function'
            ? nodesOrUpdater(adapter.getNodes())
            : nodesOrUpdater;

        const levelNodes = getActiveLevelNodes();
        levelNodes.clear();
        for (const node of newNodes as Node[]) {
          const { id, ...rest } = node;
          levelNodes.set(id, objectToYMap(rest as Record<string, unknown>));
        }
      }, 'user');
    },

    setEdges(edgesOrUpdater) {
      ydoc.transact(() => {
        const newEdges =
          typeof edgesOrUpdater === 'function'
            ? edgesOrUpdater(adapter.getEdges())
            : edgesOrUpdater;

        const levelEdges = getActiveLevelEdges();
        levelEdges.clear();
        for (const edge of newEdges as Edge[]) {
          const { id, ...rest } = edge;
          levelEdges.set(id, objectToYMap(rest as Record<string, unknown>));
        }
      }, 'user');
    },

    setTitle(title: string) {
      ydoc.transact(() => {
        ymeta.set('title', title);
      }, 'user');
    },

    setDescription(description: string) {
      ydoc.transact(() => {
        ymeta.set('description', description);
      }, 'user');
    },

    generateNodeId(): string {
      return crypto.randomUUID();
    },

    updateNode(nodeId: string, updates: Partial<ConstructNodeData>) {
      ydoc.transact(() => {
        const levelNodes = getActiveLevelNodes();
        const ynode = levelNodes.get(nodeId) as Y.Map<unknown> | undefined;
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
          levelNodes.forEach((otherYnode, otherId) => {
            if (otherId === nodeId) return;
            const otherData = (otherYnode as Y.Map<unknown>).get('data') as ConstructNodeData | undefined;
            if (!otherData?.connections?.length) return;

            const updatedConnections = otherData.connections.map((conn) =>
              conn.targetSemanticId === oldSemanticId
                ? { ...conn, targetSemanticId: updates.semanticId! }
                : conn
            );

            if (updatedConnections.some((c, i) => c !== otherData.connections![i])) {
              (otherYnode as Y.Map<unknown>).set('data', { ...otherData, connections: updatedConnections });
            }
          });
        }
      }, 'user');
    },

    // Mutations - Levels
    setActiveLevel(levelId: string) {
      if (!ylevels.has(levelId)) return;
      ydoc.transact(() => {
        ymeta.set('activeLevel', levelId);
      }, 'user');
    },

    createLevel(name: string, description?: string): Level {
      const id = generateLevelId();
      // Find max order
      let maxOrder = -1;
      ylevels.forEach((ylevel) => {
        const order = ylevel.get('order') as number;
        if (order > maxOrder) maxOrder = order;
      });

      const newLevel: Level = {
        id,
        name,
        description,
        order: maxOrder + 1,
        nodes: [],
        edges: [],
        deployables: [],
      };

      ydoc.transact(() => {
        const ylevel = new Y.Map<unknown>();
        ylevel.set('id', id);
        ylevel.set('name', name);
        if (description) ylevel.set('description', description);
        ylevel.set('order', maxOrder + 1);
        ylevels.set(id, ylevel);

        // Create empty maps for the level's data
        ynodes.set(id, new Y.Map<Y.Map<unknown>>() as unknown as Y.Map<unknown>);
        yedges.set(id, new Y.Map<Y.Map<unknown>>() as unknown as Y.Map<unknown>);
        ydeployables.set(id, new Y.Map<Y.Map<unknown>>() as unknown as Y.Map<unknown>);
      }, 'user');

      return newLevel;
    },

    deleteLevel(levelId: string): boolean {
      if (!ylevels.has(levelId)) return false;
      // Don't allow deleting the last level
      if (ylevels.size <= 1) return false;

      ydoc.transact(() => {
        ylevels.delete(levelId);
        ynodes.delete(levelId);
        yedges.delete(levelId);
        ydeployables.delete(levelId);

        // If deleting the active level, switch to another
        const activeLevel = ymeta.get('activeLevel') as string | undefined;
        if (activeLevel === levelId) {
          const newActive = getActiveLevelId();
          if (newActive) {
            ymeta.set('activeLevel', newActive);
          }
        }
      }, 'user');

      return true;
    },

    updateLevel(levelId: string, updates: Partial<Omit<Level, 'id' | 'nodes' | 'edges' | 'deployables'>>) {
      ydoc.transact(() => {
        const ylevel = ylevels.get(levelId);
        if (!ylevel) return;
        if (updates.name !== undefined) ylevel.set('name', updates.name);
        if (updates.description !== undefined) ylevel.set('description', updates.description);
        if (updates.order !== undefined) ylevel.set('order', updates.order);
      }, 'user');
    },

    duplicateLevel(levelId: string, newName: string): Level {
      const sourceLevel = ylevels.get(levelId);
      if (!sourceLevel) throw new Error(`Level ${levelId} not found`);

      const newId = generateLevelId();
      let maxOrder = -1;
      ylevels.forEach((ylevel) => {
        const order = ylevel.get('order') as number;
        if (order > maxOrder) maxOrder = order;
      });

      ydoc.transact(() => {
        // Create level metadata
        const ylevel = new Y.Map<unknown>();
        ylevel.set('id', newId);
        ylevel.set('name', newName);
        const desc = sourceLevel.get('description');
        if (desc) ylevel.set('description', desc);
        ylevel.set('order', maxOrder + 1);
        ylevels.set(newId, ylevel);

        // Deep-copy nodes with new IDs
        const sourceNodes = ynodes.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
        const newNodesMap = new Y.Map<Y.Map<unknown>>();
        const idMap: Record<string, string> = {};

        if (sourceNodes) {
          sourceNodes.forEach((ynode, oldId) => {
            const newNodeId = crypto.randomUUID();
            idMap[oldId] = newNodeId;
            const nodeData = yMapToObject<Record<string, unknown>>(ynode);
            newNodesMap.set(newNodeId, objectToYMap(nodeData));
          });
        }
        ynodes.set(newId, newNodesMap as unknown as Y.Map<unknown>);

        // Deep-copy edges with remapped source/target
        const sourceEdges = yedges.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
        const newEdgesMap = new Y.Map<Y.Map<unknown>>();
        if (sourceEdges) {
          sourceEdges.forEach((yedge) => {
            const edgeData = yMapToObject<Record<string, unknown>>(yedge);
            const newEdgeId = `edge-${Math.random()}`;
            edgeData.source = idMap[edgeData.source as string] || edgeData.source;
            edgeData.target = idMap[edgeData.target as string] || edgeData.target;
            newEdgesMap.set(newEdgeId, objectToYMap(edgeData));
          });
        }
        yedges.set(newId, newEdgesMap as unknown as Y.Map<unknown>);

        // Deep-copy deployables
        const sourceDeployables = ydeployables.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
        const newDeployablesMap = new Y.Map<Y.Map<unknown>>();
        if (sourceDeployables) {
          sourceDeployables.forEach((ydep, depId) => {
            const depData = yMapToObject<Record<string, unknown>>(ydep);
            newDeployablesMap.set(depId, objectToYMap(depData));
          });
        }
        ydeployables.set(newId, newDeployablesMap as unknown as Y.Map<unknown>);
      }, 'user');

      return adapter.getLevel(newId)!;
    },

    copyNodesToLevel(nodeIds: string[], targetLevelId: string) {
      if (!ylevels.has(targetLevelId)) return;
      const sourceNodes = getActiveLevelNodes();
      const sourceEdges = getActiveLevelEdges();

      ydoc.transact(() => {
        let targetNodesMap = ynodes.get(targetLevelId) as Y.Map<Y.Map<unknown>> | undefined;
        if (!targetNodesMap) {
          targetNodesMap = new Y.Map<Y.Map<unknown>>();
          ynodes.set(targetLevelId, targetNodesMap as unknown as Y.Map<unknown>);
        }
        let targetEdgesMap = yedges.get(targetLevelId) as Y.Map<Y.Map<unknown>> | undefined;
        if (!targetEdgesMap) {
          targetEdgesMap = new Y.Map<Y.Map<unknown>>();
          yedges.set(targetLevelId, targetEdgesMap as unknown as Y.Map<unknown>);
        }

        const nodeIdSet = new Set(nodeIds);
        const idMap: Record<string, string> = {};

        // Copy nodes with new IDs
        for (const nodeId of nodeIds) {
          const ynode = sourceNodes.get(nodeId) as Y.Map<unknown> | undefined;
          if (!ynode) continue;
          const newId = crypto.randomUUID();
          idMap[nodeId] = newId;
          const nodeData = yMapToObject<Record<string, unknown>>(ynode);
          targetNodesMap!.set(newId, objectToYMap(nodeData));
        }

        // Copy edges between copied nodes
        sourceEdges.forEach((yedge) => {
          const source = (yedge as Y.Map<unknown>).get('source') as string;
          const target = (yedge as Y.Map<unknown>).get('target') as string;
          if (nodeIdSet.has(source) && nodeIdSet.has(target)) {
            const edgeData = yMapToObject<Record<string, unknown>>(yedge as Y.Map<unknown>);
            edgeData.source = idMap[source] || source;
            edgeData.target = idMap[target] || target;
            const newEdgeId = `edge-${Math.random()}`;
            targetEdgesMap!.set(newEdgeId, objectToYMap(edgeData));
          }
        });
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

    // Mutations - Deployables (writes to active level)
    setDeployables(deployables: Deployable[]) {
      ydoc.transact(() => {
        const levelDeployables = getActiveLevelDeployables();
        levelDeployables.clear();
        for (const d of deployables) {
          levelDeployables.set(d.id, objectToYMap(d as unknown as Record<string, unknown>));
        }
      }, 'user');
    },

    addDeployable(deployable: Omit<Deployable, 'id'>): Deployable {
      const id = generateDeployableId();
      const color = deployable.color || generateDeployableColor();
      const newDeployable: Deployable = { ...deployable, id, color };
      ydoc.transact(() => {
        const levelDeployables = getActiveLevelDeployables();
        levelDeployables.set(id, objectToYMap(newDeployable as unknown as Record<string, unknown>));
      }, 'user');
      return newDeployable;
    },

    updateDeployable(id: string, updates: Partial<Deployable>) {
      ydoc.transact(() => {
        const levelDeployables = getActiveLevelDeployables();
        const ydeployable = levelDeployables.get(id) as Y.Map<unknown> | undefined;
        if (!ydeployable) return;
        const current = yMapToObject<Deployable>(ydeployable);
        levelDeployables.set(id, objectToYMap({ ...current, ...updates } as unknown as Record<string, unknown>));
      }, 'user');
    },

    removeDeployable(id: string): boolean {
      const levelDeployables = getActiveLevelDeployables();
      const exists = levelDeployables.has(id);
      if (exists) {
        ydoc.transact(() => {
          levelDeployables.delete(id);
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

    // Mutations - Schema Groups
    setSchemaGroups(groups: SchemaGroup[]) {
      ydoc.transact(() => {
        yschemaGroups.clear();
        for (const group of groups) {
          yschemaGroups.set(group.id, objectToYMap(group as unknown as Record<string, unknown>));
        }
      }, 'user');
    },

    addSchemaGroup(group: Omit<SchemaGroup, 'id'>): SchemaGroup {
      const id = generateSchemaGroupId();
      const newGroup: SchemaGroup = { ...group, id };
      ydoc.transact(() => {
        yschemaGroups.set(id, objectToYMap(newGroup as unknown as Record<string, unknown>));
      }, 'user');
      return newGroup;
    },

    updateSchemaGroup(id: string, updates: Partial<SchemaGroup>) {
      ydoc.transact(() => {
        const ygroup = yschemaGroups.get(id);
        if (!ygroup) return;
        const current = yMapToObject<SchemaGroup>(ygroup);
        yschemaGroups.set(id, objectToYMap({ ...current, ...updates } as unknown as Record<string, unknown>));
      }, 'user');
    },

    removeSchemaGroup(id: string): boolean {
      const exists = yschemaGroups.has(id);
      if (exists) {
        ydoc.transact(() => {
          // Clear groupId from schemas that reference this group
          yschemas.forEach((yschema, schemaType) => {
            const schema = yMapToObject<ConstructSchema>(yschema);
            if (schema.groupId === id) {
              yschemas.set(schemaType, objectToYMap({ ...schema, groupId: undefined } as unknown as Record<string, unknown>));
            }
          });
          // Clear groupId from port schemas that reference this group
          yportSchemas.forEach((yportSchema, portId) => {
            const portSchema = yMapToObject<PortSchema>(yportSchema);
            if (portSchema.groupId === id) {
              yportSchemas.set(portId, objectToYMap({ ...portSchema, groupId: undefined } as unknown as Record<string, unknown>));
            }
          });
          yschemaGroups.delete(id);
        }, 'user');
      }
      return exists;
    },

    // State access - Visual Groups (level-scoped)
    getVisualGroups(levelId: string): VisualGroup[] {
      const levelGroups = yvisualGroups.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
      if (!levelGroups) return [];
      const groups: VisualGroup[] = [];
      levelGroups.forEach((ygroup) => {
        groups.push(yMapToObject<VisualGroup>(ygroup));
      });
      return groups;
    },

    getVisualGroup(levelId: string, id: string): VisualGroup | undefined {
      const levelGroups = yvisualGroups.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
      if (!levelGroups) return undefined;
      const ygroup = levelGroups.get(id) as Y.Map<unknown> | undefined;
      if (!ygroup) return undefined;
      return yMapToObject<VisualGroup>(ygroup);
    },

    // Mutations - Visual Groups
    addVisualGroup(levelId: string, group: Omit<VisualGroup, 'id'>): VisualGroup {
      const id = generateVisualGroupId();
      const newGroup: VisualGroup = { ...group, id };
      ydoc.transact(() => {
        let levelGroups = yvisualGroups.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
        if (!levelGroups) {
          levelGroups = new Y.Map<Y.Map<unknown>>();
          yvisualGroups.set(levelId, levelGroups as unknown as Y.Map<unknown>);
        }
        levelGroups.set(id, objectToYMap(newGroup as unknown as Record<string, unknown>));
      }, 'user');
      return newGroup;
    },

    updateVisualGroup(levelId: string, id: string, updates: Partial<VisualGroup>) {
      ydoc.transact(() => {
        const levelGroups = yvisualGroups.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
        if (!levelGroups) return;
        const ygroup = levelGroups.get(id) as Y.Map<unknown> | undefined;
        if (!ygroup) return;
        const current = yMapToObject<VisualGroup>(ygroup);
        levelGroups.set(id, objectToYMap({ ...current, ...updates } as unknown as Record<string, unknown>));
      }, 'user');
    },

    removeVisualGroup(levelId: string, id: string): boolean {
      const levelGroups = yvisualGroups.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
      if (!levelGroups) return false;
      const exists = levelGroups.has(id);
      if (exists) {
        ydoc.transact(() => {
          // Clear groupId from nodes in this level that reference this group
          const levelNodes = ynodes.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
          if (levelNodes) {
            levelNodes.forEach((ynode) => {
              const data = (ynode as Y.Map<unknown>).get('data') as ConstructNodeData | undefined;
              if (data?.groupId === id) {
                (ynode as Y.Map<unknown>).set('data', { ...data, groupId: undefined });
              }
            });
          }
          // Clear parentGroupId from child groups
          levelGroups.forEach((ygroup, groupId) => {
            const group = yMapToObject<VisualGroup>(ygroup);
            if (group.parentGroupId === id) {
              levelGroups.set(groupId, objectToYMap({ ...group, parentGroupId: undefined } as unknown as Record<string, unknown>));
            }
          });
          levelGroups.delete(id);
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

    toJSON(): CartaDocumentV4 {
      const levels = adapter.getLevels();
      return {
        version: 4,
        title: adapter.getTitle(),
        description: adapter.getDescription(),
        levels,
        activeLevel: getActiveLevelId(),
        schemas: adapter.getSchemas(),
        portSchemas: adapter.getPortSchemas(),
        schemaGroups: adapter.getSchemaGroups(),
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

  return adapter;
}
