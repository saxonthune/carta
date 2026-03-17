import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import * as Y from 'yjs';
import type { DocumentAdapter } from '@carta/schema';
import { createYjsAdapter, type YjsAdapterOptions, type WorkspaceCanvasSchemas } from '../stores/adapters/yjsAdapter';
import { builtInPortSchemas } from '@carta/schema';
import { config } from '../config/featureFlags';

/**
 * Document context value
 */
export interface DocumentContextValue {
  adapter: DocumentAdapter;
  mode: 'local' | 'shared';
  documentId: string;
  isReady: boolean;
  ydoc: Y.Doc;
  hasSync: boolean;
}

const DocumentContext = createContext<DocumentContextValue | null>(null);

/**
 * Hook to access document context
 */
export function useDocumentContext(): DocumentContextValue {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocumentContext must be used within a DocumentProvider');
  }
  return context;
}

export interface DocumentProviderProps {
  children: ReactNode;
  /** Document ID (required — caller ensures one exists via URL param) */
  documentId: string;
  /** WebSocket URL for sync server */
  syncUrl?: string;
  /** Skip IndexedDB persistence (for testing) */
  skipPersistence?: boolean;
  /**
   * Workspace canvas mode — inject schemas from server, skip IndexedDB and migrations.
   * When set, the adapter uses WORKSPACE_CANVAS_PAGE_ID as the single synthetic page.
   */
  workspaceCanvas?: WorkspaceCanvasSchemas;
}

/**
 * Provider that manages the document adapter lifecycle.
 * Uses Yjs for state management. IndexedDB persistence is only used in local mode
 * (no server); when a server is present, the server handles persistence.
 */
