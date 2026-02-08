/**
 * Carta Document Server
 *
 * WebSocket server for Yjs document synchronization with HTTP REST API.
 * Supports optional MongoDB persistence via y-mongodb-provider.
 *
 * Environment variables:
 *   PORT - Server port (default: 1234)
 *   HOST - Server host (default: 0.0.0.0)
 *   MONGODB_URI - MongoDB connection string (default: mongodb://localhost:27017/carta)
 *   STORAGE - 'memory' for in-memory only, 'mongodb' or absent for MongoDB (default: mongodb)
 */

import * as http from 'node:http';
import * as Y from 'yjs';
import { WebSocketServer } from 'ws';
import { MongodbPersistence } from 'y-mongodb-provider';
import {
  migrateToPages,
  repairOrphanedConnections,
  extractDocument,
} from '@carta/document';
import {
  createDocumentServer,
  getActivePageId,
  type DocState,
  type DocumentSummary,
} from './document-server-core.js';

export interface ServerInstance {
  server: http.Server;
  wss: WebSocketServer;
  port: number;
}

export interface StartServerOptions {
  port?: number;
  host?: string;
}

/**
 * Active documents (rooms) keyed by room ID
 */
const docs = new Map<string, DocState>();

/**
 * MongoDB persistence (initialized async)
 */
let mdb: MongodbPersistence | null = null;

/**
 * Initialize MongoDB persistence.
 * Reads env vars at call time so tests can override before calling startServer().
 */
async function initPersistence(): Promise<void> {
  if (process.env.STORAGE === 'memory') {
    console.log('[Server] Storage: memory (no database)');
    return;
  }

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/carta';
  try {
    mdb = new MongodbPersistence(mongoUri, {
      collectionName: 'yjs-documents',
      flushSize: 100,
    });
    console.log(`[Server] MongoDB persistence enabled: ${mongoUri}`);
  } catch (err) {
    console.warn('[Server] MongoDB connection failed, running in-memory:', err);
  }
}

/**
 * Get or create a Y.Doc for a room (with persistence)
 */
async function getYDoc(docName: string): Promise<DocState> {
  let docState = docs.get(docName);
  if (docState) return docState;

  const doc = new Y.Doc();
  docState = { doc, conns: new Set() };
  docs.set(docName, docState);

  // Load persisted state if available
  if (mdb) {
    try {
      const persistedDoc = await mdb.getYDoc(docName);
      const update = Y.encodeStateAsUpdate(persistedDoc);
      Y.applyUpdate(doc, update);
      console.log(`[Server] Loaded room ${docName} from MongoDB`);
    } catch {
      console.log(`[Server] No persisted state for ${docName}, starting fresh`);
    }

    // Migrate flat docs to page-based structure
    migrateToPages(doc);

    // Repair orphaned connections (references to deleted nodes)
    repairOrphanedConnections(doc);

    // Persist future updates
    doc.on('update', (update: Uint8Array) => {
      mdb!.storeUpdate(docName, update).catch((err: unknown) => {
        console.error(`[Server] Failed to persist update for ${docName}:`, err);
      });
    });
  }

  console.log(`[Server] Room created: ${docName}`);
  return docState;
}

// Create the server handlers using the factory
const { handleHttpRequest, setupWSConnection } = createDocumentServer({
  getDoc: getYDoc,
  getActiveRooms: () => Array.from(docs.entries()).map(([roomId, docState]) => ({
    roomId,
    clientCount: docState.conns.size,
  })),
  listDocuments: async (): Promise<DocumentSummary[]> => {
    return Array.from(docs.entries()).map(([roomId, docState]) => {
      const doc = extractDocument(docState.doc, roomId, getActivePageId(docState.doc));
      return {
        id: roomId,
        title: doc.title,
        folder: doc.folder,
        updatedAt: doc.updatedAt,
        nodeCount: doc.nodes.length,
      };
    });
  },
  deleteDocument: async (roomId: string): Promise<boolean> => {
    docs.delete(roomId);
    if (mdb) {
      try {
        await mdb.clearDocument(roomId);
      } catch (err) {
        console.warn(`[Server] Failed to clear document ${roomId} from MongoDB:`, err);
      }
    }
    return true;
  },
  logPrefix: '[Server]',
  healthMeta: {
    get rooms() { return docs.size; },
    get storage() { return mdb ? 'mongodb' : 'memory'; },
  },
});

/**
 * Start the server. Returns a handle for programmatic stop.
 */
export async function startServer(options?: StartServerOptions): Promise<ServerInstance> {
  const port = options?.port ?? parseInt(process.env.PORT || '1234', 10);
  const host = options?.host ?? (process.env.HOST || '0.0.0.0');

  await initPersistence();

  const server = http.createServer((req, res) => {
    handleHttpRequest(req, res).catch((err) => {
      console.error('[Server] Unhandled HTTP error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    });
  });

  const wss = new WebSocketServer({ server });

  wss.on('connection', (conn, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const roomName = url.pathname.slice(1) || 'default';
    setupWSConnection(conn, roomName);
  });

  const actualPort = await new Promise<number>((resolve, reject) => {
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`[Server] Port ${port} is already in use. Kill the existing process (lsof -i :${port}) or use a different PORT.`));
      } else {
        reject(err);
      }
    });
    server.listen(port, host, () => {
      const addr = server.address() as { port: number };
      console.log(`[Server] Carta document server running on ${host}:${addr.port}`);
      console.log(`[Server] WebSocket: ws://${host}:${addr.port}/<room-name>`);
      console.log(`[Server] REST API: http://${host}:${addr.port}/api/documents`);
      console.log(`[Server] Health check: http://${host}:${addr.port}/health`);
      resolve(addr.port);
    });
  });

  return { server, wss, port: actualPort };
}

/**
 * Gracefully stop the server.
 */
export async function stopServer(instance: ServerInstance): Promise<void> {
  console.log('[Server] Shutting down...');

  if (mdb) {
    try {
      await mdb.destroy();
      console.log('[Server] MongoDB connection closed');
    } catch (err) {
      console.error('[Server] Error closing MongoDB:', err);
    }
  }

  instance.wss.close();
  await new Promise<void>((resolve) => {
    instance.server.close(() => {
      console.log('[Server] Server closed');
      resolve();
    });
  });
}
