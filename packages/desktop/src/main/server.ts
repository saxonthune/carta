/**
 * Embedded Document Server for Carta Desktop
 *
 * Lightweight HTTP + WebSocket server running in the Electron main process.
 * Uses the shared document-server-core from @carta/server, with filesystem
 * persistence in a user-visible vault folder.
 *
 * Persistence: Human-readable JSON files in user's vault folder
 *   - {docId}.json — CartaFile v6 format (human-readable)
 *   - Debounced save on Y.Doc changes (~2s)
 *   - Flush on app quit
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as Y from 'yjs';
import { WebSocketServer } from 'ws';
import createDebug from 'debug';
import {
  migrateToPages,
  migrateRenderStyleToNodeShape,
  extractCartaFile,
  hydrateYDocFromCartaFile,
  validateCartaFile,
  CARTA_FILE_VERSION,
  generatePageId,
} from '@carta/document';
import { generateDocumentId, generateSemanticId } from '@carta/domain';
import {
  createDocumentServer,
  type DocState,
  type DocumentSummary,
} from '@carta/server/document-server-core';

const log = createDebug('carta:desktop-server');

// ===== TYPES =====

interface DesktopDocState extends DocState {
  dirty: boolean;
  saveTimer: ReturnType<typeof setTimeout> | null;
  /** Whether this doc should be persisted to disk (loaded from file or explicitly created) */
  persist: boolean;
  /** Human-readable filename on disk, e.g. "my-project.carta.json" */
  filename: string;
}

export interface EmbeddedServerInfo {
  url: string;
  wsUrl: string;
  port: number;
  documentId?: string;
}

// ===== CONSTANTS =====

const DEFAULT_PORT = 51234;
const SAVE_DEBOUNCE_MS = 2000;

// ===== STATE =====

let vaultDir: string;
let userDataDir: string;
let serverInfoPath: string;
const docs = new Map<string, DesktopDocState>();
/** Maps opaque docId → human-readable filename (e.g. "my-project.carta.json") */
const docIdToFilename = new Map<string, string>();
let httpServer: http.Server | null = null;
let wss: WebSocketServer | null = null;

// ===== PERSISTENCE =====

function ensureVaultDir(): void {
  if (!fs.existsSync(vaultDir)) {
    fs.mkdirSync(vaultDir, { recursive: true });
  }
}

function getDocPath(filename: string): string {
  return path.join(vaultDir, filename);
}

/**
 * Find a unique filename in the vault, appending -2, -3, etc. on collision.
 */
function resolveUniqueFilename(filename: string): string {
  if (!fs.existsSync(getDocPath(filename))) return filename;
  const base = filename.replace(/\.carta\.json$/, '');
  let counter = 2;
  while (fs.existsSync(getDocPath(`${base}-${counter}.carta.json`))) {
    counter++;
  }
  return `${base}-${counter}.carta.json`;
}

/**
 * Scan vault folder for all .json document files.
 */
function scanVaultForDocuments(): DocumentSummary[] {
  ensureVaultDir();
  const documents: DocumentSummary[] = [];

  try {
    const files = fs.readdirSync(vaultDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filePath = path.join(vaultDir, file);

      try {
        const content = fs.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(content);

        // Use stored docId if present (human-readable filename files), else derive from filename
        const docId = (data.docId as string | undefined) || file.slice(0, -5);
        docIdToFilename.set(docId, file);

        const title = data.title || docId;
        const folder = '/'; // Flat folder structure for now
        const stat = fs.statSync(filePath);
        const updatedAt = stat.mtime.toISOString();

        const nodeCount = 0; // Skip counting for list performance

        documents.push({
          id: docId,
          title,
          folder,
          updatedAt,
          nodeCount,
          filename: file,
        });
      } catch {
        // Skip invalid files
      }
    }
  } catch {
    // Vault doesn't exist yet
  }

  return documents;
}

/**
 * Save Y.Doc to JSON file.
 */
function saveDocToJson(docId: string, doc: Y.Doc): void {
  ensureVaultDir();
  const filename = docs.get(docId)?.filename || docIdToFilename.get(docId) || `${docId}.json`;
  const cartaFile = extractCartaFile(doc);
  // Embed docId in the file so scanVaultForDocuments can reconstruct the mapping
  const jsonContent = JSON.stringify({ docId, ...cartaFile }, null, 2);
  fs.writeFileSync(getDocPath(filename), jsonContent, 'utf-8');
}

/**
 * Load Y.Doc from JSON file.
 * Returns true if file exists and was loaded successfully.
 */
function loadDocFromJson(docId: string, doc: Y.Doc): boolean {
  const filename = docIdToFilename.get(docId) || `${docId}.json`;
  const docPath = getDocPath(filename);
  if (!fs.existsSync(docPath)) return false;

  try {
    const content = fs.readFileSync(docPath, 'utf-8');
    const data = JSON.parse(content);
    const cartaFile = validateCartaFile(data);
    hydrateYDocFromCartaFile(doc, cartaFile);
    return true;
  } catch (err) {
    log('Failed to load %s: %O', docId, err);
    return false;
  }
}

/**
 * Create a hello-world document with starter content.
 * Returns the document ID.
 */
