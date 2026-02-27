import * as Y from 'yjs';
import { IndexeddbPersistence } from 'y-indexeddb';
import type { CartaNode, CartaEdge } from '@carta/types';
import type {
  DocumentAdapter,
  CartaDocumentV4,
  ConstructSchema,
  ConstructNodeData,
  PortSchema,
  SchemaGroup,
  SchemaPackage,
  SchemaRelationship,
  PackageManifestEntry,
  Page,
  SpecGroup,
  SpecGroupItem,
} from '@carta/schema';
import {
  objectToYMap,
  yMapToObject,
  generateSchemaGroupId,
  generateSchemaPackageId,
  generatePageId,
  generateSpecGroupId,
  migrateToPages,
  migrateGroupsToPackages,
  migrateSchemaRelationships,
  deepPlainToY,
  updateSchema as updateSchemaOp,
  WORKSPACE_CANVAS_PAGE_ID,
} from '@carta/document';
import { updateDocumentMetadata } from '../documentRegistry';

/**
 * Workspace canvas mode schema injection payload.
 * Schemas are read-only in workspace mode; all mutation methods are no-ops.
 */
export interface WorkspaceCanvasSchemas {
  schemas: ConstructSchema[];
  portSchemas: PortSchema[];
  schemaGroups: SchemaGroup[];
  schemaRelationships: SchemaRelationship[];
  schemaPackages: SchemaPackage[];
  packageManifest: PackageManifestEntry[];
}

/**
 * Options for creating a Yjs adapter
 */
export interface YjsAdapterOptions {
  mode: 'local' | 'shared';
  roomId?: string;
  syncUrl?: string;
  /** Skip IndexedDB persistence (for testing) */
  skipPersistence?: boolean;
  /** Skip default page creation — set when the adapter will sync with a server that provides initial state */
  deferDefaultPage?: boolean;
  /**
   * Workspace canvas mode: schemas injected from server, no IndexedDB,
   * page/schema mutation methods are no-ops.
   */
  workspaceCanvas?: WorkspaceCanvasSchemas;
}

