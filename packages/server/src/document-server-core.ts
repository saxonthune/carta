/**
 * Carta Document Server Core
 *
 * Shared HTTP + WebSocket server logic used by both the standalone document server
 * (with MongoDB persistence) and the desktop embedded server (with filesystem persistence).
 *
 * Uses a factory pattern: callers provide persistence-specific callbacks via
 * DocumentServerConfig, and receive generic request handlers in return.
 */

import * as http from 'node:http';
import * as Y from 'yjs';
import { WebSocket } from 'ws';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import { portRegistry, type DocumentSummary } from '@carta/domain';
export type { DocumentSummary };
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
  compile,
  extractDocument,
  listLevels,
  getActiveLevel,
  setActiveLevel,
  createLevel,
  updateLevel,
  deleteLevel,
  listOrganizers,
  createOrganizer,
  updateOrganizer,
  deleteOrganizer,
} from '@carta/document';

// ===== TYPES =====

/**
 * In-memory state for an active document (room).
 */
export interface DocState {
  doc: Y.Doc;
  conns: Set<WebSocket>;
}

/**
 * Persistence-specific callbacks provided by the caller.
 */
export interface DocumentServerConfig {
  /** Get (or create) a DocState for the given document ID. */
  getDoc(docId: string): Promise<DocState>;
  /** List all documents (from persistence, not just in-memory). */
  listDocuments(): Promise<DocumentSummary[]>;
  /** Optional hook called after a new document is created via the REST API. */
  onDocumentCreated?(docId: string, docState: DocState): Promise<void> | void;
  /** Delete a document from persistence. Returns true if deleted. */
  deleteDocument(docId: string): Promise<boolean>;
  /** Prefix for console.log messages (e.g. "[Server]" or "[Desktop Server]"). */
  logPrefix: string;
  /** Return active rooms with connection counts. If not provided, /api/rooms falls back to listDocuments with clientCount: 0. */
  getActiveRooms?(): Array<{ roomId: string; clientCount: number }>;
  /** Extra fields merged into the /health response. */
  healthMeta?: Record<string, unknown>;
}

/**
 * Return value from createDocumentServer().
 */
export interface DocumentServerHandlers {
  handleHttpRequest: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;
  setupWSConnection: (conn: WebSocket, docName: string) => Promise<void>;
}

// ===== CONSTANTS =====

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// ===== UTILITIES =====

/**
 * Get the active level ID for a Y.Doc, falling back to first level by order.
 */
