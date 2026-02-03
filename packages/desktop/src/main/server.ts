/**
 * Embedded Document Server for Carta Desktop
 *
 * Lightweight HTTP + WebSocket server running in the Electron main process.
 * Uses the shared document-server-core from @carta/server, with filesystem
 * persistence instead of MongoDB.
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
import { WebSocketServer } from 'ws';
import {
  migrateToLevels,
} from '@carta/document';
import {
  createDocumentServer,
  getActiveLevelId,
  type DocState,
  type DocumentSummary,
} from '@carta/server/document-server-core';

// ===== TYPES =====

interface DesktopDocState extends DocState {
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

const DEFAULT_PORT = 51234;
const SAVE_DEBOUNCE_MS = 2000;

// ===== STATE =====

let documentsDir: string;
let serverInfoPath: string;
const docs = new Map<string, DesktopDocState>();
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

function scheduleSave(docId: string, docState: DesktopDocState): void {
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

function getOrCreateDoc(docId: string): DesktopDocState {
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

// ===== SERVER SETUP =====

const { handleHttpRequest, setupWSConnection } = createDocumentServer({
  getDoc: async (docId: string) => getOrCreateDoc(docId),
  listDocuments: async (): Promise<DocumentSummary[]> => {
    return readRegistry().map((entry) => ({
      id: entry.id,
      title: entry.title,
      updatedAt: entry.updatedAt,
      nodeCount: entry.nodeCount,
    }));
  },
  onDocumentCreated: async (docId: string, docState: DocState) => {
    saveDocToDisk(docId, docState.doc);
  },
  deleteDocument: async (docId: string): Promise<boolean> => {
    docs.delete(docId);
    const docPath = getDocPath(docId);
    if (fs.existsSync(docPath)) {
      fs.unlinkSync(docPath);
    }
    removeRegistryEntry(docId);
    return true;
  },
  logPrefix: '[Desktop Server]',
  healthMeta: {
    get rooms() { return docs.size; },
    persistence: 'filesystem',
  },
});

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
