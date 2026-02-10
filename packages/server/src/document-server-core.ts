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
import createDebug from 'debug';
import { portRegistry, type DocumentSummary } from '@carta/domain';
export type { DocumentSummary };

const log = createDebug('carta:server');
const logWs = createDebug('carta:server:ws');
const logPages = createDebug('carta:server:pages');
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
  updateSchema,
  removeSchema,
  compile,
  extractDocument,
  listPages,
  getActivePage,
  setActivePage,
  createPage,
  updatePage,
  deletePage,
  listOrganizers,
  createOrganizer,
  updateOrganizer,
  deleteOrganizer,
  createConstructsBulk,
  connectBulk,
  computeAutoPosition,
  moveConstruct,
  deleteConstructsBulk,
  batchMutate,
  flowLayout,
  arrangeLayout,
  renameField,
  removeField,
  addField,
  renamePort,
  removePort,
} from '@carta/document';
import type { BatchOperation, BatchResult, MigrationResult } from '@carta/document';
import type { FlowDirection, ArrangeStrategy, ArrangeConstraint } from '@carta/domain';

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

// ===== HELPERS =====

/**
 * Resolve a page by ID or name (case-insensitive). Returns undefined if neither matches.
 */
function resolvePageId(ydoc: Y.Doc, pageId?: string, pageName?: string): string | undefined {
  if (pageId) return pageId;
  if (!pageName) return undefined;
  const pages = listPages(ydoc);
  return pages.find(l => l.name.toLowerCase() === pageName.toLowerCase())?.id;
}

/**
 * Build compact construct + organizer summaries for a page (shared by multiple endpoints).
 */
function compactPageContents(ydoc: Y.Doc, pageId: string) {
  const allNodes = listConstructs(ydoc, pageId);
  const schemas = listSchemas(ydoc);
  const schemaMap = new Map(schemas.map(s => [s.type, s]));

  const constructs = allNodes
    .filter(c => c.type !== 'organizer')
    .map(c => {
      const schema = schemaMap.get(c.data.constructType);
      const pillField = schema?.fields.find(f => f.displayTier === 'pill');
      const displayName = pillField ? String(c.data.values?.[pillField.name] || '') : c.data.semanticId;
      return {
        semanticId: c.data.semanticId,
        constructType: c.data.constructType,
        displayName,
        pageId,
        parentId: c.parentId,
      };
    });

  const organizers = allNodes
    .filter(c => c.type === 'organizer')
    .map(c => ({
      id: c.id,
      name: (c.data as Record<string, unknown>).name as string ?? '',
      color: (c.data as Record<string, unknown>).color as string ?? '',
      memberCount: allNodes.filter(n => n.parentId === c.id).length,
    }));

  const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
  const pageEdgeMap = yedges.get(pageId) as Y.Map<unknown> | undefined;
  const edgeCount = pageEdgeMap ? pageEdgeMap.size : 0;

  return { constructs, organizers, edgeCount };
}

// ===== CONSTANTS =====

const MESSAGE_SYNC = 0;
const MESSAGE_AWARENESS = 1;

// ===== UTILITIES =====

/**
 * Get the active page ID for a Y.Doc, falling back to first page by order.
 */