export function getActiveLevelId(ydoc: Y.Doc): string {
  const ymeta = ydoc.getMap('meta');
  const active = ymeta.get('activeLevel') as string | undefined;
  if (active) return active;
  // Fallback: first level by order
  const ylevels = ydoc.getMap<Y.Map<unknown>>('levels');
  let firstId: string | undefined;
  let firstOrder = Infinity;
  ylevels.forEach((ylevel, id) => {
    const order = (ylevel as Y.Map<unknown>).get('order') as number ?? 0;
    if (order < firstOrder) { firstOrder = order; firstId = id; }
  });
  return firstId!;
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

// ===== FACTORY =====

/**
 * Create document server handlers from a persistence config.
 */
export function createDocumentServer(config: DocumentServerConfig): DocumentServerHandlers {
  const { logPrefix } = config;

  // ----- WebSocket sync -----

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
      console.error(`${logPrefix} Error handling message:`, err);
    }
  }

  async function setupWSConnection(conn: WebSocket, docName: string): Promise<void> {
    const docState = await config.getDoc(docName);
    const { doc } = docState;

    docState.conns.add(conn);
    console.log(`${logPrefix} Client connected to room: ${docName} (${docState.conns.size} clients)`);

    sendSyncStep1(conn, doc);

    conn.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
      let msg: Uint8Array;
      if (data instanceof ArrayBuffer) {
        msg = new Uint8Array(data);
      } else if (Buffer.isBuffer(data)) {
        msg = new Uint8Array(data);
      } else if (Array.isArray(data)) {
        msg = new Uint8Array(Buffer.concat(data));
      } else {
        msg = new Uint8Array(data as Buffer);
      }
      handleMessage(conn, docState, msg);
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
      console.log(`${logPrefix} Client disconnected from room: ${docName} (${docState.conns.size} clients)`);
    });

    conn.on('error', (err) => {
      console.error(`${logPrefix} WebSocket error in room ${docName}:`, err);
    });
  }

  // ----- HTTP request handler -----

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
      // ===== HEALTH =====

      if (path === '/health' && (method === 'GET' || method === 'HEAD')) {
        sendJson(res, 200, {
          status: 'ok',
          ...config.healthMeta,
        });
        return;
      }

      // ===== ROOMS (legacy + API) =====

      if ((path === '/rooms' || path === '/api/rooms') && method === 'GET') {
        if (config.getActiveRooms) {
          sendJson(res, 200, { rooms: config.getActiveRooms() });
        } else {
          const documents = await config.listDocuments();
          sendJson(res, 200, { rooms: documents.map(d => ({ roomId: d.id, clientCount: 0 })) });
        }
        return;
      }

      // ===== DOCUMENTS =====

      if (path === '/api/documents' && method === 'GET') {
        const documents = await config.listDocuments();
        sendJson(res, 200, { documents });
        return;
      }

      if (path === '/api/documents' && method === 'POST') {
        const body = await parseJsonBody<{ title?: string; folder?: string }>(req);
        const title = body.title || 'Untitled Project';
        const folder = body.folder || '/';
        const roomId = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

        const docState = await config.getDoc(roomId);
        docState.doc.transact(() => {
          const ymeta = docState.doc.getMap('meta');
          ymeta.set('title', title);
          ymeta.set('folder', folder);
          ymeta.set('version', 3);

          // Initialize default level if none exists
          const ylevels = docState.doc.getMap<Y.Map<unknown>>('levels');
          if (ylevels.size === 0) {
            const levelId = `level_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const levelData = new Y.Map<unknown>();
            levelData.set('id', levelId);
            levelData.set('name', 'Main');
            levelData.set('order', 0);
            ylevels.set(levelId, levelData);
            ymeta.set('activeLevel', levelId);
            console.log(`${logPrefix} [levels] Created default Main level for new document`, { levelId, roomId });
          }
        }, 'server');

        await config.onDocumentCreated?.(roomId, docState);

        const document = extractDocument(docState.doc, roomId, getActiveLevelId(docState.doc));
        sendJson(res, 201, { document });
        return;
      }

      // GET/DELETE/PATCH /api/documents/:id
      const docMatch = path.match(/^\/api\/documents\/([^/]+)$/);
      if (docMatch) {
        const roomId = docMatch[1]!;

        if (method === 'GET') {
          const docState = await config.getDoc(roomId);
          const document = extractDocument(docState.doc, roomId, getActiveLevelId(docState.doc));
          sendJson(res, 200, { document });
          return;
        }

        if (method === 'DELETE') {
          const deleted = await config.deleteDocument(roomId);
          sendJson(res, 200, { deleted });
          return;
        }

        if (method === 'PATCH') {
          const body = await parseJsonBody<{ title?: string }>(req);
          const docState = await config.getDoc(roomId);
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

      // ===== LEVELS =====

      const levelsMatch = path.match(/^\/api\/documents\/([^/]+)\/levels$/);
      if (levelsMatch) {
        const roomId = levelsMatch[1]!;
        const docState = await config.getDoc(roomId);

        if (method === 'GET') {
          const levels = listLevels(docState.doc);
          const activeLevel = getActiveLevel(docState.doc);
          sendJson(res, 200, { levels, activeLevel });
          return;
        }

        if (method === 'POST') {
          const body = await parseJsonBody<{ name: string; description?: string }>(req);
          if (!body.name) {
            sendError(res, 400, 'name is required', 'MISSING_FIELD');
            return;
          }
          const level = createLevel(docState.doc, body.name, body.description);
          sendJson(res, 201, { level });
          return;
        }
      }

      const levelActiveMatch = path.match(/^\/api\/documents\/([^/]+)\/levels\/active$/);
      if (levelActiveMatch && method === 'POST') {
        const roomId = levelActiveMatch[1]!;
        const docState = await config.getDoc(roomId);
        const body = await parseJsonBody<{ levelId: string }>(req);
        if (!body.levelId) {
          sendError(res, 400, 'levelId is required', 'MISSING_FIELD');
          return;
        }
        try {
          setActiveLevel(docState.doc, body.levelId);
          sendJson(res, 200, { activeLevel: body.levelId });
        } catch (err) {
          sendError(res, 404, String(err), 'NOT_FOUND');
        }
        return;
      }

      const levelMatch = path.match(/^\/api\/documents\/([^/]+)\/levels\/([^/]+)$/);
      if (levelMatch) {
        const roomId = levelMatch[1]!;
        const levelId = decodeURIComponent(levelMatch[2]!);
        const docState = await config.getDoc(roomId);

        if (method === 'PATCH') {
          const body = await parseJsonBody<{ name?: string; description?: string; order?: number }>(req);
          const level = updateLevel(docState.doc, levelId, body);
          if (!level) {
            sendError(res, 404, `Level not found: ${levelId}`, 'NOT_FOUND');
            return;
          }
          sendJson(res, 200, { level });
          return;
        }

        if (method === 'DELETE') {
          const deleted = deleteLevel(docState.doc, levelId);
          if (!deleted) {
            sendError(res, 400, 'Cannot delete level (not found or last level)', 'DELETE_FAILED');
            return;
          }
          sendJson(res, 200, { deleted: true });
          return;
        }
      }

      // ===== CONSTRUCTS =====

      const constructsMatch = path.match(/^\/api\/documents\/([^/]+)\/constructs$/);
      if (constructsMatch) {
        const roomId = constructsMatch[1]!;
        const docState = await config.getDoc(roomId);
        const levelId = getActiveLevelId(docState.doc);

        if (method === 'GET') {
          const typeFilter = url.searchParams.get('type') || undefined;
          const constructs = listConstructs(docState.doc, levelId, { constructType: typeFilter });
          const schemas = listSchemas(docState.doc);
          const schemaMap = new Map(schemas.map(s => [s.type, s]));

          // Compact summary: excludes organizer nodes, returns minimal fields
          const summary = constructs
            .filter(c => c.type !== 'organizer')
            .map(c => {
              const schema = schemaMap.get(c.data.constructType);
              const pillField = schema?.fields.find(f => f.displayTier === 'pill');
              const displayName = pillField ? String(c.data.values?.[pillField.name] || '') : c.data.semanticId;
              return {
                semanticId: c.data.semanticId,
                constructType: c.data.constructType,
                displayName,
                parentId: c.parentId,
              };
            });

          // Also list organizers in a separate field
          const organizers = constructs
            .filter(c => c.type === 'organizer')
            .map(c => ({
              id: c.id,
              name: (c.data as Record<string, unknown>).name as string ?? '',
              color: (c.data as Record<string, unknown>).color as string ?? '',
              memberCount: constructs.filter(n => n.parentId === c.id).length,
            }));

          sendJson(res, 200, { constructs: summary, organizers });
          return;
        }

        if (method === 'POST') {
          const body = await parseJsonBody<{
            constructType: string;
            values?: Record<string, unknown>;
            x?: number;
            y?: number;
            parentId?: string;
          }>(req);

          if (!body.constructType) {
            sendError(res, 400, 'constructType is required', 'MISSING_FIELD');
            return;
          }

          const construct = createConstruct(
            docState.doc,
            levelId,
            body.constructType,
            body.values || {},
            { x: body.x || 100, y: body.y || 100 },
            body.parentId
          );
          sendJson(res, 201, { construct: construct.data });
          return;
        }
      }

      const constructMatch = path.match(/^\/api\/documents\/([^/]+)\/constructs\/([^/]+)$/);
      if (constructMatch) {
        const roomId = constructMatch[1]!;
        const semanticId = decodeURIComponent(constructMatch[2]!);
        const docState = await config.getDoc(roomId);

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

      // ===== ORGANIZERS =====

      const organizersMatch = path.match(/^\/api\/documents\/([^/]+)\/organizers$/);
      if (organizersMatch) {
        const roomId = organizersMatch[1]!;
        const docState = await config.getDoc(roomId);
        const levelId = getActiveLevelId(docState.doc);

        if (method === 'GET') {
          const organizers = listOrganizers(docState.doc, levelId);
          // Enrich with member counts
          const constructs = listConstructs(docState.doc, levelId);
          const enriched = organizers.map(org => ({
            ...org,
            memberCount: constructs.filter(c => c.parentId === org.id).length,
          }));
          sendJson(res, 200, { organizers: enriched });
          return;
        }

        if (method === 'POST') {
          const body = await parseJsonBody<{
            name: string;
            color?: string;
            x?: number;
            y?: number;
            width?: number;
            height?: number;
            layout?: string;
            description?: string;
            attachedToSemanticId?: string;
          }>(req);

          if (!body.name) {
            sendError(res, 400, 'name is required', 'MISSING_FIELD');
            return;
          }

          // If attaching to a construct, look up the construct's node ID for parentId
          let parentId: string | undefined;
          if (body.attachedToSemanticId) {
            const constructs = listConstructs(docState.doc, levelId);
            const ownerNode = constructs.find(c => c.data.semanticId === body.attachedToSemanticId);
            if (ownerNode) {
              parentId = ownerNode.id;
            }
          }

          const organizer = createOrganizer(docState.doc, levelId, {
            name: body.name,
            color: body.color,
            position: (body.x != null || body.y != null) ? { x: body.x || 100, y: body.y || 100 } : body.attachedToSemanticId ? { x: 0, y: 190 } : undefined,
            width: body.width,
            height: body.height,
            layout: body.layout as 'freeform' | 'stack' | 'grid' | undefined,
            description: body.description,
            attachedToSemanticId: body.attachedToSemanticId,
            parentId,
          });
          sendJson(res, 201, { organizer });
          return;
        }
      }

      const organizerMatch = path.match(/^\/api\/documents\/([^/]+)\/organizers\/([^/]+)$/);
      if (organizerMatch) {
        const roomId = organizerMatch[1]!;
        const organizerId = decodeURIComponent(organizerMatch[2]!);
        const docState = await config.getDoc(roomId);
        const levelId = getActiveLevelId(docState.doc);

        if (method === 'PATCH') {
          const body = await parseJsonBody<{
            name?: string;
            color?: string;
            collapsed?: boolean;
            layout?: string;
            description?: string;
            attachedToSemanticId?: string;
          }>(req);
          const organizer = updateOrganizer(docState.doc, levelId, organizerId, {
            name: body.name,
            color: body.color,
            collapsed: body.collapsed,
            layout: body.layout as 'freeform' | 'stack' | 'grid' | undefined,
            description: body.description,
            attachedToSemanticId: body.attachedToSemanticId,
          });
          if (!organizer) {
            sendError(res, 404, `Organizer not found: ${organizerId}`, 'NOT_FOUND');
            return;
          }
          sendJson(res, 200, { organizer });
          return;
        }

        if (method === 'DELETE') {
          const deleteMembers = url.searchParams.get('deleteMembers') === 'true';
          const deleted = deleteOrganizer(docState.doc, levelId, organizerId, deleteMembers);
          if (!deleted) {
            sendError(res, 404, `Organizer not found: ${organizerId}`, 'NOT_FOUND');
            return;
          }
          sendJson(res, 200, { deleted: true });
          return;
        }
      }

      // ===== CONNECTIONS =====

      const connectionsMatch = path.match(/^\/api\/documents\/([^/]+)\/connections$/);
      if (connectionsMatch) {
        const roomId = connectionsMatch[1]!;
        const docState = await config.getDoc(roomId);

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

      const schemasMatch = path.match(/^\/api\/documents\/([^/]+)\/schemas$/);
      if (schemasMatch) {
        const roomId = schemasMatch[1]!;
        const docState = await config.getDoc(roomId);

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
          } as any);

          if (!schema) {
            sendError(res, 400, 'Schema type already exists', 'ALREADY_EXISTS');
            return;
          }
          sendJson(res, 201, { schema });
          return;
        }
      }

      const schemaMatch = path.match(/^\/api\/documents\/([^/]+)\/schemas\/([^/]+)$/);
      if (schemaMatch) {
        const roomId = schemaMatch[1]!;
        const type = decodeURIComponent(schemaMatch[2]!);
        const docState = await config.getDoc(roomId);

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

      // ===== COMPILE =====

      const compileMatch = path.match(/^\/api\/documents\/([^/]+)\/compile$/);
      if (compileMatch && method === 'GET') {
        const roomId = compileMatch[1]!;
        const docState = await config.getDoc(roomId);
        const output = compile(docState.doc, getActiveLevelId(docState.doc));
        sendJson(res, 200, { output });
        return;
      }

      // ===== PORT TYPES =====

      const portTypesMatch = path.match(/^\/api\/documents\/([^/]+)\/port-types$/);
      if (portTypesMatch && method === 'GET') {
        const portTypes = portRegistry.getAll();
        sendJson(res, 200, { portTypes });
        return;
      }

      // ===== NOT FOUND =====
      sendError(res, 404, 'Not found', 'NOT_FOUND');
    } catch (err) {
      console.error(`${logPrefix} HTTP error:`, err);
      sendError(res, 500, String(err), 'INTERNAL_ERROR');
    }
  }

  return { handleHttpRequest, setupWSConnection };
}
