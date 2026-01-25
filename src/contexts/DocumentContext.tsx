import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as Y from 'yjs';
import type { DocumentAdapter } from '../stores/adapters/types';
import { createYjsAdapter, type YjsAdapterOptions } from '../stores/adapters/yjsAdapter';
import { builtInConstructSchemas, builtInSchemaGroups } from '../constructs/schemas';
import { registry } from '../constructs/registry';
import { SKIP_BUILTIN_SEED_KEY } from '../hooks/useClearDocument';

/**
 * Document context value
 */
export interface DocumentContextValue {
  adapter: DocumentAdapter;
  mode: 'local' | 'shared';
  roomId?: string;
  isReady: boolean;
  ydoc: Y.Doc;
  /** When true, collaboration UI should be hidden */
  localMode: boolean;
  // Actions (only available when not in localMode)
  connectToRoom?: (roomId: string, serverUrl: string) => Promise<void>;
  disconnectFromRoom?: () => void;
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
  /** Room ID for shared mode (can come from URL) */
  roomId?: string;
  /** WebSocket server URL for shared mode */
  serverUrl?: string;
  /** When true, hides collaboration UI (Share button, connection status) */
  localMode?: boolean;
  /** Skip IndexedDB persistence (for testing) */
  skipPersistence?: boolean;
}

/**
 * Provider that manages the document adapter lifecycle.
 * Always uses Yjs for state management with y-indexeddb persistence.
 */
export function DocumentProvider({
  children,
  roomId,
  serverUrl = 'ws://localhost:1234',
  localMode = false,
  skipPersistence = false,
}: DocumentProviderProps) {
  const [adapter, setAdapter] = useState<DocumentAdapter | null>(null);
  const [mode, setMode] = useState<'local' | 'shared'>('local');
  const [currentRoomId, setCurrentRoomId] = useState<string | undefined>(roomId);
  const [isReady, setIsReady] = useState(false);
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);

  // Initialize Yjs adapter
  useEffect(() => {
    let mounted = true;
    let currentAdapter: ReturnType<typeof createYjsAdapter> | null = null;

    const initAdapter = async () => {
      // Determine Yjs adapter options
      // Always use 'carta-local' for continue-last behavior (like Excalidraw)
      const options: YjsAdapterOptions = {
        mode: roomId ? 'shared' : 'local',
        roomId: roomId || 'carta-local',
        serverUrl: roomId ? serverUrl : undefined,
        skipPersistence,
      };

      // Create Yjs adapter
      const yjsAdapter = createYjsAdapter(options);
      currentAdapter = yjsAdapter;
      await yjsAdapter.initialize();

      // Seed default schemas and groups if document is empty (unless user just cleared everything)
      const skipSeed = sessionStorage.getItem(SKIP_BUILTIN_SEED_KEY);
      if (skipSeed) {
        sessionStorage.removeItem(SKIP_BUILTIN_SEED_KEY);
      } else if (yjsAdapter.getSchemas().length === 0) {
        // Seed schema groups first (so construct schemas can reference them)
        for (const group of builtInSchemaGroups) {
          yjsAdapter.addSchemaGroup(group);
        }
        // Then seed construct schemas
        for (const schema of builtInConstructSchemas) {
          yjsAdapter.addSchema(schema);
        }
      }

      // Connect to WebSocket if shared mode
      if (roomId && serverUrl) {
        await yjsAdapter.connectToRoom(roomId, serverUrl);
      }

      if (mounted) {
        setAdapter(yjsAdapter);
        setYdoc(yjsAdapter.ydoc);
        setMode(roomId ? 'shared' : 'local');
        setCurrentRoomId(roomId);
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
  }, [roomId, serverUrl, skipPersistence]);

  // Connect to room (for switching from local to shared mode)
  const connectToRoom = useCallback(
    async (newRoomId: string, newServerUrl: string) => {
      if (!adapter) return;

      const yjsAdapter = adapter as ReturnType<typeof createYjsAdapter>;
      if (yjsAdapter.connectToRoom) {
        await yjsAdapter.connectToRoom(newRoomId, newServerUrl);
        setMode('shared');
        setCurrentRoomId(newRoomId);
      }
    },
    [adapter]
  );

  // Disconnect from room
  const disconnectFromRoom = useCallback(() => {
    if (!adapter) return;

    const yjsAdapter = adapter as ReturnType<typeof createYjsAdapter>;
    if (yjsAdapter.disconnectFromRoom) {
      yjsAdapter.disconnectFromRoom();
      setMode('local');
      setCurrentRoomId(undefined);
    }
  }, [adapter]);

  // Sync registry with Yjs adapter schemas (for backward compatibility)
  useEffect(() => {
    if (!adapter || !isReady) return;

    // Initial sync
    const schemas = adapter.getSchemas();
    registry.clearAllSchemas();
    for (const schema of schemas) {
      registry.registerSchema(schema);
    }

    // Subscribe to changes
    const unsubscribe = adapter.subscribe(() => {
      const newSchemas = adapter.getSchemas();
      registry.clearAllSchemas();
      for (const schema of newSchemas) {
        registry.registerSchema(schema);
      }
    });

    return unsubscribe;
  }, [adapter, isReady]);

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
    roomId: currentRoomId,
    isReady,
    ydoc,
    localMode,
    connectToRoom: !localMode ? connectToRoom : undefined,
    disconnectFromRoom: !localMode ? disconnectFromRoom : undefined,
  };

  return <DocumentContext.Provider value={value}>{children}</DocumentContext.Provider>;
}
