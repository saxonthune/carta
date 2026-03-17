/**
 * Carta Workspace Server
 *
 * Implements DocumentServerConfig for workspace mode: loading .canvas.json files
 * into Y.Doc rooms, saving changes back with debounce, and managing binary .ystate
 * sidecars for fast reload. Also supports text file rooms (Y.Doc with Y.Text).
 *
 * See ADR 009 (doc02.04.09) for workspace format design.
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as Y from 'yjs';
import { WebSocketServer } from 'ws';
import createDebug from 'debug';
import {
  hydrateYDocFromCanvasFile,
  extractCanvasFileFromYDoc,
  parseCanvasFile,
} from '@carta/document';
import {
  createDocumentServer,
  type DocState,
  type DocumentSummary,
} from './document-server-core.js';
import { scanWorkspace } from './workspace-scanner.js';
import { WorkspaceWatcher } from './workspace-watcher.js';

const log = createDebug('carta:workspace-server');

// ===== TYPES =====

interface WorkspaceDocState extends DocState {
  type: 'canvas' | 'text';
  /** Relative path from .carta/ dir (e.g., "01-vision/sketch.canvas.json" or "01-vision/notes.md") */
  filePath: string;
  /** Whether pending changes need saving */
  dirty: boolean;
  /** Debounce timer for JSON save */
  saveTimer: ReturnType<typeof setTimeout> | null;
}

export interface WorkspaceServerInfo {
  url: string;
  wsUrl: string;
  port: number;
}

export interface StartWorkspaceServerOptions {
  /** Absolute path to .carta/ directory */
  cartaDir: string;
  port?: number;
  host?: string;
  /** Absolute path to built web-client dist/ directory. When set, serves static files. */
  clientDir?: string;
}

// ===== CONSTANTS =====

export const SAVE_DEBOUNCE_MS = 2000;
const STATE_DIR = '.state';
const DEFAULT_PORT = 51234;

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
};

// ===== STATIC FILE SERVING =====

function serveStaticFile(clientDir: string, urlPath: string, res: http.ServerResponse, serverUrl: string): boolean {
  // Normalize path (prevent directory traversal)
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  let filePath = path.join(clientDir, safePath);

  // SPA fallback: if file doesn't exist, serve index.html
  let isIndexFallback = false;
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    filePath = path.join(clientDir, 'index.html');
    isIndexFallback = true;
  }

  if (!fs.existsSync(filePath)) return false;

  // Ensure resolved path is within clientDir (security)
  const resolved = fs.realpathSync(filePath);
  const resolvedClientDir = fs.realpathSync(clientDir);
  if (!resolved.startsWith(resolvedClientDir)) return false;

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  if (ext === '.html' || isIndexFallback) {
    // Inject __CARTA_CONFIG__ into HTML
    let html = fs.readFileSync(filePath, 'utf-8');
    const configScript = `<script>window.__CARTA_CONFIG__=${JSON.stringify({ syncUrl: serverUrl })}</script>`;
    html = html.replace('</head>', `${configScript}\n</head>`);
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': Buffer.byteLength(html) });
    res.end(html);
  } else {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType, 'Content-Length': content.length });
    res.end(content);
  }
  return true;
}

// ===== PORT HELPERS =====

/**
 * Find an available port by probing with temporary net.Server instances.
 * Uses port 0 to let the OS pick when startPort is 0.
 * Returns the chosen port number.
 */
async function findAvailablePort(startPort: number, host: string, maxAttempts = 10): Promise<number> {
  const net = await import('node:net');
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const port = startPort === 0 ? 0 : startPort + attempt;
    const result = await new Promise<number | null>((resolve) => {
      const probe = net.createServer();
      probe.once('error', () => {
        probe.close();
        resolve(null);
      });
      probe.listen(port, host, () => {
        const addr = probe.address() as { port: number };
        probe.close(() => resolve(addr.port));
      });
    });
    if (result !== null) return result;
    // Port 0 always succeeds (OS picks), so this only fires for specific ports
    log('Port %d in use, trying %d', port, port + 1);
    if (startPort === 0) break; // port 0 should never fail
  }
  throw new Error(`No available port found in range ${startPort}-${startPort + maxAttempts - 1}`);
}

// ===== MODULE-LEVEL SERVER STATE =====

let activeServer: {
  server: http.Server;
  wss: WebSocketServer;
  docs: Map<string, WorkspaceDocState>;
  cartaDir: string;
} | null = null;

