#!/usr/bin/env node
/**
 * Carta Document Server
 *
 * WebSocket server for Yjs document synchronization with HTTP REST API.
 * Supports optional MongoDB persistence via y-mongodb-provider.
 *
 * Usage:
 *   pnpm document-server
 *   # or
 *   node dist/document-server.js
 *
 * Environment variables:
 *   PORT - Server port (default: 1234)
 *   HOST - Server host (default: 0.0.0.0)
 *   MONGODB_URI - MongoDB connection string (default: mongodb://localhost:27017/carta)
 *   PERSISTENCE - Set to 'false' to disable persistence (default: true)
 */

import * as http from 'node:http';
import * as Y from 'yjs';
import { WebSocketServer } from 'ws';
import { MongodbPersistence } from 'y-mongodb-provider';
import {
  migrateToLevels,
  migrateToVisualGroups,
  repairOrphanedConnections,
  extractDocument,
} from '@carta/document';
import {
  createDocumentServer,
  getActiveLevelId,
  type DocState,
  type DocumentSummary,
} from './document-server-core.js';

const PORT = parseInt(process.env.PORT || '1234', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/carta';
const PERSISTENCE_ENABLED = process.env.PERSISTENCE !== 'false';

/**
 * Active documents (rooms) keyed by room ID
 */
const docs = new Map<string, DocState>();

/**
 * MongoDB persistence (initialized async)
 */
let mdb: MongodbPersistence | null = null;

/**
 * Initialize MongoDB persistence
 */
async function initPersistence(): Promise<void> {
  if (!PERSISTENCE_ENABLED) {
    console.log('[Server] Persistence disabled, running in-memory only');
    return;
  }

  try {
    mdb = new MongodbPersistence(MONGODB_URI, {
      collectionName: 'yjs-documents',
      flushSize: 100,
    });
    console.log(`[Server] MongoDB persistence enabled: ${MONGODB_URI}`);
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

    // Migrate flat docs to level-based structure
    migrateToLevels(doc);

    // Migrate deployables/schemaGroups to visualGroups
    migrateToVisualGroups(doc);

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
  listDocuments: async (): Promise<DocumentSummary[]> => {
    return Array.from(docs.entries()).map(([roomId, docState]) => {
      const doc = extractDocument(docState.doc, roomId, getActiveLevelId(docState.doc));
      return {
        id: roomId,
        title: doc.title,
        folder: doc.folder,
        version: doc.version,
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
    get persistence() { return mdb ? 'mongodb' : 'memory'; },
  },
});

/**
 * Start the server
 */
async function startServer(): Promise<void> {
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

  server.listen(PORT, HOST, () => {
    console.log(`[Server] Carta document server running on ${HOST}:${PORT}`);
    console.log(`[Server] WebSocket: ws://${HOST}:${PORT}/<room-name>`);
    console.log(`[Server] REST API: http://${HOST}:${PORT}/api/documents`);
    console.log(`[Server] Health check: http://${HOST}:${PORT}/health`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Server] Shutting down...');

    if (mdb) {
      try {
        await mdb.destroy();
        console.log('[Server] MongoDB connection closed');
      } catch (err) {
        console.error('[Server] Error closing MongoDB:', err);
      }
    }

    wss.close();
    server.close(() => {
      console.log('[Server] Server closed');
      process.exit(0);
    });
  });
}

startServer();