/**
 * Y.Doc structure (v4 with pages):
 * {
 *   'meta': Y.Map { version, title, description, activePage, initialized, migrationVersion }
 *   'pages': Y.Map<pageId, Y.Map { id, name, description, order }>
 *   'nodes': Y.Map<pageId, Y.Map<nodeId, Y.Map>>       // Nested: page → nodes (includes organizer type nodes)
 *   'edges': Y.Map<pageId, Y.Map<edgeId, Y.Map>>       // Nested: page → edges
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
  connectToRoom: (roomId: string, syncUrl: string) => Promise<void>;
  disconnectFromRoom: () => void;
} {
  const { mode, roomId } = options;

  // Create Y.Doc
  const ydoc = new Y.Doc();

  // Get shared types
  const ymeta = ydoc.getMap('meta');
  const ypages = ydoc.getMap<Y.Map<unknown>>('pages');
  const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
  const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
  const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
  const yportSchemas = ydoc.getMap<Y.Map<unknown>>('portSchemas');
  const yschemaGroups = ydoc.getMap<Y.Map<unknown>>('schemaGroups');
  const yschemaPackages = ydoc.getMap<Y.Map<unknown>>('schemaPackages');
  const yschemaRelationships = ydoc.getMap<Y.Map<unknown>>('schemaRelationships');
  const ypackageManifest = ydoc.getMap<Y.Map<unknown>>('packageManifest');
  const yspecGroups = ydoc.getMap<Y.Map<unknown>>('specGroups');

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
  const schemaPackageListeners = new Set<() => void>();
  const schemaRelationshipListeners = new Set<() => void>();
  const packageManifestListeners = new Set<() => void>();
  const pageListeners = new Set<() => void>();
  const metaListeners = new Set<() => void>();
  const specGroupListeners = new Set<() => void>();

  const notifyNodeListeners = () => nodeListeners.forEach((cb) => cb());
  const notifyEdgeListeners = () => edgeListeners.forEach((cb) => cb());
  const notifySchemaListeners = () => schemaListeners.forEach((cb) => cb());
  const notifyPortSchemaListeners = () => portSchemaListeners.forEach((cb) => cb());
  const notifySchemaGroupListeners = () => schemaGroupListeners.forEach((cb) => cb());
  const notifySchemaPackageListeners = () => schemaPackageListeners.forEach((cb) => cb());
  const notifySchemaRelationshipListeners = () => schemaRelationshipListeners.forEach((cb) => cb());
  const notifyPageListeners = () => pageListeners.forEach((cb) => cb());
  const notifyMetaListeners = () => metaListeners.forEach((cb) => cb());
  const notifySpecGroupListeners = () => specGroupListeners.forEach((cb) => cb());

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
    notifyPageListeners();
    // Active page change affects page-scoped data
    notifyNodeListeners();
    notifyEdgeListeners();
    notifyListeners();
  };
  const onPagesChange = () => {
    notifyPageListeners();
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
  const onSchemaPackagesChange = () => {
    notifySchemaPackageListeners();
    notifyListeners();
  };
  const onSchemaRelationshipsChange = () => {
    notifySchemaRelationshipListeners();
    notifyListeners();
  };
  const onPackageManifestChange = () => {
    listeners.forEach((l) => l());
    packageManifestListeners.forEach((l) => l());
  };
  const onSpecGroupsChange = () => {
    notifySpecGroupListeners();
    notifyListeners();
  };

  // Set up Y.Doc observers
  const setupObservers = () => {
    ymeta.observeDeep(onMetaChange);
    ypages.observeDeep(onPagesChange);
    ynodes.observeDeep(onNodesChange);
    yedges.observeDeep(onEdgesChange);
    yschemas.observeDeep(onSchemasChange);
    yportSchemas.observeDeep(onPortSchemasChange);
    yschemaGroups.observeDeep(onSchemaGroupsChange);
    yschemaPackages.observeDeep(onSchemaPackagesChange);
    yschemaRelationships.observeDeep(onSchemaRelationshipsChange);
    ypackageManifest.observeDeep(onPackageManifestChange);
    yspecGroups.observeDeep(onSpecGroupsChange);
    observersSetUp = true;
  };

  // Debounced registry metadata sync (2s, leading edge)
  let registryTimer: ReturnType<typeof setTimeout> | null = null;
  let registryPending = false;
  const syncRegistryMetadata = () => {
    if (!roomId || options.skipPersistence || options.workspaceCanvas) return;
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
    const title = ymeta.get('title') as string | undefined;
    if (!title) return; // Don't sync with a fallback — wait for real title from server
    const pageNodes = getActivePageNodes();
    let nodeCount = 0;
    pageNodes?.forEach(() => { nodeCount++; });
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
   * Get the active page ID, falling back to first page
   */
  function getActivePageId(): string | undefined {
    const active = ymeta.get('activePage') as string | undefined;
    if (active && ypages.has(active)) return active;
    // Fall back to first page by order
    let firstId: string | undefined;
    let firstOrder = Infinity;
    ypages.forEach((ypage, id) => {
      const order = ypage.get('order') as number;
      if (order < firstOrder) {
        firstOrder = order;
        firstId = id;
      }
    });
    return firstId;
  }

  /**
   * Get the Y.Map for nodes of the active page.
   * Returns null when no page exists (e.g. before sync delivers initial state).
   */
  function getActivePageNodes(): Y.Map<Y.Map<unknown>> | null {
    const pageId = getActivePageId();
    if (!pageId) {
      return null;
    }
    let pageNodes = ynodes.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
    if (!pageNodes) {
      ydoc.transact(() => {
        pageNodes = new Y.Map<Y.Map<unknown>>();
        ynodes.set(pageId, pageNodes as unknown as Y.Map<unknown>);
      }, 'init');
      pageNodes = ynodes.get(pageId) as Y.Map<Y.Map<unknown>>;
    }
    return pageNodes ?? null;
  }

  /**
   * Get the Y.Map for edges of the active page.
   * Returns null when no page exists (e.g. before sync delivers initial state).
   */
  function getActivePageEdges(): Y.Map<Y.Map<unknown>> | null {
    const pageId = getActivePageId();
    if (!pageId) {
      return null;
    }
    let pageEdges = yedges.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
    if (!pageEdges) {
      ydoc.transact(() => {
        pageEdges = new Y.Map<Y.Map<unknown>>();
        yedges.set(pageId, pageEdges as unknown as Y.Map<unknown>);
      }, 'init');
      pageEdges = yedges.get(pageId) as Y.Map<Y.Map<unknown>>;
    }
    return pageEdges ?? null;
  }

  // Initialize with default values if empty
  const initializeDefaults = () => {
    // Workspace canvas mode: skip migrations, create the shim page if needed
    if (options.workspaceCanvas) {
      ydoc.transact(() => {
        if (!ymeta.has('version')) {
          ymeta.set('version', 4);
        }
        // Create the single synthetic canvas page if the Y.Doc is empty
        // (server hydration should have set this, but this is the safety net)
        if (ypages.size === 0) {
          const pageData = new Y.Map<unknown>();
          pageData.set('id', WORKSPACE_CANVAS_PAGE_ID);
          pageData.set('name', 'Canvas');
          pageData.set('order', 0);
          ypages.set(WORKSPACE_CANVAS_PAGE_ID, pageData);
          ymeta.set('activePage', WORKSPACE_CANVAS_PAGE_ID);
          console.debug('[workspace] Created shim canvas page in initializeDefaults');
        }
      }, 'init');
      return;
    }

    ydoc.transact(() => {
      if (!ymeta.has('version')) {
        ymeta.set('version', 4);
      }
      if (!ymeta.has('title') && !options.deferDefaultPage) {
        ymeta.set('title', 'Untitled Project');
      }
      if (mode === 'shared' && roomId && !ymeta.has('roomId')) {
        ymeta.set('roomId', roomId);
      }

      // Migrate flat data to pages if needed
      migrateToPages(ydoc);

      // Migrate top-level groups to packages if needed
      migrateGroupsToPackages(ydoc);

      // Migrate suggestedRelated to schemaRelationships if needed
      migrateSchemaRelationships(ydoc);

      // Ensure at least one page exists (skip when syncing — server provides initial state)
      if (ypages.size === 0 && !options.deferDefaultPage) {
        const pageId = generatePageId();
        const pageData = new Y.Map<unknown>();
        pageData.set('id', pageId);
        pageData.set('name', 'Main');
        pageData.set('order', 0);
        ypages.set(pageId, pageData);
        ymeta.set('activePage', pageId);
        console.debug('[pages] Created default Main page in initializeDefaults', { pageId, roomId, mode });
      } else {
        console.debug('[pages] initializeDefaults: skipped page creation', {
          count: ypages.size,
          deferDefaultPage: options.deferDefaultPage,
          ids: Array.from(ypages.keys()),
          roomId,
        });
      }
    }, 'init');
  };

  const adapter: DocumentAdapter & {
    ydoc: Y.Doc;
    connectToRoom: (roomId: string, syncUrl: string) => Promise<void>;
    disconnectFromRoom: () => void;
  } = {
    ydoc,

    async initialize(): Promise<void> {
      // Set up IndexedDB persistence (unless skipped for testing or workspace canvas mode)
      performance.mark('carta:indexeddb-start')
      if (!options.skipPersistence && !options.workspaceCanvas) {
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
      performance.mark('carta:indexeddb-ready')
      performance.measure('carta:indexeddb-hydration', 'carta:indexeddb-start', 'carta:indexeddb-ready')

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
        ypages.unobserveDeep(onPagesChange);
        ynodes.unobserveDeep(onNodesChange);
        yedges.unobserveDeep(onEdgesChange);
        yschemas.unobserveDeep(onSchemasChange);
        yportSchemas.unobserveDeep(onPortSchemasChange);
        yschemaGroups.unobserveDeep(onSchemaGroupsChange);
        yschemaPackages.unobserveDeep(onSchemaPackagesChange);
        yschemaRelationships.unobserveDeep(onSchemaRelationshipsChange);
        ypackageManifest.unobserveDeep(onPackageManifestChange);
        yspecGroups.unobserveDeep(onSpecGroupsChange);
      }

      // Clear all granular listener sets
      nodeListeners.clear();
      edgeListeners.clear();
      schemaListeners.clear();
      portSchemaListeners.clear();
      schemaGroupListeners.clear();
      schemaPackageListeners.clear();
      packageManifestListeners.clear();
      schemaRelationshipListeners.clear();
      pageListeners.clear();
      metaListeners.clear();
      specGroupListeners.clear();
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

    // State access - Graph (reads from active page)
    getNodes(): CartaNode[] {
      const pageNodes = getActivePageNodes();
      if (!pageNodes) return [];
      const nodes: CartaNode[] = [];
      pageNodes.forEach((ynode, id) => {
        const { extent: _extent, ...nodeObj } = yMapToObject<CartaNode & { extent?: string }>(ynode);
        nodes.push({ ...nodeObj, id });
      });
      return nodes;
    },

    getEdges(): CartaEdge[] {
      const pageEdges = getActivePageEdges();
      if (!pageEdges) return [];
      const edges: CartaEdge[] = [];
      pageEdges.forEach((yedge, id) => {
        const edgeObj = yMapToObject<CartaEdge>(yedge);
        edges.push({ ...edgeObj, id });
      });
      return edges;
    },

    getTitle(): string {
      if (options.workspaceCanvas) return '';
      return (ymeta.get('title') as string) || '';
    },

    getDescription(): string {
      if (options.workspaceCanvas) return '';
      return (ymeta.get('description') as string) || '';
    },

    // State access - Pages
    getPages(): Page[] {
      if (options.workspaceCanvas) {
        return [{ id: WORKSPACE_CANVAS_PAGE_ID, name: 'Canvas', order: 0, description: '', nodes: [], edges: [] }];
      }
      const pages: Page[] = [];
      ypages.forEach((ypage) => {
        const page = yMapToObject<Page>(ypage);
        // Populate nodes/edges from their respective maps
        const pageId = page.id;
        const pageNodesMap = ynodes.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
        const pageEdgesMap = yedges.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;

        const nodes: unknown[] = [];
        pageNodesMap?.forEach((ynode, id) => {
          nodes.push({ ...yMapToObject<CartaNode>(ynode), id });
        });

        const edges: unknown[] = [];
        pageEdgesMap?.forEach((yedge, id) => {
          edges.push({ ...yMapToObject<CartaEdge>(yedge), id });
        });

        pages.push({ ...page, nodes, edges });
      });
      return pages.sort((a, b) => a.order - b.order);
    },

    getPage(id: string): Page | undefined {
      const ypage = ypages.get(id);
      if (!ypage) return undefined;
      const page = yMapToObject<Page>(ypage);

      const pageNodesMap = ynodes.get(id) as Y.Map<Y.Map<unknown>> | undefined;
      const pageEdgesMap = yedges.get(id) as Y.Map<Y.Map<unknown>> | undefined;

      const nodes: unknown[] = [];
      pageNodesMap?.forEach((ynode, nid) => {
        nodes.push({ ...yMapToObject<CartaNode>(ynode), id: nid });
      });

      const edges: unknown[] = [];
      pageEdgesMap?.forEach((yedge, eid) => {
        edges.push({ ...yMapToObject<CartaEdge>(yedge), id: eid });
      });

      return { ...page, nodes, edges };
    },

    getActivePage(): string | undefined {
      if (options.workspaceCanvas) return WORKSPACE_CANVAS_PAGE_ID;
      return getActivePageId();
    },

    // State access - Schemas
    getSchemas(): ConstructSchema[] {
      if (options.workspaceCanvas) return options.workspaceCanvas.schemas;
      const schemas: ConstructSchema[] = [];
      yschemas.forEach((yschema) => {
        schemas.push(yMapToObject<ConstructSchema>(yschema));
      });
      return schemas;
    },

    getSchema(type: string): ConstructSchema | undefined {
      if (options.workspaceCanvas) return options.workspaceCanvas.schemas.find(s => s.type === type);
      const yschema = yschemas.get(type);
      if (!yschema) return undefined;
      return yMapToObject<ConstructSchema>(yschema);
    },

    // State access - Port Schemas
    getPortSchemas(): PortSchema[] {
      if (options.workspaceCanvas) return options.workspaceCanvas.portSchemas;
      const schemas: PortSchema[] = [];
      yportSchemas.forEach((yschema) => {
        schemas.push(yMapToObject<PortSchema>(yschema));
      });
      return schemas;
    },

    getPortSchema(id: string): PortSchema | undefined {
      if (options.workspaceCanvas) return options.workspaceCanvas.portSchemas.find(s => s.id === id);
      const yschema = yportSchemas.get(id);
      if (!yschema) return undefined;
      return yMapToObject<PortSchema>(yschema);
    },

    // State access - Schema Groups
    getSchemaGroups(): SchemaGroup[] {
      if (options.workspaceCanvas) return options.workspaceCanvas.schemaGroups;
      const groups: SchemaGroup[] = [];
      yschemaGroups.forEach((ygroup) => {
        groups.push(yMapToObject<SchemaGroup>(ygroup));
      });
      return groups;
    },

    getSchemaGroup(id: string): SchemaGroup | undefined {
      if (options.workspaceCanvas) return options.workspaceCanvas.schemaGroups.find(g => g.id === id);
      const ygroup = yschemaGroups.get(id);
      if (!ygroup) return undefined;
      return yMapToObject<SchemaGroup>(ygroup);
    },

    // State access - Schema Packages
    getSchemaPackages(): SchemaPackage[] {
      if (options.workspaceCanvas) return options.workspaceCanvas.schemaPackages;
      const packages: SchemaPackage[] = [];
      yschemaPackages.forEach((ypackage) => {
        packages.push(yMapToObject<SchemaPackage>(ypackage));
      });
      return packages;
    },

    getSchemaPackage(id: string): SchemaPackage | undefined {
      if (options.workspaceCanvas) return options.workspaceCanvas.schemaPackages.find(p => p.id === id);
      const ypackage = yschemaPackages.get(id);
      if (!ypackage) return undefined;
      return yMapToObject<SchemaPackage>(ypackage);
    },

    // State access - Package Manifest
    getPackageManifest(): PackageManifestEntry[] {
      if (options.workspaceCanvas) return options.workspaceCanvas.packageManifest;
      const entries: PackageManifestEntry[] = [];
      ypackageManifest.forEach((yentry) => {
        entries.push(yMapToObject<PackageManifestEntry>(yentry));
      });
      return entries;
    },

    getPackageManifestEntry(packageId: string): PackageManifestEntry | undefined {
      if (options.workspaceCanvas) return options.workspaceCanvas.packageManifest.find(e => e.packageId === packageId);
      const yentry = ypackageManifest.get(packageId);
      if (!yentry) return undefined;
      return yMapToObject<PackageManifestEntry>(yentry);
    },

    // Mutations - Graph (writes to active page)
    setNodes(nodesOrUpdater) {
      ydoc.transact(() => {
        const newNodes =
          typeof nodesOrUpdater === 'function'
            ? nodesOrUpdater(adapter.getNodes())
            : nodesOrUpdater;

        const pageNodes = getActivePageNodes();
        if (!pageNodes) return;
        pageNodes.clear();
        for (const node of newNodes as CartaNode[]) {
          const { id, ...rest } = node;
          pageNodes.set(id, objectToYMap(rest as Record<string, unknown>));
        }
      }, 'user');
    },

    setEdges(edgesOrUpdater) {
      ydoc.transact(() => {
        const newEdges =
          typeof edgesOrUpdater === 'function'
            ? edgesOrUpdater(adapter.getEdges())
            : edgesOrUpdater;

        const pageEdges = getActivePageEdges();
        if (!pageEdges) return;
        pageEdges.clear();
        for (const edge of newEdges as CartaEdge[]) {
          const { id, ...rest } = edge;
          pageEdges.set(id, objectToYMap(rest as Record<string, unknown>));
        }
      }, 'user');
    },

    setTitle(title: string) {
      if (options.workspaceCanvas) return;
      ydoc.transact(() => {
        ymeta.set('title', title);
      }, 'user');
    },

    setDescription(description: string) {
      if (options.workspaceCanvas) return;
      ydoc.transact(() => {
        ymeta.set('description', description);
      }, 'user');
    },

    generateNodeId(): string {
      return crypto.randomUUID();
    },

    updateNode(nodeId: string, updates: Partial<ConstructNodeData>) {
      ydoc.transact(() => {
        const pageNodes = getActivePageNodes();
        if (!pageNodes) return;
        const ynode = pageNodes.get(nodeId) as Y.Map<unknown> | undefined;
        if (!ynode) return;

        // Handle semantic ID changes - need to update connections in other nodes
        const oldSemanticId = updates.semanticId
          ? (ynode.get('data') as Record<string, unknown>)?.semanticId as string | undefined
          : undefined;

        // Update the target node
        const currentYData = ynode.get('data');
        if (currentYData instanceof Y.Map) {
          // Preserve Y.Map structure — merge updates into existing Y.Map
          for (const [key, value] of Object.entries(updates)) {
            if (value !== undefined) {
              currentYData.set(key, deepPlainToY(value));
            }
          }
        } else {
          // Fallback: data was already a plain object, write merged plain → Y.Map
          const currentData = (currentYData as Record<string, unknown>) || {};
          ynode.set('data', deepPlainToY({ ...currentData, ...updates }));
        }

        // If semantic ID changed, update references in other nodes
        if (oldSemanticId && updates.semanticId) {
          pageNodes.forEach((otherYnode, otherId) => {
            if (otherId === nodeId) return;
            const otherData = (otherYnode as Y.Map<unknown>).get('data') as ConstructNodeData | undefined;
            if (!otherData?.connections?.length) return;

            const updatedConnections = otherData.connections.map((conn) =>
              conn.targetSemanticId === oldSemanticId
                ? { ...conn, targetSemanticId: updates.semanticId! }
                : conn
            );

            if (updatedConnections.some((c, i) => c !== otherData.connections![i])) {
              const otherYData = (otherYnode as Y.Map<unknown>).get('data');
              if (otherYData instanceof Y.Map) {
                otherYData.set('connections', deepPlainToY(updatedConnections));
              } else {
                (otherYnode as Y.Map<unknown>).set('data', deepPlainToY({ ...otherData, connections: updatedConnections }));
              }
            }
          });
        }
      }, 'user');
    },

    patchNodes(patches: Array<{ id: string; position?: { x: number; y: number }; style?: Record<string, unknown> }>, origin?: string) {
      ydoc.transact(() => {
        const pageNodes = getActivePageNodes();
        if (!pageNodes) return;
        for (const { id, position, style } of patches) {
          const ynode = pageNodes.get(id) as Y.Map<unknown> | undefined;
          if (!ynode) continue;
          if (position) ynode.set('position', position);
          if (style) ynode.set('style', style);
        }
      }, origin ?? 'layout');
    },

    patchEdgeData(patches: Array<{ id: string; data: Record<string, unknown> }>) {
      ydoc.transact(() => {
        const pageEdges = getActivePageEdges();
        if (!pageEdges) return;
        for (const { id, data } of patches) {
          const yedge = pageEdges.get(id) as Y.Map<unknown> | undefined;
          if (!yedge) continue;
          for (const [key, value] of Object.entries(data)) {
            if (value === undefined || value === null) {
              yedge.delete(key);
            } else {
              yedge.set(key, value);
            }
          }
        }
      }, 'user');
    },

    // Mutations - Pages
    setActivePage(pageId: string) {
      if (options.workspaceCanvas) return;
      if (!ypages.has(pageId)) return;
      ydoc.transact(() => {
        ymeta.set('activePage', pageId);
      }, 'user');
    },

    createPage(name: string, description?: string): Page {
      if (options.workspaceCanvas) {
        return { id: WORKSPACE_CANVAS_PAGE_ID, name: 'Canvas', order: 0, description: '', nodes: [], edges: [] };
      }
      const id = generatePageId();
      // Find max order
      let maxOrder = -1;
      ypages.forEach((ypage) => {
        const order = ypage.get('order') as number;
        if (order > maxOrder) maxOrder = order;
      });

      const newPage: Page = {
        id,
        name,
        description,
        order: maxOrder + 1,
        nodes: [],
        edges: [],
      };

      console.debug('[pages] createPage', { id, name, existingCount: ypages.size, roomId });

      ydoc.transact(() => {
        const ypage = new Y.Map<unknown>();
        ypage.set('id', id);
        ypage.set('name', name);
        if (description) ypage.set('description', description);
        ypage.set('order', maxOrder + 1);
        ypages.set(id, ypage);

        // Create empty maps for the page's data
        ynodes.set(id, new Y.Map<Y.Map<unknown>>() as unknown as Y.Map<unknown>);
        yedges.set(id, new Y.Map<Y.Map<unknown>>() as unknown as Y.Map<unknown>);
      }, 'user');

      return newPage;
    },

    deletePage(pageId: string): boolean {
      if (options.workspaceCanvas) return false;
      if (!ypages.has(pageId)) return false;
      // Don't allow deleting the last page
      if (ypages.size <= 1) return false;

      ydoc.transact(() => {
        ypages.delete(pageId);
        ynodes.delete(pageId);
        yedges.delete(pageId);

        // If deleting the active page, switch to another
        const activePage = ymeta.get('activePage') as string | undefined;
        if (activePage === pageId) {
          const newActive = getActivePageId();
          if (newActive) {
            ymeta.set('activePage', newActive);
          }
        }
      }, 'user');

      return true;
    },

    updatePage(pageId: string, updates: Partial<Omit<Page, 'id' | 'nodes' | 'edges' | 'deployables'>>) {
      if (options.workspaceCanvas) return;
      ydoc.transact(() => {
        const ypage = ypages.get(pageId);
        if (!ypage) return;
        if (updates.name !== undefined) ypage.set('name', updates.name);
        if (updates.description !== undefined) ypage.set('description', updates.description);
        if (updates.order !== undefined) ypage.set('order', updates.order);
      }, 'user');
    },

    duplicatePage(pageId: string, newName: string): Page {
      if (options.workspaceCanvas) {
        return { id: WORKSPACE_CANVAS_PAGE_ID, name: 'Canvas', order: 0, description: '', nodes: [], edges: [] };
      }
      const sourcePage = ypages.get(pageId);
      if (!sourcePage) throw new Error(`Page ${pageId} not found`);

      const newId = generatePageId();
      let maxOrder = -1;
      ypages.forEach((ypage) => {
        const order = ypage.get('order') as number;
        if (order > maxOrder) maxOrder = order;
      });

      ydoc.transact(() => {
        // Create page metadata
        const ypage = new Y.Map<unknown>();
        ypage.set('id', newId);
        ypage.set('name', newName);
        const desc = sourcePage.get('description');
        if (desc) ypage.set('description', desc);
        ypage.set('order', maxOrder + 1);
        ypages.set(newId, ypage);

        // Deep-copy nodes with new IDs
        const sourceNodes = ynodes.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
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
        const sourceEdges = yedges.get(pageId) as Y.Map<Y.Map<unknown>> | undefined;
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

      return adapter.getPage(newId)!;
    },

    copyNodesToPage(nodeIds: string[], targetPageId: string) {
      if (options.workspaceCanvas) return;
      if (!ypages.has(targetPageId)) return;
      const sourceNodes = getActivePageNodes();
      const sourceEdges = getActivePageEdges();
      if (!sourceNodes || !sourceEdges) return;

      ydoc.transact(() => {
        let targetNodesMap = ynodes.get(targetPageId) as Y.Map<Y.Map<unknown>> | undefined;
        if (!targetNodesMap) {
          targetNodesMap = new Y.Map<Y.Map<unknown>>();
          ynodes.set(targetPageId, targetNodesMap as unknown as Y.Map<unknown>);
        }
        let targetEdgesMap = yedges.get(targetPageId) as Y.Map<Y.Map<unknown>> | undefined;
        if (!targetEdgesMap) {
          targetEdgesMap = new Y.Map<Y.Map<unknown>>();
          yedges.set(targetPageId, targetEdgesMap as unknown as Y.Map<unknown>);
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
      if (options.workspaceCanvas) { console.warn('[workspace] setSchemas is a no-op in workspace canvas mode'); return; }
      ydoc.transact(() => {
        yschemas.clear();
        for (const schema of schemas) {
          yschemas.set(schema.type, objectToYMap(schema as unknown as Record<string, unknown>));
        }
      }, 'user');
    },

    addSchema(schema: ConstructSchema) {
      if (options.workspaceCanvas) { console.warn('[workspace] addSchema is a no-op in workspace canvas mode'); return; }
      ydoc.transact(() => {
        yschemas.set(schema.type, objectToYMap(schema as unknown as Record<string, unknown>));
      }, 'user');
    },

    updateSchema(type: string, updates: Partial<ConstructSchema>) {
      if (options.workspaceCanvas) { console.warn('[workspace] updateSchema is a no-op in workspace canvas mode'); return; }
      // Delegate to shared doc-operation with 'user' origin
      updateSchemaOp(ydoc, type, updates as unknown as Record<string, unknown>, 'user');
    },

    removeSchema(type: string): boolean {
      if (options.workspaceCanvas) { console.warn('[workspace] removeSchema is a no-op in workspace canvas mode'); return false; }
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
      if (options.workspaceCanvas) { console.warn('[workspace] setPortSchemas is a no-op in workspace canvas mode'); return; }
      ydoc.transact(() => {
        yportSchemas.clear();
        for (const schema of schemas) {
          yportSchemas.set(schema.id, objectToYMap(schema as unknown as Record<string, unknown>));
        }
      }, 'user');
    },

    addPortSchema(schema: PortSchema) {
      if (options.workspaceCanvas) { console.warn('[workspace] addPortSchema is a no-op in workspace canvas mode'); return; }
      ydoc.transact(() => {
        yportSchemas.set(schema.id, objectToYMap(schema as unknown as Record<string, unknown>));
      }, 'user');
    },

    updatePortSchema(id: string, updates: Partial<PortSchema>) {
      if (options.workspaceCanvas) { console.warn('[workspace] updatePortSchema is a no-op in workspace canvas mode'); return; }
      ydoc.transact(() => {
        const yschema = yportSchemas.get(id);
        if (!yschema) return;
        const current = yMapToObject<PortSchema>(yschema);
        yportSchemas.set(id, objectToYMap({ ...current, ...updates } as unknown as Record<string, unknown>));
      }, 'user');
    },

    removePortSchema(id: string): boolean {
      if (options.workspaceCanvas) { console.warn('[workspace] removePortSchema is a no-op in workspace canvas mode'); return false; }
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
      if (options.workspaceCanvas) { console.warn('[workspace] setSchemaGroups is a no-op in workspace canvas mode'); return; }
      ydoc.transact(() => {
        yschemaGroups.clear();
        for (const group of groups) {
          yschemaGroups.set(group.id, objectToYMap(group as unknown as Record<string, unknown>));
        }
      }, 'user');
    },

    addSchemaGroup(group: Omit<SchemaGroup, 'id'> | SchemaGroup): SchemaGroup {
      if (options.workspaceCanvas) { console.warn('[workspace] addSchemaGroup is a no-op in workspace canvas mode'); return { ...group, id: ('id' in group && group.id) ? group.id : generateSchemaGroupId() }; }
      const id = ('id' in group && group.id) ? group.id : generateSchemaGroupId();
      const newGroup: SchemaGroup = { ...group, id };
      ydoc.transact(() => {
        yschemaGroups.set(id, objectToYMap(newGroup as unknown as Record<string, unknown>));
      }, 'user');
      return newGroup;
    },

    updateSchemaGroup(id: string, updates: Partial<SchemaGroup>) {
      if (options.workspaceCanvas) { console.warn('[workspace] updateSchemaGroup is a no-op in workspace canvas mode'); return; }
      ydoc.transact(() => {
        const ygroup = yschemaGroups.get(id);
        if (!ygroup) return;
        const current = yMapToObject<SchemaGroup>(ygroup);
        yschemaGroups.set(id, objectToYMap({ ...current, ...updates } as unknown as Record<string, unknown>));
      }, 'user');
    },

    removeSchemaGroup(id: string): boolean {
      if (options.workspaceCanvas) { console.warn('[workspace] removeSchemaGroup is a no-op in workspace canvas mode'); return false; }
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

    // Mutations - Schema Packages
    setSchemaPackages(packages: SchemaPackage[]) {
      if (options.workspaceCanvas) { console.warn('[workspace] setSchemaPackages is a no-op in workspace canvas mode'); return; }
      ydoc.transact(() => {
        yschemaPackages.clear();
        for (const pkg of packages) {
          yschemaPackages.set(pkg.id, objectToYMap(pkg as unknown as Record<string, unknown>));
        }
      }, 'user');
    },

    addSchemaPackage(pkg: Omit<SchemaPackage, 'id'> | SchemaPackage): SchemaPackage {
      if (options.workspaceCanvas) { console.warn('[workspace] addSchemaPackage is a no-op in workspace canvas mode'); return { ...pkg, id: ('id' in pkg && pkg.id) ? pkg.id : generateSchemaPackageId() }; }
      const id = ('id' in pkg && pkg.id) ? pkg.id : generateSchemaPackageId();
      const newPackage: SchemaPackage = { ...pkg, id };
      ydoc.transact(() => {
        yschemaPackages.set(id, objectToYMap(newPackage as unknown as Record<string, unknown>));
      }, 'user');
      return newPackage;
    },

    updateSchemaPackage(id: string, updates: Partial<SchemaPackage>) {
      if (options.workspaceCanvas) { console.warn('[workspace] updateSchemaPackage is a no-op in workspace canvas mode'); return; }
      ydoc.transact(() => {
        const ypackage = yschemaPackages.get(id);
        if (!ypackage) return;
        const current = yMapToObject<SchemaPackage>(ypackage);
        yschemaPackages.set(id, objectToYMap({ ...current, ...updates } as unknown as Record<string, unknown>));
      }, 'user');
    },

    removeSchemaPackage(id: string): boolean {
      if (options.workspaceCanvas) { console.warn('[workspace] removeSchemaPackage is a no-op in workspace canvas mode'); return false; }
      const exists = yschemaPackages.has(id);
      if (exists) {
        ydoc.transact(() => {
          // Clear packageId from schemas that reference this package
          yschemas.forEach((yschema, schemaType) => {
            const schema = yMapToObject<ConstructSchema>(yschema);
            if (schema.packageId === id) {
              yschemas.set(schemaType, objectToYMap({ ...schema, packageId: undefined } as unknown as Record<string, unknown>));
            }
          });
          // Clear packageId from port schemas that reference this package
          yportSchemas.forEach((yportSchema, portId) => {
            const portSchema = yMapToObject<PortSchema>(yportSchema);
            if (portSchema.packageId === id) {
              yportSchemas.set(portId, objectToYMap({ ...portSchema, packageId: undefined } as unknown as Record<string, unknown>));
            }
          });
          // Clear packageId from groups that reference this package
          yschemaGroups.forEach((ygroup, groupId) => {
            const group = yMapToObject<SchemaGroup>(ygroup);
            if (group.packageId === id) {
              yschemaGroups.set(groupId, objectToYMap({ ...group, packageId: undefined } as unknown as Record<string, unknown>));
            }
          });
          yschemaPackages.delete(id);
        }, 'user');
      }
      return exists;
    },

    // Mutations - Package Manifest
    addPackageManifestEntry(entry: PackageManifestEntry) {
      if (options.workspaceCanvas) { console.warn('[workspace] addPackageManifestEntry is a no-op in workspace canvas mode'); return; }
      ydoc.transact(() => {
        ypackageManifest.set(entry.packageId, objectToYMap(entry as unknown as Record<string, unknown>));
      }, 'user');
    },

    removePackageManifestEntry(packageId: string): boolean {
      if (options.workspaceCanvas) { console.warn('[workspace] removePackageManifestEntry is a no-op in workspace canvas mode'); return false; }
      const exists = ypackageManifest.has(packageId);
      if (exists) {
        ydoc.transact(() => {
          ypackageManifest.delete(packageId);
        }, 'user');
      }
      return exists;
    },

    // State access - Schema Relationships
    getSchemaRelationships(): SchemaRelationship[] {
      if (options.workspaceCanvas) return options.workspaceCanvas.schemaRelationships;
      const rels: SchemaRelationship[] = [];
      yschemaRelationships.forEach((yrel) => {
        rels.push(yMapToObject<SchemaRelationship>(yrel));
      });
      return rels;
    },

    getSchemaRelationship(id: string): SchemaRelationship | undefined {
      if (options.workspaceCanvas) return options.workspaceCanvas.schemaRelationships.find(r => r.id === id);
      const yrel = yschemaRelationships.get(id);
      return yrel ? yMapToObject<SchemaRelationship>(yrel) : undefined;
    },

    // Mutations - Schema Relationships
    addSchemaRelationship(rel: SchemaRelationship) {
      if (options.workspaceCanvas) { console.warn('[workspace] addSchemaRelationship is a no-op in workspace canvas mode'); return; }
      ydoc.transact(() => {
        yschemaRelationships.set(rel.id, objectToYMap(rel as unknown as Record<string, unknown>));
      }, 'user');
    },

    updateSchemaRelationship(id: string, updates: Partial<SchemaRelationship>) {
      if (options.workspaceCanvas) { console.warn('[workspace] updateSchemaRelationship is a no-op in workspace canvas mode'); return; }
      const yrel = yschemaRelationships.get(id);
      if (yrel) {
        ydoc.transact(() => {
          for (const [key, value] of Object.entries(updates)) {
            yrel.set(key, value);
          }
        }, 'user');
      }
    },

    removeSchemaRelationship(id: string): boolean {
      if (options.workspaceCanvas) { console.warn('[workspace] removeSchemaRelationship is a no-op in workspace canvas mode'); return false; }
      const exists = yschemaRelationships.has(id);
      if (exists) {
        ydoc.transact(() => {
          yschemaRelationships.delete(id);
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

    // State access - Spec Groups
    getSpecGroups(): SpecGroup[] {
      const results: SpecGroup[] = [];
      yspecGroups.forEach((ysg) => {
        const yitems = ysg.get('items') as Y.Array<Y.Map<unknown>>;
        const items: SpecGroupItem[] = [];
        yitems.forEach((yitem) => {
          items.push({
            type: yitem.get('type') as 'page',
            id: yitem.get('id') as string,
          });
        });
        results.push({
          id: ysg.get('id') as string,
          name: ysg.get('name') as string,
          description: ysg.get('description') as string | undefined,
          order: ysg.get('order') as number,
          items,
        });
      });
      return results.sort((a, b) => a.order - b.order);
    },

    getSpecGroup(id: string): SpecGroup | undefined {
      const ysg = yspecGroups.get(id);
      if (!ysg) return undefined;
      const yitems = ysg.get('items') as Y.Array<Y.Map<unknown>>;
      const items: SpecGroupItem[] = [];
      yitems.forEach((yitem) => {
        items.push({
          type: yitem.get('type') as 'page',
          id: yitem.get('id') as string,
        });
      });
      return {
        id: ysg.get('id') as string,
        name: ysg.get('name') as string,
        description: ysg.get('description') as string | undefined,
        order: ysg.get('order') as number,
        items,
      };
    },

    // Mutations - Spec Groups
    createSpecGroup(name: string, description?: string): SpecGroup {
      const id = generateSpecGroupId();
      let maxOrder = -1;
      yspecGroups.forEach((ysg) => {
        const o = ysg.get('order') as number;
        if (o > maxOrder) maxOrder = o;
      });
      const order = maxOrder + 1;
      ydoc.transact(() => {
        const ysg = new Y.Map<unknown>();
        ysg.set('id', id);
        ysg.set('name', name);
        if (description !== undefined) ysg.set('description', description);
        ysg.set('order', order);
        const yitems = new Y.Array<Y.Map<unknown>>();
        ysg.set('items', yitems);
        yspecGroups.set(id, ysg);
      }, 'user');
      return { id, name, description, order, items: [] };
    },

    updateSpecGroup(
      id: string,
      updates: { name?: string; description?: string; order?: number; items?: SpecGroupItem[] }
    ): SpecGroup | undefined {
      const ysg = yspecGroups.get(id);
      if (!ysg) return undefined;
      ydoc.transact(() => {
        if (updates.name !== undefined) ysg.set('name', updates.name);
        if (updates.description !== undefined) ysg.set('description', updates.description);
        if (updates.order !== undefined) ysg.set('order', updates.order);
        if (updates.items !== undefined) {
          const yitems = ysg.get('items') as Y.Array<Y.Map<unknown>>;
          yitems.delete(0, yitems.length);
          for (const item of updates.items) {
            const yitem = new Y.Map<unknown>();
            yitem.set('type', item.type);
            yitem.set('id', item.id);
            yitems.push([yitem]);
          }
        }
      }, 'user');
      return this.getSpecGroup(id);
    },

    deleteSpecGroup(id: string): boolean {
      const exists = yspecGroups.has(id);
      if (exists) {
        ydoc.transact(() => {
          yspecGroups.delete(id);
        }, 'user');
      }
      return exists;
    },

    assignToSpecGroup(groupId: string, item: SpecGroupItem): SpecGroup | undefined {
      // Enforce single-parent: remove from any existing group first
      this.removeFromSpecGroup(item.type, item.id);
      const ysg = yspecGroups.get(groupId);
      if (!ysg) return undefined;
      ydoc.transact(() => {
        const yitems = ysg.get('items') as Y.Array<Y.Map<unknown>>;
        const yitem = new Y.Map<unknown>();
        yitem.set('type', item.type);
        yitem.set('id', item.id);
        yitems.push([yitem]);
      }, 'user');
      return this.getSpecGroup(groupId);
    },

    removeFromSpecGroup(itemType: 'page', itemId: string): boolean {
      let found = false;
      yspecGroups.forEach((ysg) => {
        if (found) return;
        const yitems = ysg.get('items') as Y.Array<Y.Map<unknown>>;
        let idx = -1;
        yitems.forEach((yitem, i) => {
          if (yitem.get('type') === itemType && yitem.get('id') === itemId) {
            idx = i;
          }
        });
        if (idx >= 0) {
          ydoc.transact(() => {
            yitems.delete(idx, 1);
          }, 'user');
          found = true;
        }
      });
      return found;
    },

    subscribeToSpecGroups(listener: () => void): () => void {
      specGroupListeners.add(listener);
      return () => specGroupListeners.delete(listener);
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

    subscribeToSchemaPackages(listener: () => void): () => void {
      schemaPackageListeners.add(listener);
      return () => schemaPackageListeners.delete(listener);
    },

    subscribeToSchemaRelationships(listener: () => void): () => void {
      schemaRelationshipListeners.add(listener);
      return () => schemaRelationshipListeners.delete(listener);
    },

    subscribeToPackageManifest(listener: () => void): () => void {
      packageManifestListeners.add(listener);
      return () => packageManifestListeners.delete(listener);
    },

    subscribeToPages(listener: () => void): () => void {
      pageListeners.add(listener);
      return () => pageListeners.delete(listener);
    },

    subscribeToMeta(listener: () => void): () => void {
      metaListeners.add(listener);
      return () => metaListeners.delete(listener);
    },

    toJSON(): CartaDocumentV4 {
      const pages = adapter.getPages();
      return {
        version: 4,
        title: adapter.getTitle(),
        description: adapter.getDescription(),
        pages,
        activePage: getActivePageId(),
        schemas: adapter.getSchemas(),
        portSchemas: adapter.getPortSchemas(),
        schemaGroups: adapter.getSchemaGroups(),
        schemaPackages: adapter.getSchemaPackages(),
        schemaRelationships: adapter.getSchemaRelationships(),
        packageManifest: adapter.getPackageManifest(),
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
    async connectToRoom(newRoomId: string, syncUrl: string): Promise<void> {
      if (wsProvider) {
        (wsProvider as { destroy: () => void }).destroy();
      }

      connectionStatus = 'connecting';
      notifyListeners();

      // Dynamic import to avoid bundling y-websocket in local mode
      const { WebsocketProvider } = await import('y-websocket');
      wsProvider = new WebsocketProvider(syncUrl, newRoomId, ydoc);

      // Update connection status based on WebSocket state
      const ws = wsProvider as { on: (event: string, cb: () => void) => void };
      ws.on('sync', () => {
        connectionStatus = 'connected';

        // Safety net: if server had no pages either, create the appropriate default
        if (ypages.size === 0) {
          if (options.workspaceCanvas) {
            console.debug('[workspace] No pages after sync, creating shim canvas page', { roomId: newRoomId });
            ydoc.transact(() => {
              const pageData = new Y.Map<unknown>();
              pageData.set('id', WORKSPACE_CANVAS_PAGE_ID);
              pageData.set('name', 'Canvas');
              pageData.set('order', 0);
              ypages.set(WORKSPACE_CANVAS_PAGE_ID, pageData);
              ymeta.set('activePage', WORKSPACE_CANVAS_PAGE_ID);
            }, 'init');
          } else {
            console.debug('[pages] No pages after sync, creating default Main page', { roomId: newRoomId });
            ydoc.transact(() => {
              const pageId = generatePageId();
              const pageData = new Y.Map<unknown>();
              pageData.set('id', pageId);
              pageData.set('name', 'Main');
              pageData.set('order', 0);
              ypages.set(pageId, pageData);
              ymeta.set('activePage', pageId);
            }, 'init');
          }
        }

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