function createHelloWorldDocument(): string {
  const docId = generateDocumentId();
  const pageId = generatePageId();

  const nodeA = crypto.randomUUID();
  const nodeB = crypto.randomUUID();
  const nodeC = crypto.randomUUID();

  const cartaFile = {
    version: CARTA_FILE_VERSION,
    title: 'Hello World',
    description: 'Your first Carta project',
    pages: [
      {
        id: pageId,
        name: 'Main',
        order: 0,
        nodes: [
          {
            id: nodeA,
            type: 'construct',
            position: { x: 100, y: 200 },
            data: {
              constructType: 'note',
              semanticId: generateSemanticId('note'),
              values: { content: 'Your idea starts here' },
              detailMode: 'summary',
            },
          },
          {
            id: nodeB,
            type: 'construct',
            position: { x: 450, y: 100 },
            data: {
              constructType: 'note',
              semanticId: generateSemanticId('note'),
              values: { content: 'Break it into pieces' },
              detailMode: 'summary',
            },
          },
          {
            id: nodeC,
            type: 'construct',
            position: { x: 450, y: 300 },
            data: {
              constructType: 'note',
              semanticId: generateSemanticId('note'),
              values: { content: 'Connect them together' },
              detailMode: 'summary',
            },
          },
        ],
        edges: [
          {
            id: `edge-${crypto.randomUUID()}`,
            source: nodeA,
            target: nodeB,
            sourceHandle: 'link',
            targetHandle: 'link',
          },
          {
            id: `edge-${crypto.randomUUID()}`,
            source: nodeA,
            target: nodeC,
            sourceHandle: 'link',
            targetHandle: 'link',
          },
        ],
        deployables: [],
      },
    ],
    customSchemas: [],
    portSchemas: [],
    schemaGroups: [],
    exportedAt: new Date().toISOString(),
  };

  ensureVaultDir();
  const filename = 'hello-world.carta.json';
  docIdToFilename.set(docId, filename);
  const jsonContent = JSON.stringify({ docId, ...cartaFile }, null, 2);
  fs.writeFileSync(getDocPath(filename), jsonContent, 'utf-8');

  log('Created hello-world document: %s', docId);
  return docId;
}

/**
 * Ensure vault has at least one document.
 * Creates a hello-world document if vault is empty.
 * Returns the document ID (either existing or newly created).
 */
export function ensureVaultHasDocument(): string {
  const documents = scanVaultForDocuments();
  if (documents.length > 0) {
    // Return the most recently updated document
    documents.sort((a, b) => {
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
    return documents[0].id;
  }
  return createHelloWorldDocument();
}

function scheduleSave(docId: string, docState: DesktopDocState): void {
  docState.dirty = true;
  if (docState.saveTimer) {
    clearTimeout(docState.saveTimer);
  }
  docState.saveTimer = setTimeout(() => {
    if (docState.dirty) {
      saveDocToJson(docId, docState.doc);
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
  const loaded = loadDocFromJson(docId, doc);
  const filename = docIdToFilename.get(docId) || '';
  docState = { doc, conns: new Set(), dirty: false, saveTimer: null, persist: loaded, filename };
  docs.set(docId, docState);

  // Migrate flat docs to page-based structure
  if (loaded) {
    migrateToPages(doc);
    migrateRenderStyleToNodeShape(doc);
  }

  // Schedule saves on updates (only for docs that exist on disk or were explicitly created)
  doc.on('update', () => {
    if (docState!.persist) {
      scheduleSave(docId, docState!);
    }
  });

  return docState;
}

// ===== SERVER SETUP =====

const { handleHttpRequest, setupWSConnection } = createDocumentServer({
  getDoc: async (docId: string) => getOrCreateDoc(docId),
  getActiveRooms: () => Array.from(docs.entries()).map(([roomId, docState]) => ({
    roomId,
    clientCount: docState.conns.size,
  })),
  listDocuments: async (): Promise<DocumentSummary[]> => {
    return scanVaultForDocuments();
  },
  onDocumentCreated: async (docId: string, docState: DocState, filename: string) => {
    const desktopState = docState as DesktopDocState;
    const resolvedFilename = resolveUniqueFilename(filename);
    desktopState.filename = resolvedFilename;
    desktopState.persist = true;
    docIdToFilename.set(docId, resolvedFilename);
    saveDocToJson(docId, docState.doc);
  },
  deleteDocument: async (docId: string): Promise<boolean> => {
    docs.delete(docId);
    const filename = docIdToFilename.get(docId) || `${docId}.json`;
    const docPath = getDocPath(filename);
    if (fs.existsSync(docPath)) {
      fs.unlinkSync(docPath);
    }
    docIdToFilename.delete(docId);
    return true;
  },
  healthMeta: {
    get rooms() { return docs.size; },
    persistence: 'filesystem-json',
  },
});

// ===== PUBLIC API =====

/**
 * Start the embedded document server.
 * @param userDataPath - Electron app.getPath('userData')
 * @param vaultPath - Path to the vault folder
 * @returns Server info (URL, WebSocket URL, port)
 */
export async function startEmbeddedServer(userDataPath: string, vaultPath: string): Promise<EmbeddedServerInfo> {
  vaultDir = vaultPath;
  userDataDir = userDataPath;
  serverInfoPath = path.join(userDataPath, 'server.json');
  ensureVaultDir();

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
      log('Unhandled HTTP error: %O', err);
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

  log('Running on port %d', port);
  log('Vault dir: %s', vaultDir);

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
      saveDocToJson(docId, docState.doc);
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

  log('Stopped');
}

/**
 * Get the path where MCP binary expects to find server.json
 */
export function getServerInfoPath(userDataPath: string): string {
  return path.join(userDataPath, 'server.json');
}
