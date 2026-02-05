import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { Node, Edge } from '@xyflow/react';
import type {
  DocumentAdapter,
  CartaDocumentV4,
  ConstructSchema,
  ConstructNodeData,
  PortSchema,
  SchemaGroup,
  Level,
} from '@carta/domain';
import {
  objectToYMap,
  yMapToObject,
  generateSchemaGroupId,
  generateLevelId,
  migrateToLevels,
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
 *   'nodes': Y.Map<levelId, Y.Map<nodeId, Y.Map>>       // Nested: level → nodes (includes organizer type nodes)
 *   'edges': Y.Map<levelId, Y.Map<edgeId, Y.Map>>       // Nested: level → edges
 *   'schemas': Y.Map<type, Y.Map>                        // Shared (unchanged)
 *   'portSchemas': Y.Map<id, Y.Map>                      // Shared (unchanged)
 *   'schemaGroups': Y.Map<id, Y.Map>                     // Shared (unchanged)
 * }
 *
 * Organizers are stored as regular nodes with type='organizer'.
 * Child nodes use React Flow's native parentId for relative positioning and organizer movement.
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
  const yportSchemas = ydoc.getMap<Y.Map<unknown>>('portSchemas');
  const yschemaGroups = ydoc.getMap<Y.Map<unknown>>('schemaGroups');

  // Persistence
  let indexeddbProvider: IndexeddbPersistence | null = null;
  let wsProvider: unknown = null; // Will be WebsocketProvider when connected
  let connectionStatus: 'disconnected' | 'connecting' | 'connected' = 'disconnected';

  // Track disposal state to abort initialization if disposed mid-flight
  let isDisposed = false;
  // Track active sync timeout so we can cancel it on dispose
  let activeSyncTimeout: ReturnType<typeof setTimeout> | null = null;

  // Listeners for subscriptions
  const listeners = new Set<() => void>();

  // Granular listener sets for focused hooks
  const nodeListeners = new Set<() => void>();
  const edgeListeners = new Set<() => void>();
  const schemaListeners = new Set<() => void>();
  const portSchemaListeners = new Set<() => void>();
  const schemaGroupListeners = new Set<() => void>();
  const levelListeners = new Set<() => void>();
  const metaListeners = new Set<() => void>();

  const notifyNodeListeners = () => nodeListeners.forEach((cb) => cb());
  const notifyEdgeListeners = () => edgeListeners.forEach((cb) => cb());
  const notifySchemaListeners = () => schemaListeners.forEach((cb) => cb());
  const notifyPortSchemaListeners = () => portSchemaListeners.forEach((cb) => cb());
  const notifySchemaGroupListeners = () => schemaGroupListeners.forEach((cb) => cb());
  const notifyLevelListeners = () => levelListeners.forEach((cb) => cb());
  const notifyMetaListeners = () => metaListeners.forEach((cb) => cb());

  // Track whether observers have been set up (to avoid unobserving before setup)
  let observersSetUp = false;
  let registrySyncSetUp = false;

  // Notify all listeners of changes
  const notifyListeners = () => {
    listeners.forEach((listener) => listener());
  };

  // Observer callbacks for granular notifications
  const onMetaChange = () => {
    notifyMetaListeners();
    notifyLevelListeners();
    // Active level change affects level-scoped data
    notifyNodeListeners();
    notifyEdgeListeners();
    notifyListeners();
  };
  const onLevelsChange = () => {
    notifyLevelListeners();
    notifyListeners();
  };
  const onNodesChange = () => {
    notifyNodeListeners();
    notifyListeners();
  };
  const onEdgesChange = () => {
    notifyEdgeListeners();
    notifyListeners();
  };
  const onSchemasChange = () => {
    notifySchemaListeners();
    notifyListeners();
  };
  const onPortSchemasChange = () => {
    notifyPortSchemaListeners();
    notifyListeners();
  };
  const onSchemaGroupsChange = () => {
    notifySchemaGroupListeners();
    notifyListeners();
  };

  // Set up Y.Doc observers
  const setupObservers = () => {
    ymeta.observeDeep(onMetaChange);
    ylevels.observeDeep(onLevelsChange);
    ynodes.observeDeep(onNodesChange);
    yedges.observeDeep(onEdgesChange);
    yschemas.observeDeep(onSchemasChange);
    yportSchemas.observeDeep(onPortSchemasChange);
    yschemaGroups.observeDeep(onSchemaGroupsChange);
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
            activeSyncTimeout = setTimeout(() => {
              activeSyncTimeout = null;
              reject(new Error(`IndexedDB sync timed out for "${dbName}"`));
            }, SYNC_TIMEOUT_MS);
            provider.on('synced', () => {
              if (activeSyncTimeout) {
                clearTimeout(activeSyncTimeout);
                activeSyncTimeout = null;
              }
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
          // Check if disposed while awaiting sync (React StrictMode cleanup)
          if (isDisposed) {
            return;
          }
        } catch {
          // Check if disposed - bail out immediately (timeout may have fired after disposal)
          if (isDisposed) {
            return;
          }
          // Sync timed out — likely corrupt DB (synced event never fired)
          console.warn(`IndexedDB sync failed for "${dbName}", clearing and retrying`);
          const oldProvider = indexeddbProvider;
          indexeddbProvider = null; // Clear reference first to prevent further writes
          if (oldProvider) {
            // Wrap the storeUpdate to catch closed-database errors during cleanup
            const originalStoreUpdate = (oldProvider as any)._storeUpdate;
            if (originalStoreUpdate) {
              (oldProvider as any)._storeUpdate = () => {
                // No-op: database is being cleaned up
              };
            }
            // Now safely destroy
            try {
              oldProvider.destroy();
            } catch {
              // Best-effort cleanup
            }
          }
          await deleteDB();
          // Check if disposed while awaiting deleteDB
          if (isDisposed) {
            return;
          }
          const { provider, syncPromise } = createAndSync();
          indexeddbProvider = provider;
          await syncPromise;
          // Check if disposed while awaiting retry sync
          if (isDisposed) {
            return;
          }
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
      // Mark as disposed to abort any in-flight initialization
      isDisposed = true;

      // Cancel any pending sync timeout (prevents timeout firing after disposal)
      if (activeSyncTimeout) {
        clearTimeout(activeSyncTimeout);
        activeSyncTimeout = null;
      }

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
        ymeta.unobserveDeep(onMetaChange);
        ylevels.unobserveDeep(onLevelsChange);
        ynodes.unobserveDeep(onNodesChange);
        yedges.unobserveDeep(onEdgesChange);
        yschemas.unobserveDeep(onSchemasChange);
        yportSchemas.unobserveDeep(onPortSchemasChange);
        yschemaGroups.unobserveDeep(onSchemaGroupsChange);
      }

      // Clear all granular listener sets
      nodeListeners.clear();
      edgeListeners.clear();
      schemaListeners.clear();
      portSchemaListeners.clear();
      schemaGroupListeners.clear();
      levelListeners.clear();
      metaListeners.clear();
      listeners.clear();

      // Clean up providers
      if (indexeddbProvider) {
        indexeddbProvider.destroy();
        indexeddbProvider = null;
      }
      if (wsProvider) {
        (wsProvider as { destroy: () => void }).destroy();
        wsProvider = null;
      }

      // Destroy Y.Doc to unsubscribe all listeners (including y-indexeddb's internal ones)
      // This is critical: y-indexeddb doesn't unsubscribe on destroy(), so we must destroy the doc
      ydoc.destroy();
    },

    // State access - Graph (reads from active level)
    getNodes(): Node[] {
      const levelNodes = getActiveLevelNodes();
      const nodes: Node[] = [];
      levelNodes.forEach((ynode, id) => {
        const { extent: _extent, ...nodeObj } = yMapToObject<Node & { extent?: string }>(ynode);
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
        // Populate nodes/edges from their respective maps
        const levelId = level.id;
        const levelNodesMap = ynodes.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;
        const levelEdgesMap = yedges.get(levelId) as Y.Map<Y.Map<unknown>> | undefined;

        const nodes: unknown[] = [];
        levelNodesMap?.forEach((ynode, id) => {
          nodes.push({ ...yMapToObject<Node>(ynode), id });
        });

        const edges: unknown[] = [];
        levelEdgesMap?.forEach((yedge, id) => {
          edges.push({ ...yMapToObject<Edge>(yedge), id });
        });

        levels.push({ ...level, nodes, edges });
      });
      return levels.sort((a, b) => a.order - b.order);
    },

    getLevel(id: string): Level | undefined {
      const ylevel = ylevels.get(id);
      if (!ylevel) return undefined;
      const level = yMapToObject<Level>(ylevel);

      const levelNodesMap = ynodes.get(id) as Y.Map<Y.Map<unknown>> | undefined;
      const levelEdgesMap = yedges.get(id) as Y.Map<Y.Map<unknown>> | undefined;

      const nodes: unknown[] = [];
      levelNodesMap?.forEach((ynode, nid) => {
        nodes.push({ ...yMapToObject<Node>(ynode), id: nid });
      });

      const edges: unknown[] = [];
      levelEdgesMap?.forEach((yedge, eid) => {
        edges.push({ ...yMapToObject<Edge>(yedge), id: eid });
      });

      return { ...level, nodes, edges };
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

    // Granular subscriptions for focused hooks
    subscribeToNodes(listener: () => void): () => void {
      nodeListeners.add(listener);
      return () => nodeListeners.delete(listener);
    },

    subscribeToEdges(listener: () => void): () => void {
      edgeListeners.add(listener);
      return () => edgeListeners.delete(listener);
    },

    subscribeToSchemas(listener: () => void): () => void {
      schemaListeners.add(listener);
      return () => schemaListeners.delete(listener);
    },

    subscribeToPortSchemas(listener: () => void): () => void {
      portSchemaListeners.add(listener);
      return () => portSchemaListeners.delete(listener);
    },

    subscribeToSchemaGroups(listener: () => void): () => void {
      schemaGroupListeners.add(listener);
      return () => schemaGroupListeners.delete(listener);
    },

    subscribeToLevels(listener: () => void): () => void {
      levelListeners.add(listener);
      return () => levelListeners.delete(listener);
    },

    subscribeToMeta(listener: () => void): () => void {
      metaListeners.add(listener);
      return () => metaListeners.delete(listener);
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
