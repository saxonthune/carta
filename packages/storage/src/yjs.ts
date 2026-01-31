/**
 * Yjs storage provider for real-time collaboration
 *
 * Connects to the same Yjs collab server that browsers use,
 * enabling MCP tools to read and modify documents in real-time.
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { WebSocket } from 'ws';
import type { ServerDocument, DocumentMetadata, CompilerNode, CompilerEdge, Deployable, ConstructSchema } from '@carta/domain';
import type { PortfolioProvider } from './types.js';

/**
 * Connection state for a room
 */
interface RoomConnection {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  roomId: string;
  synced: boolean;
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
 * Convert a plain object to a Y.Map (shallow)
 */
function objectToYMap(obj: Record<string, unknown>): Y.Map<unknown> {
  const ymap = new Y.Map<unknown>();
  for (const [key, value] of Object.entries(obj)) {
    ymap.set(key, value);
  }
  return ymap;
}

/**
 * Yjs-based storage provider for collaborative editing via WebSocket.
 *
 * Connects to a Yjs WebSocket server (y-websocket) to sync documents
 * in real-time with browser clients.
 */
export class YjsProvider implements PortfolioProvider {
  private serverUrl: string;
  private connections: Map<string, RoomConnection> = new Map();
  private apiUrl: string;

  constructor(serverUrl = 'ws://localhost:1234', apiUrl = 'http://localhost:1234') {
    this.serverUrl = serverUrl;
    this.apiUrl = apiUrl;
  }

  /**
   * Connect to a room and wait for initial sync
   */
  private async connectToRoom(roomId: string): Promise<RoomConnection> {
    // Return existing connection if available and synced
    const existing = this.connections.get(roomId);
    if (existing?.synced) {
      return existing;
    }

    // Create new Y.Doc and connect
    const ydoc = new Y.Doc();
    console.error(`[YjsProvider] Creating WebsocketProvider for ${this.serverUrl}/${roomId}`);
    const provider = new WebsocketProvider(this.serverUrl, roomId, ydoc, {
      WebSocketPolyfill: WebSocket as any,
    });

    const connection: RoomConnection = {
      ydoc,
      provider,
      roomId,
      synced: false,
    };

    // Wait for initial sync
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        console.error(`[YjsProvider] Timeout waiting for sync on room: ${roomId}`);
        reject(new Error(`Timeout connecting to room: ${roomId}`));
      }, 10000);

      provider.on('status', (event: { status: string }) => {
        console.error(`[YjsProvider] WebSocket status for ${roomId}: ${event.status}`);
      });

      provider.on('sync', (isSynced: boolean) => {
        console.error(`[YjsProvider] Sync event for ${roomId}: ${isSynced}`);
        if (isSynced) {
          clearTimeout(timeout);
          connection.synced = true;
          resolve();
        }
      });

