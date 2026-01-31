import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as Y from 'yjs';
import type { DocumentAdapter } from '@carta/domain';
import { createYjsAdapter, type YjsAdapterOptions } from '../stores/adapters/yjsAdapter';
import { builtInConstructSchemas, builtInSchemaGroups, builtInPortSchemas } from '@carta/domain';

/**
 * Document context value
 */
export interface DocumentContextValue {
  adapter: DocumentAdapter;
  mode: 'local' | 'shared';
  documentId?: string;
  isReady: boolean;
  ydoc: Y.Doc;
  /** When true, collaboration UI should be hidden */
  staticMode: boolean;
  /** When true, user must select a document before proceeding (server mode without ?doc= param) */
  needsDocumentSelection: boolean;
  // Actions (only available when not in staticMode)
  connectToDocument?: (documentId: string, serverUrl: string) => Promise<void>;
  disconnectFromDocument?: () => void;
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
  /** Document ID for server mode (comes from ?doc= URL param) */
  documentId?: string;
  /** WebSocket server URL for server mode */
  serverUrl?: string;
  /** When true, hides collaboration UI (Share button, connection status) */
  staticMode?: boolean;
  /** Skip IndexedDB persistence (for testing) */
  skipPersistence?: boolean;
}

/**
 * Provider that manages the document adapter lifecycle.
 * Always uses Yjs for state management with y-indexeddb persistence.
 */
export function DocumentProvider({
  children,
  documentId,
  serverUrl = 'ws://localhost:1234',
  staticMode = false,
  skipPersistence = false,
}: DocumentProviderProps) {
  const [adapter, setAdapter] = useState<DocumentAdapter | null>(null);
  const [mode, setMode] = useState<'local' | 'shared'>('local');
  const [currentDocumentId, setCurrentDocumentId] = useState<string | undefined>(documentId);
  const [isReady, setIsReady] = useState(false);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);

  // In server mode without a document ID, user must select a document first
  const needsDocumentSelection = !staticMode && !documentId;

  // Initialize Yjs adapter
  useEffect(() => {
    // Don't initialize adapter if user needs to select a document first
    if (needsDocumentSelection) {
      return;
    }

    let mounted = true;
    let currentAdapter: ReturnType<typeof createYjsAdapter> | null = null;

    const initAdapter = async () => {
      // Determine Yjs adapter options
      // Always use 'carta-local' for continue-last behavior in local mode (like Excalidraw)
      const options: YjsAdapterOptions = {
        mode: documentId ? 'shared' : 'local',
        roomId: documentId || 'carta-local',
        serverUrl: documentId ? serverUrl : undefined,
        skipPersistence,
      };

      // Create Yjs adapter
      const yjsAdapter = createYjsAdapter(options);
      currentAdapter = yjsAdapter;
      await yjsAdapter.initialize();

      // Seed default schemas/groups/ports ONLY on first-ever initialization
      // After that, the document stays as the user left it (even if empty after Clear Everything)
      // The "initialized" flag is stored in the document itself (single source of truth)
      const isInitialized = yjsAdapter.ydoc.getMap('meta').get('initialized') as boolean | undefined;

      if (!isInitialized) {
        yjsAdapter.transaction(() => {
          // Seed schema groups first (so construct schemas can reference them)
          for (const group of builtInSchemaGroups) {
            yjsAdapter.addSchemaGroup(group);
          }
          // Then seed construct schemas
          for (const schema of builtInConstructSchemas) {
            yjsAdapter.addSchema(schema);
          }
          // Seed port schemas
          for (const portSchema of builtInPortSchemas) {
            yjsAdapter.addPortSchema(portSchema);
          }
          // Mark document as initialized (stored in Yjs, persisted to IndexedDB)
          yjsAdapter.ydoc.getMap('meta').set('initialized', true);
        }, 'init');
      }

      // Migration: forward -> relay, intercept polarity update
      const migrationVersion = yjsAdapter.ydoc.getMap('meta').get('migrationVersion') as number | undefined;
      if ((migrationVersion || 0) < 1) {
        yjsAdapter.transaction(() => {
          // Migrate port schemas
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
            // Clean up wildcard patterns from compatibleWith
            if (ps.compatibleWith.some(c => c.startsWith('*') && c !== '*')) {
              yjsAdapter.updatePortSchema(ps.id, {
                compatibleWith: ps.compatibleWith.filter(c => !c.startsWith('*') || c === '*'),
              });
            }
          }

          // Migrate construct schema ports: forward -> relay
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

          // Migrate node connections: forward -> relay
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

      // Connect to WebSocket if server mode with document ID
      if (documentId && serverUrl) {
        await yjsAdapter.connectToRoom(documentId, serverUrl);
      }

      if (mounted) {
        setAdapter(yjsAdapter);
        setYdoc(yjsAdapter.ydoc);
        setMode(documentId ? 'shared' : 'local');
        setCurrentDocumentId(documentId);
        setIsReady(true);
      }
    };

    initAdapter().catch(console.error);

    return () => {
      mounted = false;
      if (currentAdapter) {
        currentAdapter.dispose();
      }
    };
  }, [documentId, serverUrl, skipPersistence, needsDocumentSelection]);

  // Connect to document (for switching from local to shared mode)
  const connectToDocument = useCallback(
    async (newDocumentId: string, newServerUrl: string) => {
      if (!adapter) return;

      const yjsAdapter = adapter as ReturnType<typeof createYjsAdapter>;
      if (yjsAdapter.connectToRoom) {
        await yjsAdapter.connectToRoom(newDocumentId, newServerUrl);
        setMode('shared');
        setCurrentDocumentId(newDocumentId);
      }
    },
    [adapter]
  );

  // Disconnect from document
  const disconnectFromDocument = useCallback(() => {
    if (!adapter) return;

    const yjsAdapter = adapter as ReturnType<typeof createYjsAdapter>;
    if (yjsAdapter.disconnectFromRoom) {
      yjsAdapter.disconnectFromRoom();
      setMode('local');
      setCurrentDocumentId(undefined);
    }
  }, [adapter]);

  // If user needs to select a document, provide a minimal context for the selection modal
  if (needsDocumentSelection) {
    const minimalValue: DocumentContextValue = {
      adapter: null as unknown as DocumentAdapter, // Will not be accessed
      mode: 'local',
      documentId: undefined,
      isReady: false,
      ydoc: null as unknown as Y.Doc, // Will not be accessed
      staticMode,
      needsDocumentSelection: true,
    };
    return <DocumentContext.Provider value={minimalValue}>{children}</DocumentContext.Provider>;
  }

  if (!adapter || !isReady || !ydoc) {
    // Loading state
    return (
      <div className="h-screen flex items-center justify-center bg-surface">
        <div className="text-content-muted">Loading document...</div>
      </div>
    );
  }

  const value: DocumentContextValue = {
    adapter,
    mode,
    documentId: currentDocumentId,
    isReady,
    ydoc,
    staticMode,
    needsDocumentSelection: false,
    connectToDocument: !staticMode ? connectToDocument : undefined,
    disconnectFromDocument: !staticMode ? disconnectFromDocument : undefined,
  };

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}