let watcher: WorkspaceWatcher | null = null;

// ===== CORE FUNCTIONS =====

/**
 * Resolve the absolute path to the .canvas.json file for a room.
 */
export function resolveCanvasPath(cartaDir: string, roomName: string): string {
  return path.join(cartaDir, `${roomName}.canvas.json`);
}

/**
 * Resolve the absolute path to the .ystate sidecar for a room.
 * Flattens path separators: "01-vision/sketch" → "01-vision--sketch.ystate"
 */
export function resolveSidecarPath(cartaDir: string, roomName: string): string {
  const flatName = roomName.replace(/\//g, '--');
  return path.join(cartaDir, STATE_DIR, `${flatName}.ystate`);
}

/**
 * Load a canvas Y.Doc from disk.
 * Prefers .ystate sidecar when it is newer than the .canvas.json file.
 * Throws if the canvas file does not exist.
 */
export function loadCanvasDoc(cartaDir: string, roomName: string): WorkspaceDocState {
  const canvasPath = resolveCanvasPath(cartaDir, roomName);

  if (!fs.existsSync(canvasPath)) {
    throw new Error(`Canvas file not found: ${canvasPath}`);
  }

  const doc = new Y.Doc();
  const sidecarPath = resolveSidecarPath(cartaDir, roomName);

  let usedSidecar = false;
  if (fs.existsSync(sidecarPath)) {
    const canvasStat = fs.statSync(canvasPath);
    const sidecarStat = fs.statSync(sidecarPath);

    if (sidecarStat.mtimeMs > canvasStat.mtimeMs) {
      const sidecarBytes = fs.readFileSync(sidecarPath);
      Y.applyUpdate(doc, sidecarBytes);
      usedSidecar = true;
      log('Loaded room %s from sidecar', roomName);
    }
  }

  if (!usedSidecar) {
    const content = fs.readFileSync(canvasPath, 'utf-8');
    const canvas = parseCanvasFile(content);
    hydrateYDocFromCanvasFile(doc, canvas);
    log('Loaded room %s from JSON', roomName);
  }

  return {
    doc,
    conns: new Set(),
    type: 'canvas',
    filePath: `${roomName}.canvas.json`,
    dirty: false,
    saveTimer: null,
  };
}

/**
 * Save a Y.Doc to both the .canvas.json and .ystate sidecar files.
 */
export function saveCanvasDoc(cartaDir: string, roomName: string, doc: Y.Doc): void {
  const canvasPath = resolveCanvasPath(cartaDir, roomName);
  const sidecarPath = resolveSidecarPath(cartaDir, roomName);

  // Ensure .state/ directory exists
  const stateDir = path.join(cartaDir, STATE_DIR);
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }

  // Save canonical JSON
  const canvasFile = extractCanvasFileFromYDoc(doc);
  fs.writeFileSync(canvasPath, JSON.stringify(canvasFile, null, 2), 'utf-8');

  // Save binary sidecar for fast reload
  const update = Y.encodeStateAsUpdate(doc);
  fs.writeFileSync(sidecarPath, update);

  log('Saved room %s to disk', roomName);
}

/**
 * Load a text file Y.Doc from disk.
 * Creates a Y.Doc with a single Y.Text('content') populated from the file.
 * Throws if the file does not exist.
 */
