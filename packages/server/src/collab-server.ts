#!/usr/bin/env node
/**
 * Carta Collaboration Server
 *
 * WebSocket server for Yjs document synchronization with HTTP REST API.
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
import { portRegistry } from '@carta/domain';
import * as docOps from './doc-operations.js';

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
 * Parse JSON body from request
 */
async function parseJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : ({} as T));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
  });
}

/**
 * Send JSON response
 */
function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

/**
 * Send error response
 */
function sendError(res: http.ServerResponse, status: number, message: string, code?: string): void {
  sendJson(res, status, { error: message, code });
}

/**
 * Handle HTTP requests
 */
async function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method || 'GET';

  try {
    // ===== LEGACY ENDPOINTS =====

    if (path === '/rooms' && method === 'GET') {
      // Room discovery endpoint (legacy)
      const rooms = Array.from(docs.entries()).map(([roomId, docState]) => ({
        roomId,
        clientCount: docState.conns.size,
      }));
      sendJson(res, 200, { rooms });
      return;
    }

    if (path === '/health' && method === 'GET') {
      sendJson(res, 200, {
        status: 'ok',
        rooms: docs.size,
        persistence: mdb ? 'mongodb' : 'memory',
      });
      return;
    }

    // ===== API ENDPOINTS =====

    // GET /api/rooms - List active rooms
    if (path === '/api/rooms' && method === 'GET') {
      const rooms = Array.from(docs.entries()).map(([roomId, docState]) => ({
        roomId,
        clientCount: docState.conns.size,
      }));
      sendJson(res, 200, { rooms });
      return;
    }

    // GET /api/documents - List all documents (active rooms)
    if (path === '/api/documents' && method === 'GET') {
      const documents = Array.from(docs.entries()).map(([roomId, docState]) => {
        const doc = docOps.extractDocument(docState.doc, roomId);
        return {
          id: roomId,
          title: doc.title,
          version: doc.version,
          updatedAt: doc.updatedAt,
          nodeCount: doc.nodes.length,
        };
      });
      sendJson(res, 200, { documents });
      return;
    }

    // POST /api/documents - Create new document
    if (path === '/api/documents' && method === 'POST') {
      const body = await parseJsonBody<{ title?: string }>(req);
      const title = body.title || 'Untitled Project';
      const roomId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const docState = await getYDoc(roomId);
      const ymeta = docState.doc.getMap('meta');
      docState.doc.transact(() => {
        ymeta.set('title', title);
        ymeta.set('version', 3);
      }, 'mcp');

      const document = docOps.extractDocument(docState.doc, roomId);
      sendJson(res, 201, { document });
      return;
    }

    // GET /api/documents/:id - Get document
    const docMatch = path.match(/^\/api\/documents\/([^/]+)$/);
    if (docMatch && method === 'GET') {
      const roomId = docMatch[1]!;
      const docState = await getYDoc(roomId);
      const document = docOps.extractDocument(docState.doc, roomId);
      sendJson(res, 200, { document });
      return;
    }

    // DELETE /api/documents/:id - Delete document
    if (docMatch && method === 'DELETE') {
      const roomId = docMatch[1]!;
      // Remove from docs Map
      docs.delete(roomId);
      // Clear from MongoDB if enabled
      if (mdb) {
        try {
          await mdb.clearDocument(roomId);
        } catch (err) {
          console.warn(`[Collab] Failed to clear document ${roomId} from MongoDB:`, err);
        }
      }
      sendJson(res, 200, { deleted: true });
      return;
    }

    // PATCH /api/documents/:id - Rename document
    if (docMatch && method === 'PATCH') {
      const roomId = docMatch[1]!;
      const body = await parseJsonBody<{ title?: string }>(req);
      const docState = await getYDoc(roomId);
      docState.doc.transact(() => {
        if (body.title !== undefined) {
          docState.doc.getMap('meta').set('title', body.title);
        }
      }, 'mcp');
      const document = docOps.extractDocument(docState.doc, roomId);
      sendJson(res, 200, { document });
      return;
    }

    // GET /api/documents/:id/constructs - List constructs
    const constructsMatch = path.match(/^\/api\/documents\/([^/]+)\/constructs$/);
    if (constructsMatch && method === 'GET') {
      const roomId = constructsMatch[1]!;
      const docState = await getYDoc(roomId);
      const constructs = docOps.listConstructs(docState.doc);
      sendJson(res, 200, { constructs: constructs.map((c) => c.data) });
      return;
    }

    // POST /api/documents/:id/constructs - Create construct
    if (constructsMatch && method === 'POST') {
      const roomId = constructsMatch[1]!;
      const body = await parseJsonBody<{
        constructType: string;
        values?: Record<string, unknown>;
        x?: number;
        y?: number;
      }>(req);

      if (!body.constructType) {
        sendError(res, 400, 'constructType is required', 'MISSING_FIELD');
        return;
      }

      const docState = await getYDoc(roomId);
      const construct = docOps.createConstruct(
        docState.doc,
        body.constructType,
        body.values || {},
        { x: body.x || 100, y: body.y || 100 }
      );
      sendJson(res, 201, { construct: construct.data });
      return;
    }

    // GET /api/documents/:id/constructs/:semanticId - Get construct
    const constructMatch = path.match(/^\/api\/documents\/([^/]+)\/constructs\/([^/]+)$/);
    if (constructMatch && method === 'GET') {
      const roomId = constructMatch[1]!;
      const semanticId = decodeURIComponent(constructMatch[2]!);
      const docState = await getYDoc(roomId);
      const construct = docOps.getConstruct(docState.doc, semanticId);
      if (!construct) {
        sendError(res, 404, `Construct not found: ${semanticId}`, 'NOT_FOUND');
        return;
      }
      sendJson(res, 200, { construct: construct.data });
      return;
    }

    // PATCH /api/documents/:id/constructs/:semanticId - Update construct
    if (constructMatch && method === 'PATCH') {
      const roomId = constructMatch[1]!;
      const semanticId = decodeURIComponent(constructMatch[2]!);
      const body = await parseJsonBody<{
        values?: Record<string, unknown>;
        deployableId?: string | null;
      }>(req);

      const docState = await getYDoc(roomId);
      const construct = docOps.updateConstruct(docState.doc, semanticId, body);
      if (!construct) {
        sendError(res, 404, `Construct not found: ${semanticId}`, 'NOT_FOUND');
        return;
      }
      sendJson(res, 200, { construct: construct.data });
      return;
    }

    // DELETE /api/documents/:id/constructs/:semanticId - Delete construct
    if (constructMatch && method === 'DELETE') {
      const roomId = constructMatch[1]!;
      const semanticId = decodeURIComponent(constructMatch[2]!);
      const docState = await getYDoc(roomId);
      const deleted = docOps.deleteConstruct(docState.doc, semanticId);
      sendJson(res, 200, { deleted });
      return;
    }

    // POST /api/documents/:id/connections - Connect constructs
    const connectionsMatch = path.match(/^\/api\/documents\/([^/]+)\/connections$/);
    if (connectionsMatch && method === 'POST') {
      const roomId = connectionsMatch[1]!;
      const body = await parseJsonBody<{
        sourceSemanticId: string;
        sourcePortId: string;
        targetSemanticId: string;
        targetPortId: string;
      }>(req);

      if (!body.sourceSemanticId || !body.sourcePortId || !body.targetSemanticId || !body.targetPortId) {
        sendError(res, 400, 'Missing required fields', 'MISSING_FIELD');
        return;
      }

      const docState = await getYDoc(roomId);
      const edge = docOps.connect(
        docState.doc,
        body.sourceSemanticId,
        body.sourcePortId,
        body.targetSemanticId,
        body.targetPortId
      );
      if (!edge) {
        sendError(res, 400, 'Failed to connect constructs', 'CONNECT_FAILED');
        return;
      }
      sendJson(res, 201, { edge });
      return;
    }

    // DELETE /api/documents/:id/connections - Disconnect constructs
    if (connectionsMatch && method === 'DELETE') {
      const roomId = connectionsMatch[1]!;
      const body = await parseJsonBody<{
        sourceSemanticId: string;
        sourcePortId: string;
        targetSemanticId: string;
      }>(req);

      if (!body.sourceSemanticId || !body.sourcePortId || !body.targetSemanticId) {
        sendError(res, 400, 'Missing required fields', 'MISSING_FIELD');
        return;
      }

      const docState = await getYDoc(roomId);
      const disconnected = docOps.disconnect(
        docState.doc,
        body.sourceSemanticId,
        body.sourcePortId,
        body.targetSemanticId
      );
      sendJson(res, 200, { disconnected });
      return;
    }

    // GET /api/documents/:id/schemas - List schemas
    const schemasMatch = path.match(/^\/api\/documents\/([^/]+)\/schemas$/);
    if (schemasMatch && method === 'GET') {
      const roomId = schemasMatch[1]!;
      const docState = await getYDoc(roomId);
      const schemas = docOps.listSchemas(docState.doc);
      sendJson(res, 200, { schemas });
      return;
    }

    // POST /api/documents/:id/schemas - Create schema
    if (schemasMatch && method === 'POST') {
      const roomId = schemasMatch[1]!;
      const body = await parseJsonBody<{
        type: string;
        displayName: string;
        color: string;
        semanticDescription?: string;
        groupId?: string;
        fields: Array<{
          name: string;
          label: string;
          type: string;
          semanticDescription?: string;
          options?: Array<{ value: string; semanticDescription?: string }>;
          default?: unknown;
          placeholder?: string;
          displayHint?: string;
          displayTier?: string;
          displayOrder?: number;
        }>;
        ports?: Array<{
          id: string;
          portType: string;
          position: string;
          offset: number;
          label: string;
          semanticDescription?: string;
        }>;
      }>(req);

      if (!body.type || !body.displayName || !body.color || !body.fields) {
        sendError(res, 400, 'Missing required fields', 'MISSING_FIELD');
        return;
      }

      const docState = await getYDoc(roomId);
      const schema = docOps.createSchema(docState.doc, {
        type: body.type,
        displayName: body.displayName,
        color: body.color,
        semanticDescription: body.semanticDescription,
        groupId: body.groupId,
        fields: body.fields,
        ports: body.ports,
        compilation: { format: 'json' },
      } as any);

      if (!schema) {
        sendError(res, 400, 'Schema type already exists', 'ALREADY_EXISTS');
        return;
      }
      sendJson(res, 201, { schema });
      return;
    }

    // GET /api/documents/:id/schemas/:type - Get schema
    const schemaMatch = path.match(/^\/api\/documents\/([^/]+)\/schemas\/([^/]+)$/);
    if (schemaMatch && method === 'GET') {
      const roomId = schemaMatch[1]!;
      const type = decodeURIComponent(schemaMatch[2]!);
      const docState = await getYDoc(roomId);
      const schema = docOps.getSchema(docState.doc, type);
      if (!schema) {
        sendError(res, 404, `Schema not found: ${type}`, 'NOT_FOUND');
        return;
      }
      sendJson(res, 200, { schema });
      return;
    }

    // DELETE /api/documents/:id/schemas/:type - Delete schema
    if (schemaMatch && method === 'DELETE') {
      const roomId = schemaMatch[1]!;
      const type = decodeURIComponent(schemaMatch[2]!);
      const docState = await getYDoc(roomId);
      const deleted = docOps.removeSchema(docState.doc, type);
      if (!deleted) {
        sendError(res, 404, `Schema not found: ${type}`, 'NOT_FOUND');
        return;
      }
      sendJson(res, 200, { deleted: true });
      return;
    }

    // GET /api/documents/:id/deployables - List deployables
    const deployablesMatch = path.match(/^\/api\/documents\/([^/]+)\/deployables$/);
    if (deployablesMatch && method === 'GET') {
      const roomId = deployablesMatch[1]!;
      const docState = await getYDoc(roomId);
      const deployables = docOps.listDeployables(docState.doc);
      sendJson(res, 200, { deployables });
      return;
    }

    // POST /api/documents/:id/deployables - Create deployable
    if (deployablesMatch && method === 'POST') {
      const roomId = deployablesMatch[1]!;
      const body = await parseJsonBody<{
        name: string;
        description: string;
        color?: string;
      }>(req);

      if (!body.name || !body.description) {
        sendError(res, 400, 'name and description are required', 'MISSING_FIELD');
        return;
      }

      const docState = await getYDoc(roomId);
      const deployable = docOps.createDeployable(
        docState.doc,
        body.name,
        body.description,
        body.color
      );
      sendJson(res, 201, { deployable });
      return;
    }

    // GET /api/documents/:id/compile - Compile document
    const compileMatch = path.match(/^\/api\/documents\/([^/]+)\/compile$/);
    if (compileMatch && method === 'GET') {
      const roomId = compileMatch[1]!;
      const docState = await getYDoc(roomId);
      const output = docOps.compile(docState.doc);
      sendJson(res, 200, { output });
      return;
    }

    // GET /api/documents/:id/port-types - List port types
    const portTypesMatch = path.match(/^\/api\/documents\/([^/]+)\/port-types$/);
    if (portTypesMatch && method === 'GET') {
      const portTypes = portRegistry.getAll();
      sendJson(res, 200, { portTypes });
      return;
    }

    // Not found
    sendError(res, 404, 'Not found', 'NOT_FOUND');
  } catch (err) {
    console.error('[Collab] HTTP error:', err);
    sendError(res, 500, String(err), 'INTERNAL_ERROR');
  }
}

/**
 * Start the server
 */
async function startServer(): Promise<void> {
  await initPersistence();

  // Create HTTP server (wrap async handler)
  const server = http.createServer((req, res) => {
    handleHttpRequest(req, res).catch((err) => {
      console.error('[Collab] Unhandled HTTP error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    });
  });

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
    console.log(`[Collab] REST API: http://${HOST}:${PORT}/api/documents`);
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