export function getActivePageId(ydoc: Y.Doc): string {
  const ymeta = ydoc.getMap('meta');
  const active = ymeta.get('activePage') as string | undefined;
  if (active) return active;
  // Fallback: first page by order
  const ypages = ydoc.getMap<Y.Map<unknown>>('pages');
  let firstId: string | undefined;
  let firstOrder = Infinity;
  ypages.forEach((ypage, id) => {
    const order = (ypage as Y.Map<unknown>).get('order') as number ?? 0;
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
      logWs('Error handling message: %O', err);
    }
  }

  async function setupWSConnection(conn: WebSocket, docName: string): Promise<void> {
    const docState = await config.getDoc(docName);
    const { doc } = docState;

    docState.conns.add(conn);
    logWs('Client connected to room: %s (%d clients)', docName, docState.conns.size);

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
      logWs('Client disconnected from room: %s (%d clients)', docName, docState.conns.size);
    });

    conn.on('error', (err) => {
      logWs('WebSocket error in room %s: %O', docName, err);
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

          // Initialize default page if none exists
          const ypages = docState.doc.getMap<Y.Map<unknown>>('pages');
          if (ypages.size === 0) {
            const pageId = `page_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
            const pageData = new Y.Map<unknown>();
            pageData.set('id', pageId);
            pageData.set('name', 'Main');
            pageData.set('order', 0);
            ypages.set(pageId, pageData);
            ymeta.set('activePage', pageId);
            logPages('Created default Main page for new document pageId=%s roomId=%s', pageId, roomId);
          }
        }, 'server');

        await config.onDocumentCreated?.(roomId, docState);

        const document = extractDocument(docState.doc, roomId, getActivePageId(docState.doc));
        sendJson(res, 201, { document });
        return;
      }

      // GET/DELETE/PATCH /api/documents/:id
      const docMatch = path.match(/^\/api\/documents\/([^/]+)$/);
      if (docMatch) {
        const roomId = docMatch[1]!;

        if (method === 'GET') {
          const docState = await config.getDoc(roomId);
          const document = extractDocument(docState.doc, roomId, getActivePageId(docState.doc));
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
          const document = extractDocument(docState.doc, roomId, getActivePageId(docState.doc));
          sendJson(res, 200, { document });
          return;
        }
      }

      // ===== PAGES =====

      const pagesMatch = path.match(/^\/api\/documents\/([^/]+)\/pages$/);
      if (pagesMatch) {
        const roomId = pagesMatch[1]!;
        const docState = await config.getDoc(roomId);

        if (method === 'GET') {
          const pages = listPages(docState.doc);
          const activePage = getActivePage(docState.doc);
          sendJson(res, 200, { pages, activePage });
          return;
        }

        if (method === 'POST') {
          const body = await parseJsonBody<{ name: string; description?: string }>(req);
          if (!body.name) {
            sendError(res, 400, 'name is required', 'MISSING_FIELD');
            return;
          }
          const page = createPage(docState.doc, body.name, body.description);
          sendJson(res, 201, { page });
          return;
        }
      }

      const pageActiveMatch = path.match(/^\/api\/documents\/([^/]+)\/pages\/active$/);
      if (pageActiveMatch && method === 'POST') {
        const roomId = pageActiveMatch[1]!;
        const docState = await config.getDoc(roomId);
        const body = await parseJsonBody<{ pageId?: string; pageName?: string }>(req);

        const pageId = resolvePageId(docState.doc, body.pageId, body.pageName);
        if (!pageId) {
          sendError(res, 400, body.pageName
            ? `Page not found by name: ${body.pageName}`
            : 'pageId or pageName is required', body.pageName ? 'NOT_FOUND' : 'MISSING_FIELD');
          return;
        }

        try {
          setActivePage(docState.doc, pageId);

          // Enriched response: page info + constructs + organizers + edges + custom schemas
          const pages = listPages(docState.doc);
          const page = pages.find(l => l.id === pageId);
          const { constructs, organizers, edgeCount } = compactPageContents(docState.doc, pageId);

          const schemas = listSchemas(docState.doc);
          const customSchemas = schemas
            .filter(s => docState.doc.getMap('schemas').has(s.type))
            .map(s => ({ type: s.type, displayName: s.displayName, groupId: s.groupId }));

          sendJson(res, 200, {
            activePage: pageId,
            page,
            constructs,
            organizers,
            edgeCount,
            customSchemas,
          });
        } catch (err) {
          sendError(res, 404, String(err), 'NOT_FOUND');
        }
        return;
      }

      const pageMatch = path.match(/^\/api\/documents\/([^/]+)\/pages\/([^/]+)$/);
      if (pageMatch) {
        const roomId = pageMatch[1]!;
        const pageId = decodeURIComponent(pageMatch[2]!);
        const docState = await config.getDoc(roomId);

        if (method === 'PATCH') {
          const body = await parseJsonBody<{ name?: string; description?: string; order?: number }>(req);
          const page = updatePage(docState.doc, pageId, body);
          if (!page) {
            sendError(res, 404, `Page not found: ${pageId}`, 'NOT_FOUND');
            return;
          }
          sendJson(res, 200, { page });
          return;
        }

        if (method === 'DELETE') {
          const deleted = deletePage(docState.doc, pageId);
          if (!deleted) {
            sendError(res, 400, 'Cannot delete page (not found or last page)', 'DELETE_FAILED');
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
        const pageId = url.searchParams.get('pageId') || getActivePageId(docState.doc);

        if (method === 'GET') {
          const typeFilter = url.searchParams.get('type') || undefined;
          if (typeFilter) {
            // Filtered query — can't use the shared helper
            const constructs = listConstructs(docState.doc, pageId, { constructType: typeFilter });
            const schemas = listSchemas(docState.doc);
            const schemaMap = new Map(schemas.map(s => [s.type, s]));
            const summary = constructs
              .filter(c => c.type !== 'organizer')
              .map(c => {
                const schema = schemaMap.get(c.data.constructType);
                const pillField = schema?.fields.find(f => f.displayTier === 'pill');
                const displayName = pillField ? String(c.data.values?.[pillField.name] || '') : c.data.semanticId;
                return { semanticId: c.data.semanticId, constructType: c.data.constructType, displayName, pageId, parentId: c.parentId };
              });
            const organizers = constructs
              .filter(c => c.type === 'organizer')
              .map(c => ({
                id: c.id,
                name: (c.data as Record<string, unknown>).name as string ?? '',
                color: (c.data as Record<string, unknown>).color as string ?? '',
                memberCount: constructs.filter(n => n.parentId === c.id).length,
              }));
            sendJson(res, 200, { constructs: summary, organizers });
          } else {
            const { constructs, organizers } = compactPageContents(docState.doc, pageId);
            sendJson(res, 200, { constructs, organizers });
          }
          return;
        }

        if (method === 'POST') {
          const body = await parseJsonBody<{
            constructType: string;
            values?: Record<string, unknown>;
            x?: number;
            y?: number;
            parentId?: string;
            pageId?: string;
          }>(req);

          if (!body.constructType) {
            sendError(res, 400, 'constructType is required', 'MISSING_FIELD');
            return;
          }

          const targetPageId = body.pageId || url.searchParams.get('pageId') || getActivePageId(docState.doc);

          // Auto-layout: compute position when x/y omitted
          let position: { x: number; y: number };
          if (body.x != null && body.y != null) {
            position = { x: body.x, y: body.y };
          } else {
            const existing = listConstructs(docState.doc, targetPageId);
            position = computeAutoPosition(existing, 0);
          }

          const construct = createConstruct(
            docState.doc,
            targetPageId,
            body.constructType,
            body.values || {},
            position,
            body.parentId
          );
          sendJson(res, 201, { construct: construct.data });
          return;
        }
      }

      // Bulk construct operations
      const bulkConstructsMatch = path.match(/^\/api\/documents\/([^/]+)\/constructs\/bulk$/);
      if (bulkConstructsMatch && method === 'DELETE') {
        const roomId = bulkConstructsMatch[1]!;
        const docState = await config.getDoc(roomId);

        const body = await parseJsonBody<{ semanticIds: string[]; pageId?: string }>(req);
        if (!body.semanticIds || !Array.isArray(body.semanticIds) || body.semanticIds.length === 0) {
          sendError(res, 400, 'semanticIds array is required and must not be empty', 'MISSING_FIELD');
          return;
        }

        const pageId = body.pageId || getActivePageId(docState.doc);
        const results = deleteConstructsBulk(docState.doc, pageId, body.semanticIds);
        sendJson(res, 200, { results });
        return;
      }

      if (bulkConstructsMatch && method === 'POST') {
        const roomId = bulkConstructsMatch[1]!;
        const docState = await config.getDoc(roomId);

        const body = await parseJsonBody<{
          constructs: Array<{
            constructType: string;
            values?: Record<string, unknown>;
            x?: number;
            y?: number;
            parentId?: string;
          }>;
          pageId?: string;
        }>(req);

        if (!body.constructs || !Array.isArray(body.constructs) || body.constructs.length === 0) {
          sendError(res, 400, 'constructs array is required and must not be empty', 'MISSING_FIELD');
          return;
        }

        const pageId = body.pageId || getActivePageId(docState.doc);
        const schemas = listSchemas(docState.doc);
        const schemaMap = new Map(schemas.map(s => [s.type, s]));

        const nodes = createConstructsBulk(docState.doc, pageId, body.constructs);
        const results = nodes.map(n => {
          const schema = schemaMap.get(n.data.constructType);
          const pillField = schema?.fields.find(f => f.displayTier === 'pill');
          const displayName = pillField ? String(n.data.values?.[pillField.name] || '') : n.data.semanticId;
          return {
            semanticId: n.data.semanticId,
            constructType: n.data.constructType,
            displayName,
          };
        });

        sendJson(res, 201, { constructs: results });
        return;
      }

      // Move construct into/out of organizer
      const moveMatch = path.match(/^\/api\/documents\/([^/]+)\/constructs\/([^/]+)\/move$/);
      if (moveMatch && method === 'POST') {
        const roomId = moveMatch[1]!;
        const semanticId = decodeURIComponent(moveMatch[2]!);
        const docState = await config.getDoc(roomId);

        const body = await parseJsonBody<{
          parentId: string | null;
          x?: number;
          y?: number;
          pageId?: string;
        }>(req);

        if (body.parentId === undefined) {
          sendError(res, 400, 'parentId is required (string or null)', 'MISSING_FIELD');
          return;
        }

        const pageId = body.pageId || getActivePageId(docState.doc);
        const construct = moveConstruct(
          docState.doc,
          pageId,
          semanticId,
          body.parentId,
          (body.x != null && body.y != null) ? { x: body.x, y: body.y } : undefined
        );
        if (!construct) {
          sendError(res, 404, `Construct or organizer not found`, 'NOT_FOUND');
          return;
        }
        sendJson(res, 200, { construct: construct.data, parentId: construct.parentId ?? null });
        return;
      }

      const constructMatch = path.match(/^\/api\/documents\/([^/]+)\/constructs\/([^/]+)$/);
      if (constructMatch) {
        const roomId = constructMatch[1]!;
        const semanticId = decodeURIComponent(constructMatch[2]!);
        const docState = await config.getDoc(roomId);

        if (method === 'GET') {
          const construct = getConstruct(docState.doc, getActivePageId(docState.doc), semanticId);
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
          const construct = updateConstruct(docState.doc, getActivePageId(docState.doc), semanticId, body);
          if (!construct) {
            sendError(res, 404, `Construct not found: ${semanticId}`, 'NOT_FOUND');
            return;
          }
          sendJson(res, 200, { construct: construct.data });
          return;
        }

        if (method === 'DELETE') {
          const deleted = deleteConstruct(docState.doc, getActivePageId(docState.doc), semanticId);
          sendJson(res, 200, { deleted });
          return;
        }
      }

      // ===== ORGANIZERS =====

      const organizersMatch = path.match(/^\/api\/documents\/([^/]+)\/organizers$/);
      if (organizersMatch) {
        const roomId = organizersMatch[1]!;
        const docState = await config.getDoc(roomId);

        if (method === 'GET') {
          const pageId = url.searchParams.get('pageId') || getActivePageId(docState.doc);
          const organizers = listOrganizers(docState.doc, pageId);
          // Enrich with member counts
          const constructs = listConstructs(docState.doc, pageId);
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
            pageId?: string;
          }>(req);

          if (!body.name) {
            sendError(res, 400, 'name is required', 'MISSING_FIELD');
            return;
          }

          const pageId = body.pageId || getActivePageId(docState.doc);

          // If attaching to a construct, look up the construct's node ID for parentId
          let parentId: string | undefined;
          if (body.attachedToSemanticId) {
            const constructs = listConstructs(docState.doc, pageId);
            const ownerNode = constructs.find(c => c.data.semanticId === body.attachedToSemanticId);
            if (ownerNode) {
              parentId = ownerNode.id;
            }
          }

          const organizer = createOrganizer(docState.doc, pageId, {
            name: body.name,
            color: body.color,
            position: (body.x != null || body.y != null) ? { x: body.x || 100, y: body.y || 100 } : body.attachedToSemanticId ? { x: 0, y: 190 } : undefined,
            width: body.width,
            height: body.height,
            layout: body.layout === 'freeform' ? 'freeform' : undefined,
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

        if (method === 'PATCH') {
          const body = await parseJsonBody<{
            name?: string;
            color?: string;
            collapsed?: boolean;
            layout?: string;
            description?: string;
            attachedToSemanticId?: string;
            pageId?: string;
          }>(req);
          const pageId = body.pageId || getActivePageId(docState.doc);
          const organizer = updateOrganizer(docState.doc, pageId, organizerId, {
            name: body.name,
            color: body.color,
            collapsed: body.collapsed,
            layout: body.layout === 'freeform' ? 'freeform' : undefined,
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
          const body = await parseJsonBody<{ pageId?: string }>(req);
          const pageId = body.pageId || getActivePageId(docState.doc);
          const deleteMembers = url.searchParams.get('deleteMembers') === 'true';
          const deleted = deleteOrganizer(docState.doc, pageId, organizerId, deleteMembers);
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
            pageId?: string;
          }>(req);

          if (!body.sourceSemanticId || !body.sourcePortId || !body.targetSemanticId || !body.targetPortId) {
            sendError(res, 400, 'Missing required fields', 'MISSING_FIELD');
            return;
          }

          const pageId = body.pageId || getActivePageId(docState.doc);
          const edge = connect(
            docState.doc,
            pageId,
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
            pageId?: string;
          }>(req);

          if (!body.sourceSemanticId || !body.sourcePortId || !body.targetSemanticId) {
            sendError(res, 400, 'Missing required fields', 'MISSING_FIELD');
            return;
          }

          const pageId = body.pageId || getActivePageId(docState.doc);
          const disconnected = disconnect(
            docState.doc,
            pageId,
            body.sourceSemanticId,
            body.sourcePortId,
            body.targetSemanticId
          );
          sendJson(res, 200, { disconnected });
          return;
        }
      }

      // Bulk connect constructs
      const bulkConnectionsMatch = path.match(/^\/api\/documents\/([^/]+)\/connections\/bulk$/);
      if (bulkConnectionsMatch && method === 'POST') {
        const roomId = bulkConnectionsMatch[1]!;
        const docState = await config.getDoc(roomId);

        const body = await parseJsonBody<{
          connections: Array<{
            sourceSemanticId: string;
            sourcePortId: string;
            targetSemanticId: string;
            targetPortId: string;
          }>;
          pageId?: string;
        }>(req);

        if (!body.connections || !Array.isArray(body.connections) || body.connections.length === 0) {
          sendError(res, 400, 'connections array is required and must not be empty', 'MISSING_FIELD');
          return;
        }

        const pageId = body.pageId || getActivePageId(docState.doc);
        const results = connectBulk(docState.doc, pageId, body.connections);
        sendJson(res, 201, { results });
        return;
      }

      // ===== SCHEMAS =====

      const schemasMatch = path.match(/^\/api\/documents\/([^/]+)\/schemas$/);
      if (schemasMatch) {
        const roomId = schemasMatch[1]!;
        const docState = await config.getDoc(roomId);

        if (method === 'GET') {
          let schemas = listSchemas(docState.doc);

          // Filter by groupId if requested
          const groupIdFilter = url.searchParams.get('groupId');
          if (groupIdFilter) {
            schemas = schemas.filter(s => s.groupId === groupIdFilter);
          }

          // Compact output mode
          const outputMode = url.searchParams.get('output');
          if (outputMode === 'compact') {
            const compact = schemas.map(s => ({
              type: s.type,
              displayName: s.displayName,
              groupId: s.groupId,
            }));
            sendJson(res, 200, { schemas: compact });
          } else {
            sendJson(res, 200, { schemas });
          }
          return;
        }

        if (method === 'POST') {
          const body = await parseJsonBody<{
            type: string;
            displayName: string;
            color: string;
            semanticDescription?: string;
            groupId?: string;
            enumIconField?: string;
            enumIconMap?: Record<string, string>;
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
            enumIconField: body.enumIconField,
            enumIconMap: body.enumIconMap,
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

      // Schema migration operations: POST /api/documents/:docId/schemas/:type/migrate
      const schemaMigrateMatch = path.match(/^\/api\/documents\/([^/]+)\/schemas\/([^/]+)\/migrate$/);
      if (schemaMigrateMatch) {
        const roomId = schemaMigrateMatch[1]!;
        const type = decodeURIComponent(schemaMigrateMatch[2]!);
        const docState = await config.getDoc(roomId);

        if (method !== 'POST') {
          sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED');
          return;
        }

        const body = await parseJsonBody<{ operation: string; [key: string]: unknown }>(req);
        if (!body?.operation) {
          sendError(res, 400, 'Missing "operation" field', 'MISSING_FIELD');
          return;
        }

        try {
          let result: MigrationResult;
          switch (body.operation) {
            case 'renameField':
              result = renameField(docState.doc, type, body.oldName as string, body.newName as string);
              break;
            case 'removeField':
              result = removeField(docState.doc, type, body.fieldName as string);
              break;
            case 'addField':
              result = addField(docState.doc, type, body.field as Record<string, unknown>, body.defaultValue);
              break;
            case 'renamePort':
              result = renamePort(docState.doc, type, body.oldPortId as string, body.newPortId as string);
              break;
            case 'removePort':
              result = removePort(docState.doc, type, body.portId as string);
              break;
            default:
              sendError(res, 400, `Unknown migration operation: ${body.operation}`, 'VALIDATION_ERROR');
              return;
          }
          sendJson(res, 200, result);
        } catch (err: unknown) {
          const message = err instanceof Error ? err.message : 'Migration failed';
          sendError(res, 400, message, 'VALIDATION_ERROR');
        }
        return;
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

        if (method === 'PATCH') {
          const body = await parseJsonBody<Record<string, unknown>>(req);
          if (!body || Object.keys(body).length === 0) {
            sendError(res, 400, 'Request body required', 'MISSING_FIELD');
            return;
          }
          try {
            const schema = updateSchema(docState.doc, type, body);
            if (!schema) {
              sendError(res, 404, `Schema not found: ${type}`, 'NOT_FOUND');
              return;
            }
            sendJson(res, 200, { schema });
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Update failed';
            sendError(res, 400, message, 'VALIDATION_ERROR');
          }
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
        const output = compile(docState.doc, getActivePageId(docState.doc));
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

      // ===== DOCUMENT SUMMARY =====

      const summaryMatch = path.match(/^\/api\/documents\/([^/]+)\/summary$/);
      if (summaryMatch && method === 'GET') {
        const roomId = summaryMatch[1]!;
        const docState = await config.getDoc(roomId);
        const ydoc = docState.doc;

        const ymeta = ydoc.getMap('meta');
        const title = (ymeta.get('title') as string) || 'Untitled Project';
        const pages = listPages(ydoc);
        const activePage = getActivePage(ydoc);
        const schemas = listSchemas(ydoc);
        const builtInCount = schemas.filter(s => !ydoc.getMap('schemas').has(s.type)).length;
        const customSchemaCount = schemas.length - builtInCount;

        let totalConstructs = 0;
        let totalOrganizers = 0;
        let totalEdges = 0;

        const pageSummaries = pages.map(page => {
          const constructs = listConstructs(ydoc, page.id);
          const constructCount = constructs.filter(c => c.type !== 'organizer').length;
          const organizerCount = constructs.filter(c => c.type === 'organizer').length;

          const yedges = ydoc.getMap<Y.Map<unknown>>('edges');
          const pageEdgeMap = yedges.get(page.id) as Y.Map<unknown> | undefined;
          const edgeCount = pageEdgeMap ? pageEdgeMap.size : 0;

          totalConstructs += constructCount;
          totalOrganizers += organizerCount;
          totalEdges += edgeCount;

          return {
            id: page.id,
            name: page.name,
            constructCount,
            organizerCount,
            edgeCount,
          };
        });

        const response: Record<string, unknown> = {
          title,
          activePage,
          pages: pageSummaries,
          customSchemaCount,
          totalConstructs,
          totalOrganizers,
          totalEdges,
        };

        // Optional: embed detailed data for a specific page
        const includeParam = url.searchParams.get('include');
        const includes = includeParam ? includeParam.split(',').map(s => s.trim()) : [];

        if (includes.length > 0) {
          const targetLevelId = resolvePageId(
            ydoc,
            url.searchParams.get('pageId') ?? undefined,
            url.searchParams.get('pageName') ?? undefined,
          ) ?? getActivePageId(ydoc);

          if (includes.includes('constructs')) {
            const { constructs, organizers } = compactPageContents(ydoc, targetLevelId);
            response.constructs = constructs;
            response.organizers = organizers;
          }
          if (includes.includes('schemas')) {
            response.customSchemas = schemas
              .filter(s => ydoc.getMap('schemas').has(s.type))
              .map(s => ({ type: s.type, displayName: s.displayName, groupId: s.groupId }));
          }
        }

        sendJson(res, 200, response);
        return;
      }

      // ===== BATCH MUTATE =====

      const batchMatch = path.match(/^\/api\/documents\/([^/]+)\/batch$/);
      if (batchMatch && method === 'POST') {
        const roomId = batchMatch[1]!;
        const docState = await config.getDoc(roomId);

        const body = await parseJsonBody<{ operations: BatchOperation[]; pageId?: string }>(req);
        if (!body.operations || !Array.isArray(body.operations) || body.operations.length === 0) {
          sendError(res, 400, 'operations array is required and must not be empty', 'MISSING_FIELD');
          return;
        }

        const pageId = body.pageId || getActivePageId(docState.doc);
        const results = batchMutate(docState.doc, pageId, body.operations);
        sendJson(res, 200, { results });
        return;
      }

      const flowLayoutMatch = path.match(/^\/api\/documents\/([^/]+)\/layout\/flow$/);
      if (flowLayoutMatch && method === 'POST') {
        const roomId = flowLayoutMatch[1]!;
        const docState = await config.getDoc(roomId);
        if (!docState) {
          sendError(res, 404, 'Document not found', 'NOT_FOUND');
          return;
        }

        const body = await parseJsonBody<{
          direction: string;
          sourcePort?: string;
          sinkPort?: string;
          layerGap?: number;
          nodeGap?: number;
          scope?: 'all' | string[];
          pageId?: string;
        }>(req);

        if (!body.direction || !['TB', 'BT', 'LR', 'RL'].includes(body.direction)) {
          sendError(res, 400, 'direction must be TB, BT, LR, or RL', 'INVALID_DIRECTION');
          return;
        }

        const pageId = body.pageId || getActivePageId(docState.doc);
        const result = flowLayout(docState.doc, pageId, {
          direction: body.direction as FlowDirection,
          sourcePort: body.sourcePort,
          sinkPort: body.sinkPort,
          layerGap: body.layerGap,
          nodeGap: body.nodeGap,
          scope: body.scope,
        });

        sendJson(res, 200, result);
        return;
      }

      const arrangeMatch = path.match(/^\/api\/documents\/([^/]+)\/layout\/arrange$/);
      if (arrangeMatch && method === 'POST') {
        const roomId = arrangeMatch[1]!;
        const docState = await config.getDoc(roomId);
        if (!docState) {
          sendError(res, 404, 'Document not found', 'NOT_FOUND');
          return;
        }

        const body = await parseJsonBody<{
          strategy?: string;
          constraints?: unknown[];
          scope?: string | string[];
          nodeGap?: number;
          forceIterations?: number;
          pageId?: string;
        }>(req);

        if (!body.constraints || !Array.isArray(body.constraints)) {
          sendError(res, 400, 'constraints array is required', 'MISSING_CONSTRAINTS');
          return;
        }

        const pageId = body.pageId || getActivePageId(docState.doc);
        const result = arrangeLayout(docState.doc, pageId, {
          strategy: (body.strategy as ArrangeStrategy) ?? 'preserve',
          constraints: body.constraints as ArrangeConstraint[],
          scope: body.scope as 'all' | string[] | undefined,
          nodeGap: body.nodeGap,
          forceIterations: body.forceIterations,
        });

        sendJson(res, 200, result);
        return;
      }

      // ===== NOT FOUND =====
      sendError(res, 404, 'Not found', 'NOT_FOUND');
    } catch (err) {
      log('HTTP error: %O', err);
      sendError(res, 500, String(err), 'INTERNAL_ERROR');
    }
  }

  return { handleHttpRequest, setupWSConnection };
}
