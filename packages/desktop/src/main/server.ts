/**
 * Embedded Document Server for Carta Desktop
 *
 * Lightweight HTTP + WebSocket server running in the Electron main process.
 * Provides the same REST API as the collab-server but persists Y.Doc snapshots
 * to the filesystem instead of MongoDB.
 *
 * Persistence: Binary Y.Doc snapshots in {userData}/documents/
 *   - {docId}.ydoc — full Y.Doc state via Y.encodeStateAsUpdate()
 *   - registry.json — lightweight metadata: { id, title, updatedAt, nodeCount }[]
 *   - Debounced save on Y.Doc changes (~2s)
 *   - Flush on app quit
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as Y from 'yjs';
import { WebSocketServer, WebSocket } from 'ws';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { portRegistry } from '@carta/domain';
import {
  listConstructs,
  getConstruct,
  createConstruct,
  updateConstruct,
  deleteConstruct,
  connect,
  disconnect,
  listSchemas,
  getSchema,
  createSchema,
  removeSchema,
  listDeployables,
  createDeployable,
  compile,
  extractDocument,
  migrateToLevels,
} from '@carta/document';
import type { ConstructSchema } from '@carta/domain';

// ===== TYPES =====

interface DocState {
  doc: Y.Doc;
  conns: Set<WebSocket>;
  dirty: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
}

interface RegistryEntry {
  id: string;
  title: string;
  updatedAt: string;
  nodeCount: number;
}

export interface EmbeddedServerInfo {
  url: string;
  wsUrl: string;
  port: number;
}

// ===== CONSTANTS =====

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;
const DEFAULT_PORT = 51234;
const SAVE_DEBOUNCE_MS = 2000;

// ===== STATE =====

let documentsDir: string;
let serverInfoPath: string;
const docs = new Map<string, DocState>();
let httpServer: http.Server | null = null;
let wss: WebSocketServer | null = null;

// ===== PERSISTENCE =====

function ensureDocumentsDir(): void {
  if (!fs.existsSync(documentsDir)) {
    fs.mkdirSync(documentsDir, { recursive: true });
  }
}

function getDocPath(docId: string): string {
  return path.join(documentsDir, `${docId}.ydoc`);
}

function getRegistryPath(): string {
  return path.join(documentsDir, 'registry.json');
}

function readRegistry(): RegistryEntry[] {
  const registryPath = getRegistryPath();
  if (!fs.existsSync(registryPath)) return [];
  try {
    return JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  } catch {
    return [];
  }
}

function writeRegistry(entries: RegistryEntry[]): void {
  ensureDocumentsDir();
  fs.writeFileSync(getRegistryPath(), JSON.stringify(entries, null, 2));
}

function updateRegistryEntry(docId: string, doc: Y.Doc): void {
  const registry = readRegistry();
  const ymeta = doc.getMap('meta');
  const title = (ymeta.get('title') as string) || 'Untitled Project';
  const levelId = getActiveLevelId(doc);
  const levelNodes = doc.getMap<Y.Map<unknown>>('nodes').get(levelId);
  const nodeCount = levelNodes ? levelNodes.size : 0;

  const existing = registry.findIndex((e) => e.id === docId);
  const entry: RegistryEntry = {
    id: docId,
    title,
    updatedAt: new Date().toISOString(),
    nodeCount,
  };

  if (existing >= 0) {
    registry[existing] = entry;
  } else {
    registry.push(entry);
  }

  writeRegistry(registry);
}

function removeRegistryEntry(docId: string): void {
  const registry = readRegistry().filter((e) => e.id !== docId);
  writeRegistry(registry);
}

function saveDocToDisk(docId: string, doc: Y.Doc): void {
  ensureDocumentsDir();
  const update = Y.encodeStateAsUpdate(doc);
  fs.writeFileSync(getDocPath(docId), Buffer.from(update));
  updateRegistryEntry(docId, doc);
}

function loadDocFromDisk(docId: string, doc: Y.Doc): boolean {
  const docPath = getDocPath(docId);
  if (!fs.existsSync(docPath)) return false;
  try {
    const data = fs.readFileSync(docPath);
    Y.applyUpdate(doc, new Uint8Array(data));
    return true;
  } catch {
    return false;
  }
}

function scheduleSave(docId: string, docState: DocState): void {
  docState.dirty = true;
  if (docState.saveTimer) {
    clearTimeout(docState.saveTimer);
  }
  docState.saveTimer = setTimeout(() => {
    if (docState.dirty) {
      saveDocToDisk(docId, docState.doc);
      docState.dirty = false;
    }
    docState.saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

// ===== Y.DOC LIFECYCLE =====

function getActiveLevelId(ydoc: Y.Doc): string {
  const ymeta = ydoc.getMap('meta');
  const active = ymeta.get('activeLevel') as string | undefined;
  if (active) return active;
  const ylevels = ydoc.getMap<Y.Map<unknown>>('levels');
  let firstId: string | undefined;
  let firstOrder = Infinity;
  ylevels.forEach((ylevel, id) => {
    const order = (ylevel as Y.Map<unknown>).get('order') as number ?? 0;
    if (order < firstOrder) { firstOrder = order; firstId = id; }
  });
  return firstId!;
}

function getOrCreateDoc(docId: string): DocState {
  let docState = docs.get(docId);
  if (docState) return docState;

  const doc = new Y.Doc();
  docState = { doc, conns: new Set(), dirty: false, saveTimer: null };
  docs.set(docId, docState);

  // Load from disk
  loadDocFromDisk(docId, doc);

  // Migrate flat docs to level-based structure
  migrateToLevels(doc);

  // Schedule saves on updates
  doc.on('update', () => {
    scheduleSave(docId, docState!);
  });

  return docState;
}

// ===== WEBSOCKET SYNC =====

function sendSyncStep1(conn: WebSocket, doc: Y.Doc): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  const message = encoding.toUint8Array(encoder);
  if (conn.readyState === WebSocket.OPEN) {
    conn.send(message);
  }
}

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

        if (encoding.length(encoder) > 1) {
          const response = encoding.toUint8Array(encoder);
          if (conn.readyState === WebSocket.OPEN) {
            conn.send(response);
          }
        }

        if (syncMessageType === syncProtocol.messageYjsUpdate) {
          const update = Y.encodeStateAsUpdate(doc);
          broadcastUpdate(docState, update, conn);
        }
        break;
      }
      case MESSAGE_AWARENESS: {
        for (const c of docState.conns) {
          if (c !== conn && c.readyState === WebSocket.OPEN) {
            c.send(message);
          }
        }
        break;
      }
    }
  } catch (err) {
    console.error('[Desktop Server] Error handling message:', err);
  }
}

function setupWSConnection(conn: WebSocket, docName: string): void {
  const docState = getOrCreateDoc(docName);
  const { doc } = docState;

  docState.conns.add(conn);

  sendSyncStep1(conn, doc);

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

  const updateHandler = (update: Uint8Array, origin: unknown) => {
    if (origin !== conn && origin !== 'local') {
      broadcastUpdate(docState, update, origin as WebSocket | null);
    }
  };
  doc.on('update', updateHandler);

  conn.on('close', () => {
    doc.off('update', updateHandler);
    docState.conns.delete(conn);
  });

  conn.on('error', (err) => {
    console.error(`[Desktop Server] WebSocket error:`, err);
  });
}

// ===== HTTP HELPERS =====

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

function sendJson(res: http.ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data, null, 2));
}

function sendError(res: http.ServerResponse, status: number, message: string, code?: string): void {
  sendJson(res, status, { error: message, code });
}

// ===== HTTP REQUEST HANDLER =====

async function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  // CORS headers (needed for renderer in dev mode)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://${req.headers.host}`);
  const urlPath = url.pathname;
  const method = req.method || 'GET';

  try {
    // ===== HEALTH =====

    if (urlPath === '/health' && method === 'GET') {
      sendJson(res, 200, {
        status: 'ok',
        rooms: docs.size,
        persistence: 'filesystem',
      });
      return;
    }

    // ===== ROOMS =====

    if ((urlPath === '/rooms' || urlPath === '/api/rooms') && method === 'GET') {
      const rooms = Array.from(docs.entries())
        .filter(([, ds]) => ds.conns.size > 0)
        .map(([roomId, ds]) => ({
          roomId,
          clientCount: ds.conns.size,
        }));
      sendJson(res, 200, { rooms });
      return;
    }

    // ===== DOCUMENTS =====

    // GET /api/documents — list all documents from registry
    if (urlPath === '/api/documents' && method === 'GET') {
      const registry = readRegistry();
      const documents = registry.map((entry) => ({
        id: entry.id,
        title: entry.title,
        updatedAt: entry.updatedAt,
        nodeCount: entry.nodeCount,
      }));
      sendJson(res, 200, { documents });
      return;
    }

    // POST /api/documents — create new document
    if (urlPath === '/api/documents' && method === 'POST') {
      const body = await parseJsonBody<{ title?: string }>(req);
      const title = body.title || 'Untitled Project';
      const roomId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const docState = getOrCreateDoc(roomId);
      docState.doc.transact(() => {
        docState.doc.getMap('meta').set('title', title);
        docState.doc.getMap('meta').set('version', 3);
      }, 'mcp');

      // Force immediate save for new documents
      saveDocToDisk(roomId, docState.doc);

      const document = extractDocument(docState.doc, roomId, getActiveLevelId(docState.doc));
      sendJson(res, 201, { document });
      return;
    }

    // GET/DELETE/PATCH /api/documents/:id
    const docMatch = urlPath.match(/^\/api\/documents\/([^/]+)$/);
    if (docMatch) {
      const roomId = docMatch[1]!;

      if (method === 'GET') {
        const docState = getOrCreateDoc(roomId);
        const document = extractDocument(docState.doc, roomId, getActiveLevelId(docState.doc));
        sendJson(res, 200, { document });
        return;
      }

      if (method === 'DELETE') {
        docs.delete(roomId);
        const docPath = getDocPath(roomId);
        if (fs.existsSync(docPath)) {
          fs.unlinkSync(docPath);
        }
        removeRegistryEntry(roomId);
        sendJson(res, 200, { deleted: true });
        return;
      }

      if (method === 'PATCH') {
        const body = await parseJsonBody<{ title?: string }>(req);
        const docState = getOrCreateDoc(roomId);
        docState.doc.transact(() => {
          if (body.title !== undefined) {
            docState.doc.getMap('meta').set('title', body.title);
          }
        }, 'mcp');
        const document = extractDocument(docState.doc, roomId, getActiveLevelId(docState.doc));
        sendJson(res, 200, { document });
        return;
      }
    }

    // ===== CONSTRUCTS =====

    const constructsMatch = urlPath.match(/^\/api\/documents\/([^/]+)\/constructs$/);
    if (constructsMatch) {
      const roomId = constructsMatch[1]!;
      const docState = getOrCreateDoc(roomId);

      if (method === 'GET') {
        const constructs = listConstructs(docState.doc, getActiveLevelId(docState.doc));
        sendJson(res, 200, { constructs: constructs.map((c) => c.data) });
        return;
      }

      if (method === 'POST') {
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

        const construct = createConstruct(
          docState.doc,
          getActiveLevelId(docState.doc),
          body.constructType,
          body.values || {},
          { x: body.x || 100, y: body.y || 100 }
        );
        sendJson(res, 201, { construct: construct.data });
        return;
      }
    }

    const constructMatch = urlPath.match(/^\/api\/documents\/([^/]+)\/constructs\/([^/]+)$/);
    if (constructMatch) {
      const roomId = constructMatch[1]!;
      const semanticId = decodeURIComponent(constructMatch[2]!);
      const docState = getOrCreateDoc(roomId);

      if (method === 'GET') {
        const construct = getConstruct(docState.doc, getActiveLevelId(docState.doc), semanticId);
        if (!construct) {
          sendError(res, 404, `Construct not found: ${semanticId}`, 'NOT_FOUND');
          return;
        }
        sendJson(res, 200, { construct: construct.data });
        return;
      }

      if (method === 'PATCH') {
        const body = await parseJsonBody<{
          values?: Record<string, unknown>;
          deployableId?: string | null;
        }>(req);
        const construct = updateConstruct(docState.doc, getActiveLevelId(docState.doc), semanticId, body);
        if (!construct) {
          sendError(res, 404, `Construct not found: ${semanticId}`, 'NOT_FOUND');
          return;
        }
        sendJson(res, 200, { construct: construct.data });
        return;
      }

      if (method === 'DELETE') {
        const deleted = deleteConstruct(docState.doc, getActiveLevelId(docState.doc), semanticId);
        sendJson(res, 200, { deleted });
        return;
      }
    }

    // ===== CONNECTIONS =====

    const connectionsMatch = urlPath.match(/^\/api\/documents\/([^/]+)\/connections$/);
    if (connectionsMatch) {
      const roomId = connectionsMatch[1]!;
      const docState = getOrCreateDoc(roomId);

      if (method === 'POST') {
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

        const edge = connect(
          docState.doc,
          getActiveLevelId(docState.doc),
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

      if (method === 'DELETE') {
        const body = await parseJsonBody<{
          sourceSemanticId: string;
          sourcePortId: string;
          targetSemanticId: string;
        }>(req);

        if (!body.sourceSemanticId || !body.sourcePortId || !body.targetSemanticId) {
          sendError(res, 400, 'Missing required fields', 'MISSING_FIELD');
          return;
        }

        const disconnected = disconnect(
          docState.doc,
          getActiveLevelId(docState.doc),
          body.sourceSemanticId,
          body.sourcePortId,
          body.targetSemanticId
        );
        sendJson(res, 200, { disconnected });
        return;
      }
    }

    // ===== SCHEMAS =====

    const schemasMatch = urlPath.match(/^\/api\/documents\/([^/]+)\/schemas$/);
    if (schemasMatch) {
      const roomId = schemasMatch[1]!;
      const docState = getOrCreateDoc(roomId);

      if (method === 'GET') {
        const schemas = listSchemas(docState.doc);
        sendJson(res, 200, { schemas });
        return;
      }

      if (method === 'POST') {
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

        const schema = createSchema(docState.doc, {
          type: body.type,
          displayName: body.displayName,
          color: body.color,
          semanticDescription: body.semanticDescription,
          groupId: body.groupId,
          fields: body.fields,
          ports: body.ports,
          compilation: { format: 'json' },
        } as unknown as ConstructSchema);

        if (!schema) {
          sendError(res, 400, 'Schema type already exists', 'ALREADY_EXISTS');
          return;
        }
        sendJson(res, 201, { schema });
        return;
      }
    }

    const schemaMatch = urlPath.match(/^\/api\/documents\/([^/]+)\/schemas\/([^/]+)$/);
    if (schemaMatch) {
      const roomId = schemaMatch[1]!;
      const type = decodeURIComponent(schemaMatch[2]!);
      const docState = getOrCreateDoc(roomId);

      if (method === 'GET') {
        const schema = getSchema(docState.doc, type);
        if (!schema) {
          sendError(res, 404, `Schema not found: ${type}`, 'NOT_FOUND');
          return;
        }
        sendJson(res, 200, { schema });
        return;
      }

      if (method === 'DELETE') {
        const deleted = removeSchema(docState.doc, type);
        if (!deleted) {
          sendError(res, 404, `Schema not found: ${type}`, 'NOT_FOUND');
          return;
        }
        sendJson(res, 200, { deleted: true });
        return;
      }
    }

    // ===== DEPLOYABLES =====

    const deployablesMatch = urlPath.match(/^\/api\/documents\/([^/]+)\/deployables$/);
    if (deployablesMatch) {
      const roomId = deployablesMatch[1]!;
      const docState = getOrCreateDoc(roomId);

      if (method === 'GET') {
        const deployables = listDeployables(docState.doc, getActiveLevelId(docState.doc));
        sendJson(res, 200, { deployables });
        return;
      }

      if (method === 'POST') {
        const body = await parseJsonBody<{
          name: string;
          description: string;
          color?: string;
        }>(req);

        if (!body.name || !body.description) {
          sendError(res, 400, 'name and description are required', 'MISSING_FIELD');
          return;
        }

        const deployable = createDeployable(
          docState.doc,
          getActiveLevelId(docState.doc),
          body.name,
          body.description,
          body.color
        );
        sendJson(res, 201, { deployable });
        return;
      }
    }

    // ===== COMPILE =====

    const compileMatch = urlPath.match(/^\/api\/documents\/([^/]+)\/compile$/);
    if (compileMatch && method === 'GET') {
      const roomId = compileMatch[1]!;
      const docState = getOrCreateDoc(roomId);
      const output = compile(docState.doc, getActiveLevelId(docState.doc));
      sendJson(res, 200, { output });
      return;
    }

    // ===== PORT TYPES =====

    const portTypesMatch = urlPath.match(/^\/api\/documents\/([^/]+)\/port-types$/);
    if (portTypesMatch && method === 'GET') {
      const portTypes = portRegistry.getAll();
      sendJson(res, 200, { portTypes });
      return;
    }

    // ===== NOT FOUND =====
    sendError(res, 404, 'Not found', 'NOT_FOUND');
  } catch (err) {
    console.error('[Desktop Server] HTTP error:', err);
    sendError(res, 500, String(err), 'INTERNAL_ERROR');
  }
}

// ===== PUBLIC API =====

/**
 * Start the embedded document server.
 * @param userDataPath - Electron app.getPath('userData')
 * @returns Server info (URL, WebSocket URL, port)
 */