      provider.on('connection-error', (event: Event) => {
        console.error(`[YjsProvider] Connection error for ${roomId}:`, event);
        clearTimeout(timeout);
        reject(new Error(`WebSocket connection error: ${event.type}`));
      });
    });

    this.connections.set(roomId, connection);
    return connection;
  }

  /**
   * Disconnect from a room
   */
  private disconnectFromRoom(roomId: string): void {
    const connection = this.connections.get(roomId);
    if (connection) {
      connection.provider.destroy();
      connection.ydoc.destroy();
      this.connections.delete(roomId);
    }
  }

  /**
   * Extract ServerDocument from Y.Doc
   */
  private extractDocument(connection: RoomConnection): ServerDocument {
    const { ydoc, roomId } = connection;

    const ymeta = ydoc.getMap('meta');
    const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
    const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
    const ydeployables = ydoc.getMap<Y.Map<unknown>>('deployables');

    // Extract nodes
    const nodes: CompilerNode[] = [];
    ynodes.forEach((ynode, id) => {
      const nodeObj = yMapToObject<{ position: { x: number; y: number }; data: Record<string, unknown>; type?: string }>(ynode);
      nodes.push({
        id,
        type: nodeObj.type || 'construct',
        position: nodeObj.position || { x: 0, y: 0 },
        data: nodeObj.data as unknown as CompilerNode['data'],
      });
    });

    // Extract edges
    const edges: CompilerEdge[] = [];
    yedges.forEach((yedge, id) => {
      const edgeObj = yMapToObject<CompilerEdge>(yedge);
      edges.push({ ...edgeObj, id });
    });

    // Extract schemas
    const customSchemas: ConstructSchema[] = [];
    yschemas.forEach((yschema) => {
      customSchemas.push(yMapToObject<ConstructSchema>(yschema));
    });

    // Extract deployables
    const deployables: Deployable[] = [];
    ydeployables.forEach((ydeployable) => {
      deployables.push(yMapToObject<Deployable>(ydeployable));
    });

    const now = new Date().toISOString();

    return {
      id: roomId,
      title: (ymeta.get('title') as string) || 'Untitled Project',
      version: (ymeta.get('version') as number) || 3,
      formatVersion: 4,
      createdAt: now,
      updatedAt: now,
      nodes,
      edges,
      deployables,
      customSchemas,
    };
  }

  /**
   * Apply ServerDocument changes to Y.Doc
   */
  private applyDocument(connection: RoomConnection, doc: ServerDocument): void {
    const { ydoc } = connection;

    const ymeta = ydoc.getMap('meta');
    const ynodes = ydoc.getMap<Y.Map<unknown>>('nodes');
    const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
    const yschemas = ydoc.getMap<Y.Map<unknown>>('schemas');
    const ydeployables = ydoc.getMap<Y.Map<unknown>>('deployables');

    ydoc.transact(() => {
      // Update metadata
      ymeta.set('title', doc.title);
      ymeta.set('version', doc.version);

      // Update nodes
      ynodes.clear();
      for (const node of doc.nodes) {
        const { id, ...rest } = node;
        ynodes.set(id, objectToYMap(rest as unknown as Record<string, unknown>));
      }

      // Update edges
      yedges.clear();
      for (const edge of doc.edges) {
        const { id, ...rest } = edge;
        yedges.set(id, objectToYMap(rest as unknown as Record<string, unknown>));
      }

      // Update schemas
      yschemas.clear();
      for (const schema of doc.customSchemas) {
        yschemas.set(schema.type, objectToYMap(schema as unknown as Record<string, unknown>));
      }

      // Update deployables
      ydeployables.clear();
      for (const deployable of doc.deployables) {
        ydeployables.set(deployable.id, objectToYMap(deployable as unknown as Record<string, unknown>));
      }
    }, 'mcp');
  }

  async loadDocument(id: string): Promise<ServerDocument | null> {
    try {
      console.error(`[YjsProvider] Attempting to connect to room: ${id}`);
      const connection = await this.connectToRoom(id);
      console.error(`[YjsProvider] Successfully connected to room: ${id}`);
      return this.extractDocument(connection);
    } catch (error) {
      console.error(`[YjsProvider] Failed to load document from room ${id}:`, error);
      return null;
    }
  }

  async saveDocument(doc: ServerDocument): Promise<void> {
    const connection = await this.connectToRoom(doc.id);
    this.applyDocument(connection, doc);
  }

  async listDocuments(): Promise<DocumentMetadata[]> {
    // Try to fetch active rooms from the collab server's HTTP API
    try {
      const response = await fetch(`${this.apiUrl}/rooms`);
      if (!response.ok) {
        console.error('Failed to fetch rooms:', response.statusText);
        return this.listConnectedDocuments();
      }

      const { rooms } = (await response.json()) as { rooms: Array<{ roomId: string; clientCount: number }> };

      // Connect to each room to get metadata
      const metadata: DocumentMetadata[] = [];
      for (const room of rooms) {
        try {
          const connection = await this.connectToRoom(room.roomId);
          const doc = this.extractDocument(connection);
          metadata.push({
            id: doc.id,
            title: doc.title,
            version: doc.version,
            updatedAt: doc.updatedAt,
            nodeCount: doc.nodes.length,
          });
        } catch {
          // Room might have closed, skip it
        }
      }

      return metadata;
    } catch {
      // API not available, fall back to listing connected rooms
      return this.listConnectedDocuments();
    }
  }

  /**
   * List documents from currently connected rooms only
   */
  private listConnectedDocuments(): DocumentMetadata[] {
    const metadata: DocumentMetadata[] = [];
    for (const [roomId, connection] of this.connections) {
      if (connection.synced) {
        const doc = this.extractDocument(connection);
        metadata.push({
          id: roomId,
          title: doc.title,
          version: doc.version,
          updatedAt: doc.updatedAt,
          nodeCount: doc.nodes.length,
        });
      }
    }
    return metadata;
  }

  async deleteDocument(id: string): Promise<boolean> {
    // For Yjs, "deleting" means clearing the document content
    try {
      const connection = await this.connectToRoom(id);
      const { ydoc } = connection;

      ydoc.transact(() => {
        const ynodes = ydoc.getMap('nodes');
        const yedges = ydoc.getMap('edges');
        const yschemas = ydoc.getMap('schemas');
        const ydeployables = ydoc.getMap('deployables');
        const yportSchemas = ydoc.getMap('portSchemas');
        const yschemaGroups = ydoc.getMap('schemaGroups');
        const ymeta = ydoc.getMap('meta');

        ynodes.clear();
        yedges.clear();
        yschemas.clear();
        ydeployables.clear();
        yportSchemas.clear();
        yschemaGroups.clear();
        ymeta.set('title', 'Untitled Project');
      }, 'mcp');

      // Disconnect from the room
      this.disconnectFromRoom(id);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get list of active rooms from the collab server
   */
  async getActiveRooms(): Promise<Array<{ roomId: string; clientCount: number }>> {
    try {
      const response = await fetch(`${this.apiUrl}/rooms`);
      if (!response.ok) {
        return [];
      }
      const { rooms } = (await response.json()) as { rooms: Array<{ roomId: string; clientCount: number }> };
      return rooms;
    } catch {
      return [];
    }
  }

  /**
   * Subscribe to document changes (for real-time sync)
   */
  subscribe(docId: string, callback: (doc: ServerDocument) => void): () => void {
    let connection: RoomConnection | null = null;

    const setupSubscription = async () => {
      connection = await this.connectToRoom(docId);
      const { ydoc } = connection;

      const observer = () => {
        if (connection?.synced) {
          callback(this.extractDocument(connection));
        }
      };

      // Observe all relevant maps
      ydoc.getMap('meta').observeDeep(observer);
      ydoc.getMap('nodes').observeDeep(observer);
      ydoc.getMap('edges').observeDeep(observer);
      ydoc.getMap('schemas').observeDeep(observer);
      ydoc.getMap('deployables').observeDeep(observer);

      return () => {
        ydoc.getMap('meta').unobserveDeep(observer);
        ydoc.getMap('nodes').unobserveDeep(observer);
        ydoc.getMap('edges').unobserveDeep(observer);
        ydoc.getMap('schemas').unobserveDeep(observer);
        ydoc.getMap('deployables').unobserveDeep(observer);
      };
    };

    let unsubscribe: (() => void) | null = null;
    setupSubscription().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }

  /**
   * Dispose all connections
   */
  dispose(): void {
    for (const roomId of this.connections.keys()) {
      this.disconnectFromRoom(roomId);
    }
  }
}