export function DocumentProvider({
  children,
  documentId,
  syncUrl = config.syncWsUrl ?? undefined,
  skipPersistence = false,
  workspaceCanvas,
}: DocumentProviderProps) {
  const [adapter, setAdapter] = useState<DocumentAdapter | null>(null);
  const [mode, setMode] = useState<'local' | 'shared'>('local');
  const [isReady, setIsReady] = useState(false);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize Yjs adapter
  useEffect(() => {
    let mounted = true;
    let currentAdapter: ReturnType<typeof createYjsAdapter> | null = null;

    const initAdapter = async () => {
      performance.mark('carta:adapter-init-start')

      // Workspace canvas mode: schemas injected, no IndexedDB, no migrations
      if (workspaceCanvas) {
        const yjsAdapter = createYjsAdapter({
          mode: 'local',
          roomId: documentId,
          skipPersistence: true,
          deferDefaultPage: true,
          workspaceCanvas,
        });
        currentAdapter = yjsAdapter;
        await yjsAdapter.initialize();

        if (mounted) {
          performance.mark('carta:adapter-ready')
          performance.measure('carta:adapter-init', 'carta:adapter-init-start', 'carta:adapter-ready')
          setAdapter(yjsAdapter);
          setYdoc(yjsAdapter.ydoc);
          setMode('shared');
          setIsReady(true);
        }

        // Connect to workspace server WebSocket
        if (syncUrl && mounted) {
          yjsAdapter.connectToRoom(documentId, syncUrl).catch((err) => {
            console.error('Failed to connect to workspace server:', err);
          });
        }
        return;
      }

      // Skip IndexedDB when a server handles persistence
      const shouldSkipPersistence = skipPersistence || config.hasSync;

      const options: YjsAdapterOptions = {
        mode: 'local',
        roomId: documentId,
        skipPersistence: shouldSkipPersistence,
        deferDefaultPage: config.hasSync,
      };

      // Create Yjs adapter
      const yjsAdapter = createYjsAdapter(options);
      currentAdapter = yjsAdapter;
      await yjsAdapter.initialize();

      // Ensure built-in port schemas exist (document template)
      const hasPortSchemas = yjsAdapter.getPortSchemas().length > 0;
      if (!hasPortSchemas) {
        yjsAdapter.transaction(() => {
          yjsAdapter.setPortSchemas(builtInPortSchemas);
        }, 'user');
      }

      // Migration: forward -> relay, intercept polarity update
      performance.mark('carta:migration-start')
      const migrationVersion = yjsAdapter.ydoc.getMap('meta').get('migrationVersion') as number | undefined;
      if ((migrationVersion || 0) < 1) {
        yjsAdapter.transaction(() => {
          const portSchemas = yjsAdapter.getPortSchemas();
          for (const ps of portSchemas) {
            if (ps.id === 'forward') {
              yjsAdapter.removePortSchema('forward');
              yjsAdapter.addPortSchema({
                ...ps,
                id: 'relay',
                displayName: 'Relay',
                polarity: 'relay',
                compatibleWith: [],
                semanticDescription: 'Pass-through output connecting to any sink port (bypasses type checking)',
              });
            } else if (ps.id === 'intercept' && ps.polarity !== 'intercept') {
              yjsAdapter.updatePortSchema('intercept', {
                polarity: 'intercept',
                compatibleWith: [],
                semanticDescription: 'Pass-through input accepting any source connection (bypasses type checking)',
              });
            }
            if (ps.compatibleWith.some(c => c.startsWith('*') && c !== '*')) {
              yjsAdapter.updatePortSchema(ps.id, {
                compatibleWith: ps.compatibleWith.filter(c => !c.startsWith('*') || c === '*'),
              });
            }
          }

          const schemas = yjsAdapter.getSchemas();
          for (const schema of schemas) {
            if (schema.ports?.some(p => p.portType === 'forward')) {
              yjsAdapter.updateSchema(schema.type, {
                ports: schema.ports.map(p =>
                  p.portType === 'forward' ? { ...p, portType: 'relay' } : p
                ),
              });
            }
          }

          const nodes = yjsAdapter.getNodes() as Array<{ id: string; data?: { connections?: Array<{ portId: string; targetPortId: string }> } }>;
          for (const node of nodes) {
            const connections = node.data?.connections;
            if (connections?.some(c => c.portId === 'forward' || c.targetPortId === 'forward')) {
              yjsAdapter.updateNode(node.id, {
                connections: connections.map(c => ({
                  ...c,
                  portId: c.portId === 'forward' ? 'relay' : c.portId,
                  targetPortId: c.targetPortId === 'forward' ? 'relay' : c.targetPortId,
                })),
              } as any);
            }
          }

          yjsAdapter.ydoc.getMap('meta').set('migrationVersion', 1);
        }, 'migration');
      }
      performance.mark('carta:migration-end')
      performance.measure('carta:migration', 'carta:migration-start', 'carta:migration-end')

      if (mounted) {
        performance.mark('carta:adapter-ready')
        performance.measure('carta:adapter-init', 'carta:adapter-init-start', 'carta:adapter-ready')
        setAdapter(yjsAdapter);
        setYdoc(yjsAdapter.ydoc);
        setMode(config.hasSync ? 'shared' : 'local');
        setIsReady(true);
      }

      // Connect WebSocket AFTER marking ready (non-blocking)
      // This allows the UI to render immediately while sync happens in background
      if (config.hasSync && syncUrl && mounted) {
        yjsAdapter.connectToRoom(documentId, syncUrl).catch((err) => {
          console.error('Failed to connect to sync server:', err);
        });
      }
    };

    initAdapter().catch((err) => {
      console.error('Failed to initialize document:', err);
      if (mounted) {
        setError(err instanceof Error ? err.message : 'Failed to initialize document');
      }
    });

    return () => {
      mounted = false;
      if (currentAdapter) {
        currentAdapter.dispose();
      }
    };
  }, [documentId, syncUrl, skipPersistence, workspaceCanvas]);

  if (error) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-surface gap-4">
        <div className="text-content-muted">Failed to load document</div>
        <div className="text-sm text-content-muted/60 max-w-md text-center">{error}</div>
        <button
          className="px-4 py-2 text-sm rounded-md bg-surface-raised text-content hover:bg-surface-raised/80"
          onClick={() => window.location.reload()}
        >
          Reload
        </button>
      </div>
    );
  }

  if (!adapter || !isReady || !ydoc) {
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="text-content-muted">Loading document...</div>
      </div>
    );
  }

  const value: DocumentContextValue = {
    adapter,
    mode,
    documentId,
    isReady,
    ydoc,
    hasSync: config.hasSync,
  };

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}
