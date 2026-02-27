/**
 * Carta Workspace Server
 *
 * Implements DocumentServerConfig for workspace mode: loading .canvas.json files
 * into Y.Doc rooms, saving changes back with debounce, and managing binary .ystate
 * sidecars for fast reload.
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

const log = createDebug('carta:workspace-server');

// ===== TYPES =====

interface WorkspaceDocState extends DocState {
  /** Relative path from .carta/ dir (e.g., "01-product-vision/domain-sketch") */
  canvasPath: string;
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
}

// ===== CONSTANTS =====

export const SAVE_DEBOUNCE_MS = 2000;
const STATE_DIR = '.state';
const DEFAULT_PORT = 51234;

// ===== MODULE-LEVEL SERVER STATE =====

let activeServer: {
  server: http.Server;
  wss: WebSocketServer;
  docs: Map<string, WorkspaceDocState>;
  cartaDir: string;
} | null = null;

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
    canvasPath,
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
 * Schedule a debounced save for a dirty doc.
 */
export function scheduleSave(cartaDir: string, roomName: string, docState: WorkspaceDocState): void {
  docState.dirty = true;
  if (docState.saveTimer) clearTimeout(docState.saveTimer);
  docState.saveTimer = setTimeout(() => {
    if (docState.dirty) {
      saveCanvasDoc(cartaDir, roomName, docState.doc);
      docState.dirty = false;
    }
    docState.saveTimer = null;
  }, SAVE_DEBOUNCE_MS);
}

// ===== MAIN FUNCTIONS =====

/**
 * Start a workspace server for a .carta/ directory.
 * One Y.Doc room per .canvas.json file. Rooms are loaded on demand.
 */
export async function startWorkspaceServer(options: StartWorkspaceServerOptions): Promise<WorkspaceServerInfo> {
  const { cartaDir, host = '127.0.0.1' } = options;
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

      docState = loadCanvasDoc(cartaDir, roomName);
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
    },
    workspacePath: cartaDir,
  });

  const server = http.createServer((req, res) => {
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

  const actualPort = await new Promise<number>((resolve, reject) => {
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${port} is already in use`));
      } else {
        reject(err);
      }
    });
    server.listen(port, host, () => {
      const addr = server.address() as { port: number };
      log('Workspace server running on %s:%d', host, addr.port);
      resolve(addr.port);
    });
  });

  activeServer = { server, wss, docs, cartaDir };

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

  // Flush all dirty docs before closing
  for (const [roomName, docState] of docs) {
    if (docState.saveTimer) {
      clearTimeout(docState.saveTimer);
      docState.saveTimer = null;
    }
    if (docState.dirty) {
      saveCanvasDoc(cartaDir, roomName, docState.doc);
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
