#!/usr/bin/env node
/**
 * Carta Collaboration Server
 *
 * WebSocket server for Yjs document synchronization with HTTP API for room discovery.
 * Supports optional MongoDB persistence via y-mongodb-provider.
 *
 * Usage:
 *   npm run collab-server
 *   # or
 *   node dist/collab-server.js
 *
 * Environment variables:
 *   PORT - Server port (default: 1234)
 *   HOST - Server host (default: 0.0.0.0)
 *   MONGODB_URI - MongoDB connection string (default: mongodb://localhost:27017/carta)
 *   PERSISTENCE - Set to 'false' to disable persistence (default: true)
 */

import * as http from 'node:http';
import * as Y from 'yjs';
import { WebSocketServer, WebSocket } from 'ws';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { MongodbPersistence } from 'y-mongodb-provider';

const PORT = parseInt(process.env.PORT || '1234', 10);
const HOST = process.env.HOST || '0.0.0.0';
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/carta';
const PERSISTENCE_ENABLED = process.env.PERSISTENCE !== 'false';

/**
 * Message types for Yjs sync protocol
 */
const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

/**
 * Document state
 */
interface DocState {
  doc: Y.Doc;
  conns: Set<WebSocket>;
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
 * Initialize MongoDB persistence
 */
async function initPersistence(): Promise<void> {
  if (!PERSISTENCE_ENABLED) {
    console.log('[Collab] Persistence disabled, running in-memory only');
    return;
  }

  try {
    mdb = new MongodbPersistence(MONGODB_URI, {
      collectionName: 'yjs-documents',
      flushSize: 100,
    });
    console.log(`[Collab] MongoDB persistence enabled: ${MONGODB_URI}`);
  } catch (err) {
    console.warn('[Collab] MongoDB connection failed, running in-memory:', err);
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
      console.log(`[Collab] Loaded room ${docName} from MongoDB`);
    } catch {
      console.log(`[Collab] No persisted state for ${docName}, starting fresh`);
    }

    // Persist future updates
    doc.on('update', (update: Uint8Array) => {
      mdb!.storeUpdate(docName, update).catch((err: unknown) => {
        console.error(`[Collab] Failed to persist update for ${docName}:`, err);
      });
    });
  }

  console.log(`[Collab] Room created: ${docName}`);
  return docState;
}

/**
 * Send sync step 1 to client
 */
function sendSyncStep1(conn: WebSocket, doc: Y.Doc): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  const message = encoding.toUint8Array(encoder);
  if (conn.readyState === WebSocket.OPEN) {
    conn.send(message);
  }
}

/**
 * Broadcast update to all connections except origin
 */
function broadcastUpdate(docState: DocState, update: Uint8Array, origin: WebSocket | null): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  const message = encoding.toUint8Array(encoder);

  for (const conn of docState.conns) {
    if (conn !== origin && conn.readyState === WebSocket.OPEN) {
      conn.send(message);
    }
  }
}

/**
 * Handle incoming WebSocket messages
 */
function handleMessage(conn: WebSocket, docState: DocState, message: Uint8Array): void {
  const { doc } = docState;

  try {
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MESSAGE_SYNC: {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, MESSAGE_SYNC);
        const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, null);

        // Send response if we have one (sync step 2 or update acknowledgment)
        if (encoding.length(encoder) > 1) {
          const response = encoding.toUint8Array(encoder);
          if (conn.readyState === WebSocket.OPEN) {
            conn.send(response);
          }
        }

        // If it was an update, broadcast to other clients
        if (syncMessageType === syncProtocol.messageYjsUpdate) {
          // The update was already applied to doc, broadcast the state
          const update = Y.encodeStateAsUpdate(doc);
          broadcastUpdate(docState, update, conn);
        }
        break;
      }
      case MESSAGE_AWARENESS: {
        // Broadcast awareness to all other connections
        for (const c of docState.conns) {
          if (c !== conn && c.readyState === WebSocket.OPEN) {
            c.send(message);
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error('[Collab] Error handling message:', err);
  }
}

/**
 * Setup WebSocket connection for Yjs sync
 */
async function setupWSConnection(conn: WebSocket, docName: string): Promise<void> {
  const docState = await getYDoc(docName);
  const { doc } = docState;

  docState.conns.add(conn);
  console.log(`[Collab] Client connected to room: ${docName} (${docState.conns.size} clients)`);

  // Send sync step 1
  sendSyncStep1(conn, doc);

  // Handle messages
  conn.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
    let message: Uint8Array;
    if (data instanceof ArrayBuffer) {
      message = new Uint8Array(data);
    } else if (Buffer.isBuffer(data)) {
      message = new Uint8Array(data);
    } else if (Array.isArray(data)) {
      message = new Uint8Array(Buffer.concat(data));
    } else {
      message = new Uint8Array(data as Buffer);
    }
    handleMessage(conn, docState, message);
  });

  // Handle updates from the doc (from other sources)
  const updateHandler = (update: Uint8Array, origin: unknown) => {
    // Only broadcast if origin is a different connection
    if (origin !== conn && origin !== 'local') {
      broadcastUpdate(docState, update, origin as WebSocket | null);
    }
  };
  doc.on('update', updateHandler);

  // Handle close
  conn.on('close', () => {
    doc.off('update', updateHandler);
    docState.conns.delete(conn);
    console.log(`[Collab] Client disconnected from room: ${docName} (${docState.conns.size} clients)`);

    // Clean up empty rooms after a delay (but keep data)
    if (docState.conns.size === 0) {
      console.log(`[Collab] Room ${docName} has no clients but data is preserved`);
    }
  });

  conn.on('error', (err) => {
    console.error(`[Collab] WebSocket error in room ${docName}:`, err);
  });
}

/**
 * Handle HTTP requests
 */
function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (url.pathname === '/rooms' && req.method === 'GET') {
    // Room discovery endpoint
    const rooms = Array.from(docs.entries()).map(([roomId, docState]) => ({
      roomId,
      clientCount: docState.conns.size,
    }));

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ rooms }));
    return;
  }

  if (url.pathname === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      rooms: docs.size,
      persistence: mdb ? 'mongodb' : 'memory'
    }));
    return;
  }

  // Not found
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  await initPersistence();

  // Create HTTP server
  const server = http.createServer(handleHttpRequest);

  // Create WebSocket server
  const wss = new WebSocketServer({ server });

  wss.on('connection', (conn, req) => {
    // Extract room name from URL path
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const roomName = url.pathname.slice(1) || 'default';

    setupWSConnection(conn, roomName);
  });

  server.listen(PORT, HOST, () => {
    console.log(`[Collab] Carta collaboration server running on ${HOST}:${PORT}`);
    console.log(`[Collab] WebSocket: ws://${HOST}:${PORT}/<room-name>`);
    console.log(`[Collab] Room discovery: http://${HOST}:${PORT}/rooms`);
    console.log(`[Collab] Health check: http://${HOST}:${PORT}/health`);
  });

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[Collab] Shutting down...');

    // Flush MongoDB if enabled
    if (mdb) {
      try {
        await mdb.destroy();
        console.log('[Collab] MongoDB connection closed');
      } catch (err) {
        console.error('[Collab] Error closing MongoDB:', err);
      }
    }

    wss.close();
    server.close(() => {
      console.log('[Collab] Server closed');
      process.exit(0);
    });
  });
}

startServer();