export async function startEmbeddedServer(userDataPath: string): Promise<EmbeddedServerInfo> {
  documentsDir = path.join(userDataPath, 'documents');
  serverInfoPath = path.join(userDataPath, 'server.json');
  ensureDocumentsDir();

  // Try default port, fall back to random
  const port = await new Promise<number>((resolve) => {
    const server = http.createServer();
    server.listen(DEFAULT_PORT, '127.0.0.1', () => {
      server.close(() => resolve(DEFAULT_PORT));
    });
    server.on('error', () => {
      // Port occupied, use random
      const fallback = http.createServer();
      fallback.listen(0, '127.0.0.1', () => {
        const addr = fallback.address();
        const p = typeof addr === 'object' && addr ? addr.port : 0;
        fallback.close(() => resolve(p));
      });
    });
  });

  httpServer = http.createServer((req, res) => {
    handleHttpRequest(req, res).catch((err) => {
      console.error('[Desktop Server] Unhandled HTTP error:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    });
  });

  wss = new WebSocketServer({ server: httpServer });

  wss.on('connection', (conn, req) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const roomName = url.pathname.slice(1) || 'default';
    setupWSConnection(conn, roomName);
  });

  await new Promise<void>((resolve) => {
    httpServer!.listen(port, '127.0.0.1', () => resolve());
  });

  const info: EmbeddedServerInfo = {
    url: `http://127.0.0.1:${port}`,
    wsUrl: `ws://127.0.0.1:${port}`,
    port,
  };

  // Write server.json for MCP discovery
  const serverJson = {
    url: info.url,
    wsUrl: info.wsUrl,
    pid: process.pid,
  };
  fs.writeFileSync(serverInfoPath, JSON.stringify(serverJson, null, 2));

  console.log(`[Desktop Server] Running on port ${port}`);
  console.log(`[Desktop Server] Documents dir: ${documentsDir}`);

  return info;
}

/**
 * Flush all pending document saves and stop the server.
 */
export async function stopEmbeddedServer(): Promise<void> {
  // Flush all dirty docs
  for (const [docId, docState] of docs) {
    if (docState.saveTimer) {
      clearTimeout(docState.saveTimer);
      docState.saveTimer = null;
    }
    if (docState.dirty) {
      saveDocToDisk(docId, docState.doc);
      docState.dirty = false;
    }
  }

  // Close WebSocket connections
  if (wss) {
    for (const client of wss.clients) {
      client.close();
    }
    wss.close();
    wss = null;
  }

  // Close HTTP server
  if (httpServer) {
    await new Promise<void>((resolve) => {
      httpServer!.close(() => resolve());
    });
    httpServer = null;
  }

  // Clean up server.json
  if (serverInfoPath && fs.existsSync(serverInfoPath)) {
    fs.unlinkSync(serverInfoPath);
  }

  console.log('[Desktop Server] Stopped');
}

/**
 * Get the path where MCP binary expects to find server.json
 */
export function getServerInfoPath(userDataPath: string): string {
  return path.join(userDataPath, 'server.json');
}