export function loadTextDoc(cartaDir: string, roomName: string): WorkspaceDocState {
  const filePath = path.join(cartaDir, roomName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Text file not found: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf-8');
  const doc = new Y.Doc();
  doc.getText('content').insert(0, content);
  log('Loaded text room %s from file', roomName);
  return { doc, conns: new Set(), type: 'text', filePath: roomName, dirty: false, saveTimer: null };
}

/**
 * Save a text Y.Doc's Y.Text('content') back to the file on disk.
 */
export function saveTextDoc(cartaDir: string, roomName: string, doc: Y.Doc): void {
  const filePath = path.join(cartaDir, roomName);
  const content = doc.getText('content').toString();
  fs.writeFileSync(filePath, content, 'utf-8');
  log('Saved text file %s to disk', roomName);
}

/**
 * Schedule a debounced save for a dirty doc.
 */
export function scheduleSave(cartaDir: string, roomName: string, docState: WorkspaceDocState): void {
  docState.dirty = true;
  if (docState.saveTimer) clearTimeout(docState.saveTimer);
  docState.saveTimer = setTimeout(() => {
    if (docState.dirty) {
      if (docState.type === 'canvas') {
        saveCanvasDoc(cartaDir, roomName, docState.doc);
      } else {
        saveTextDoc(cartaDir, roomName, docState.doc);
      }
      docState.dirty = false;
    }
    docState.saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

// ===== MAIN FUNCTIONS =====

/**
 * Start a workspace server for a .carta/ directory.
 * Supports canvas rooms (.canvas.json) and text file rooms (any text file).
 * Rooms are loaded on demand.
 */
export async function startWorkspaceServer(options: StartWorkspaceServerOptions): Promise<WorkspaceServerInfo> {
  const { cartaDir, host = '127.0.0.1', clientDir } = options;
  const port = options.port ?? DEFAULT_PORT;

  // Validate workspace
  const manifestPath = path.join(cartaDir, 'workspace.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Not a valid workspace: missing workspace.json in ${cartaDir}`);
  }

  // Ensure .state/ dir exists
  const stateDir = path.join(cartaDir, STATE_DIR);
  if (!fs.existsSync(stateDir)) {
    fs.mkdirSync(stateDir, { recursive: true });
  }

  const docs = new Map<string, WorkspaceDocState>();

  const { handleHttpRequest, setupWSConnection } = createDocumentServer({
    getDoc: async (roomName: string) => {
      let docState = docs.get(roomName);
      if (docState) return docState;

      // Try canvas first (room name without extension → .canvas.json)
      const canvasFilePath = resolveCanvasPath(cartaDir, roomName);
      if (fs.existsSync(canvasFilePath)) {
        docState = loadCanvasDoc(cartaDir, roomName);
      } else {
        // Try as text file (room name IS the relative path including extension)
        const textFilePath = path.join(cartaDir, roomName);
        if (fs.existsSync(textFilePath) && fs.statSync(textFilePath).isFile()) {
          docState = loadTextDoc(cartaDir, roomName);
        } else {
          throw new Error(`No canvas or text file found for room: ${roomName}`);
        }
      }

      docs.set(roomName, docState);

      docState.doc.on('update', () => {
        scheduleSave(cartaDir, roomName, docState!);
      });

      return docState;
    },
    getActiveRooms: () => Array.from(docs.entries()).map(([roomId, ds]) => ({
      roomId,
      clientCount: ds.conns.size,
    })),
    listDocuments: async (): Promise<DocumentSummary[]> => {
      const tree = scanWorkspace(cartaDir);
      const summaries: DocumentSummary[] = [];

      for (const entry of tree.ungroupedFiles) {
        if (entry.type === 'canvas') {
          summaries.push({
            id: entry.path.replace(/\.canvas\.json$/, ''),
            title: entry.name.replace(/\.canvas\.json$/, ''),
            folder: '/',
            updatedAt: new Date().toISOString(),
            nodeCount: 0,
          });
        }
      }

      for (const group of tree.groups) {
        for (const entry of group.files) {
          if (entry.type === 'canvas') {
            summaries.push({
              id: entry.path.replace(/\.canvas\.json$/, ''),
              title: entry.name.replace(/\.canvas\.json$/, ''),
              folder: group.name,
              updatedAt: new Date().toISOString(),
              nodeCount: 0,
            });
          }
        }
      }

      return summaries;
    },
    deleteDocument: async (roomName: string): Promise<boolean> => {
      docs.delete(roomName);
      const canvasPath = resolveCanvasPath(cartaDir, roomName);
      const sidecarPath = resolveSidecarPath(cartaDir, roomName);
      if (fs.existsSync(canvasPath)) fs.unlinkSync(canvasPath);
      if (fs.existsSync(sidecarPath)) fs.unlinkSync(sidecarPath);
      return true;
    },
    healthMeta: {
      get rooms() { return docs.size; },
      persistence: 'workspace',
      workspace: true,
    },
    workspacePath: cartaDir,
  });

  let serverUrl = '';

  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);
    const urlPath = url.pathname;

    // Serve static files for non-API paths when clientDir is configured
    if (clientDir && req.method === 'GET') {
      const isApiPath = urlPath.startsWith('/api/') || urlPath === '/health' || urlPath === '/rooms';
      if (!isApiPath) {
        if (serveStaticFile(clientDir, urlPath, res, serverUrl)) return;
      }
    }

    handleHttpRequest(req, res).catch((err) => {
      log('Unhandled HTTP error: %O', err);
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

  const chosenPort = await findAvailablePort(port, host);
  const actualPort = await new Promise<number>((resolve, reject) => {
    server.once('error', reject);
    server.listen(chosenPort, host, () => {
      const addr = server.address() as { port: number };
      resolve(addr.port);
    });
  });
  serverUrl = `http://${host}:${actualPort}`;
  log('Workspace server running on %s:%d', host, actualPort);

  activeServer = { server, wss, docs, cartaDir };

  // Start directory watcher (async alongside server — does not block startup)
  watcher = new WorkspaceWatcher(cartaDir);

  watcher.on('canvas-changed', (canvasPath: string) => {
    const docState = docs.get(canvasPath);
    if (!docState) return; // Room not loaded — no action needed

    if (docState.dirty) {
      log('canvas %s changed externally but room is dirty — ignoring (user edits win)', canvasPath);
      return;
    }

    // Room is clean (not dirty) — safe to re-hydrate from disk
    log('canvas %s changed externally, re-hydrating from disk', canvasPath);
    try {
      const canvasFilePath = resolveCanvasPath(cartaDir, canvasPath);
      const content = fs.readFileSync(canvasFilePath, 'utf-8');
      const canvas = parseCanvasFile(content);
      hydrateYDocFromCanvasFile(docState.doc, canvas);
      // hydrateYDocFromCanvasFile clears and repopulates inside a transaction,
      // which triggers Y.Doc update observers, which broadcast to connected clients
    } catch (err) {
      log('failed to re-hydrate canvas %s: %O', canvasPath, err);
    }
  });

  watcher.on('canvas-deleted', (canvasPath: string) => {
    // Evict room if loaded
    const docState = docs.get(canvasPath);
    if (docState) {
      // Clear any pending save timer
      if (docState.saveTimer) clearTimeout(docState.saveTimer);
      // Close all WebSocket connections to this room
      for (const conn of docState.conns) {
        conn.close();
      }
      docs.delete(canvasPath);
      log('evicted room for deleted canvas: %s', canvasPath);
    }
  });

  watcher.on('schemas-changed', () => {
    log('schemas.json changed externally');
    // Future: broadcast schema update to all connected clients
    // For now, clients will get fresh schemas on next REST fetch
  });

  watcher.on('text-file-changed', (filePath: string) => {
    const docState = docs.get(filePath);
    if (!docState || docState.type !== 'text') return;
    if (docState.dirty) {
      log('text file %s changed externally but room is dirty — ignoring', filePath);
      return;
    }
    log('text file %s changed externally, re-hydrating', filePath);
    try {
      const absPath = path.join(cartaDir, filePath);
      const content = fs.readFileSync(absPath, 'utf-8');
      docState.doc.transact(() => {
        const ytext = docState.doc.getText('content');
        ytext.delete(0, ytext.length);
        ytext.insert(0, content);
      });
    } catch (err) {
      log('failed to re-hydrate text file %s: %O', filePath, err);
    }
  });

  watcher.on('text-file-deleted', (filePath: string) => {
    const docState = docs.get(filePath);
    if (docState) {
      if (docState.saveTimer) clearTimeout(docState.saveTimer);
      for (const conn of docState.conns) conn.close();
      docs.delete(filePath);
      log('evicted room for deleted text file: %s', filePath);
    }
  });

  watcher.start();

  const url = `http://${host}:${actualPort}`;
  const wsUrl = `ws://${host}:${actualPort}`;

  return { url, wsUrl, port: actualPort };
}

/**
 * Stop the workspace server, flushing all dirty docs to disk first.
 */
export async function stopWorkspaceServer(): Promise<void> {
  if (!activeServer) return;

  const { server, wss, docs, cartaDir } = activeServer;

  // Stop directory watcher before flushing docs
  if (watcher) {
    watcher.stop();
    watcher = null;
  }

  // Flush all dirty docs before closing
  for (const [roomName, docState] of docs) {
    if (docState.saveTimer) {
      clearTimeout(docState.saveTimer);
      docState.saveTimer = null;
    }
    if (docState.dirty) {
      if (docState.type === 'canvas') {
        saveCanvasDoc(cartaDir, roomName, docState.doc);
      } else {
        saveTextDoc(cartaDir, roomName, docState.doc);
      }
      docState.dirty = false;
    }
  }

  wss.close();

  await new Promise<void>((resolve) => {
    server.close(() => {
      log('Workspace server closed');
      resolve();
    });
  });

  activeServer = null;
}
