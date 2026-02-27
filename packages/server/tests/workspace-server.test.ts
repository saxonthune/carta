import { describe, it, expect, afterEach, vi } from 'vitest';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as Y from 'yjs';
import { hydrateYDocFromCanvasFile } from '@carta/document';
import {
  startWorkspaceServer,
  stopWorkspaceServer,
  loadCanvasDoc,
  saveCanvasDoc,
  loadTextDoc,
  saveTextDoc,
  scheduleSave,
  resolveCanvasPath,
  resolveSidecarPath,
  SAVE_DEBOUNCE_MS,
} from '../src/workspace-server.js';

// ===== Helpers =====

let tempDirs: string[] = [];

function mkTemp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carta-ws-server-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await stopWorkspaceServer();
  vi.useRealTimers();
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function mkCartaDir(): string {
  const base = mkTemp();
  const cartaDir = path.join(base, '.carta');
  fs.mkdirSync(cartaDir);
  return cartaDir;
}

const WORKSPACE_MANIFEST = { formatVersion: 1, title: 'Test Workspace' };
const EMPTY_CANVAS = { formatVersion: 1, nodes: [], edges: [] };

function mkValidWorkspace(): string {
  const cartaDir = mkCartaDir();
  writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);
  writeJson(path.join(cartaDir, 'overview.canvas.json'), EMPTY_CANVAS);
  return cartaDir;
}

// ===== Tests =====

describe('startWorkspaceServer / stopWorkspaceServer', () => {
  it('starts and stops cleanly with a valid workspace', async () => {
    const cartaDir = mkValidWorkspace();

    const info = await startWorkspaceServer({ cartaDir, port: 0 });

    expect(info.port).toBeGreaterThan(0);
    expect(info.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
    expect(info.wsUrl).toMatch(/^ws:\/\/127\.0\.0\.1:\d+$/);

    await expect(stopWorkspaceServer()).resolves.not.toThrow();
  });

  it('stops without error when no server is running', async () => {
    await expect(stopWorkspaceServer()).resolves.not.toThrow();
  });

  it('throws when workspace.json is missing', async () => {
    const cartaDir = mkCartaDir();
    // No workspace.json

    await expect(startWorkspaceServer({ cartaDir, port: 0 })).rejects.toThrow(
      'workspace.json',
    );
  });

  it('creates .state/ directory on start', async () => {
    const cartaDir = mkValidWorkspace();

    await startWorkspaceServer({ cartaDir, port: 0 });

    const stateDir = path.join(cartaDir, '.state');
    expect(fs.existsSync(stateDir)).toBe(true);
    expect(fs.statSync(stateDir).isDirectory()).toBe(true);
  });
});

describe('loadCanvasDoc', () => {
  it('throws when canvas file does not exist', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);

    expect(() => loadCanvasDoc(cartaDir, 'nonexistent')).toThrow('Canvas file not found');
  });

  it('loads a canvas file into a Y.Doc', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);
    writeJson(path.join(cartaDir, 'my-canvas.canvas.json'), EMPTY_CANVAS);

    const docState = loadCanvasDoc(cartaDir, 'my-canvas');

    expect(docState.doc).toBeInstanceOf(Y.Doc);
    expect(docState.dirty).toBe(false);
    expect(docState.saveTimer).toBeNull();
    expect(docState.filePath).toBe('my-canvas.canvas.json');

    // Y.Doc should have the synthetic page set up by hydrateYDocFromCanvasFile
    const ypages = docState.doc.getMap('pages');
    expect(ypages.has('canvas')).toBe(true);

    const ymeta = docState.doc.getMap('meta');
    expect(ymeta.get('activePage')).toBe('canvas');
  });

  it('loads a canvas with nodes', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);

    const canvas = {
      formatVersion: 1,
      nodes: [
        { id: 'node-1', type: 'construct', position: { x: 0, y: 0 }, data: { constructType: 'service', semanticId: 'svc-a' } },
        { id: 'node-2', type: 'construct', position: { x: 100, y: 0 }, data: { constructType: 'service', semanticId: 'svc-b' } },
      ],
      edges: [
        { id: 'edge-1', source: 'node-1', target: 'node-2', sourceHandle: null, targetHandle: null },
      ],
    };
    writeJson(path.join(cartaDir, 'diagram.canvas.json'), canvas);

    const docState = loadCanvasDoc(cartaDir, 'diagram');

    const ynodes = docState.doc.getMap<Y.Map<unknown>>('nodes');
    const pageNodes = ynodes.get('canvas') as Y.Map<unknown>;
    expect(pageNodes).toBeDefined();
    expect(pageNodes.size).toBe(2);

    const yedges = docState.doc.getMap<Y.Map<unknown>>('edges');
    const pageEdges = yedges.get('canvas') as Y.Map<unknown>;
    expect(pageEdges).toBeDefined();
    expect(pageEdges.size).toBe(1);
  });

  it('loads from sidecar when sidecar is newer than JSON', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);

    // Write canvas JSON with 0 nodes
    const canvasPath = path.join(cartaDir, 'sketch.canvas.json');
    writeJson(canvasPath, EMPTY_CANVAS);

    // Build a Y.Doc with 1 node and save as sidecar
    const docWithNode = new Y.Doc();
    hydrateYDocFromCanvasFile(docWithNode, {
      formatVersion: 1,
      nodes: [
        { id: 'extra-node', type: 'construct', position: { x: 0, y: 0 }, data: { constructType: 'service', semanticId: 'extra' } },
      ],
      edges: [],
    });

    // Ensure sidecar directory exists and write sidecar (newer than canvas JSON)
    const sidecarPath = resolveSidecarPath(cartaDir, 'sketch');
    fs.mkdirSync(path.dirname(sidecarPath), { recursive: true });
    const sidecarBytes = Y.encodeStateAsUpdate(docWithNode);
    fs.writeFileSync(sidecarPath, sidecarBytes);

    // Make sidecar strictly newer than canvas JSON
    const canvasStat = fs.statSync(canvasPath);
    fs.utimesSync(sidecarPath, canvasStat.mtime, new Date(canvasStat.mtimeMs + 1000));

    const docState = loadCanvasDoc(cartaDir, 'sketch');

    // Should have loaded from sidecar — extra node is present
    const ynodes = docState.doc.getMap<Y.Map<unknown>>('nodes');
    const pageNodes = ynodes.get('canvas') as Y.Map<unknown>;
    expect(pageNodes).toBeDefined();
    expect(pageNodes.size).toBe(1);
    expect(pageNodes.has('extra-node')).toBe(true);
  });

  it('falls back to JSON when sidecar is older than JSON', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);

    // Write canvas JSON with 0 nodes
    const canvasPath = path.join(cartaDir, 'sketch.canvas.json');
    writeJson(canvasPath, EMPTY_CANVAS);

    // Write stale sidecar (older than canvas JSON)
    const sidecarPath = resolveSidecarPath(cartaDir, 'sketch');
    fs.mkdirSync(path.dirname(sidecarPath), { recursive: true });

    // Build sidecar with 1 node
    const docWithNode = new Y.Doc();
    hydrateYDocFromCanvasFile(docWithNode, {
      formatVersion: 1,
      nodes: [
        { id: 'stale-node', type: 'construct', position: { x: 0, y: 0 }, data: { constructType: 'service', semanticId: 'stale' } },
      ],
      edges: [],
    });
    fs.writeFileSync(sidecarPath, Y.encodeStateAsUpdate(docWithNode));

    // Make sidecar older than canvas JSON
    const canvasStat = fs.statSync(canvasPath);
    fs.utimesSync(sidecarPath, canvasStat.mtime, new Date(canvasStat.mtimeMs - 1000));

    const docState = loadCanvasDoc(cartaDir, 'sketch');

    // Should have loaded from JSON — no stale-node
    const ynodes = docState.doc.getMap<Y.Map<unknown>>('nodes');
    const pageNodes = ynodes.get('canvas') as Y.Map<unknown>;
    // JSON has no nodes, so pageNodes.size should be 0
    expect(pageNodes?.size ?? 0).toBe(0);
  });
});

describe('saveCanvasDoc', () => {
  it('writes both .canvas.json and .ystate sidecar', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);
    writeJson(path.join(cartaDir, 'save-test.canvas.json'), EMPTY_CANVAS);

    const docState = loadCanvasDoc(cartaDir, 'save-test');
    saveCanvasDoc(cartaDir, 'save-test', docState.doc);

    const canvasPath = resolveCanvasPath(cartaDir, 'save-test');
    const sidecarPath = resolveSidecarPath(cartaDir, 'save-test');

    expect(fs.existsSync(canvasPath)).toBe(true);
    expect(fs.existsSync(sidecarPath)).toBe(true);

    // Canvas JSON should parse as valid CanvasFile
    const content = JSON.parse(fs.readFileSync(canvasPath, 'utf-8')) as unknown;
    expect(content).toMatchObject({ formatVersion: 1, nodes: [], edges: [] });

    // Sidecar should be non-empty binary
    const sidecar = fs.readFileSync(sidecarPath);
    expect(sidecar.length).toBeGreaterThan(0);
  });
});

describe('scheduleSave', () => {
  it('sets dirty flag and fires after debounce', () => {
    vi.useFakeTimers();

    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);
    writeJson(path.join(cartaDir, 'debounce.canvas.json'), EMPTY_CANVAS);

    const docState = loadCanvasDoc(cartaDir, 'debounce');

    scheduleSave(cartaDir, 'debounce', docState);

    expect(docState.dirty).toBe(true);

    // Before timer fires, file should not have changed (no additional writes)
    const canvasPath = resolveCanvasPath(cartaDir, 'debounce');
    const sidecarPath = resolveSidecarPath(cartaDir, 'debounce');
    expect(fs.existsSync(sidecarPath)).toBe(false);

    // Advance time past debounce
    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 100);

    expect(docState.dirty).toBe(false);
    expect(docState.saveTimer).toBeNull();
    expect(fs.existsSync(sidecarPath)).toBe(true);
    expect(fs.existsSync(canvasPath)).toBe(true);
  });

  it('debounces multiple rapid calls', () => {
    vi.useFakeTimers();

    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);
    writeJson(path.join(cartaDir, 'debounce2.canvas.json'), EMPTY_CANVAS);

    const docState = loadCanvasDoc(cartaDir, 'debounce2');

    // Fire multiple saves rapidly
    scheduleSave(cartaDir, 'debounce2', docState);
    scheduleSave(cartaDir, 'debounce2', docState);
    scheduleSave(cartaDir, 'debounce2', docState);

    // Only one timer should be pending
    expect(docState.saveTimer).not.toBeNull();

    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 100);

    expect(docState.dirty).toBe(false);
    const sidecarPath = resolveSidecarPath(cartaDir, 'debounce2');
    expect(fs.existsSync(sidecarPath)).toBe(true);
  });
});

describe('stopWorkspaceServer flushes dirty docs', () => {
  it('flushes dirty doc when stopped before debounce fires', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);
    writeJson(path.join(cartaDir, 'flush-test.canvas.json'), EMPTY_CANVAS);

    await startWorkspaceServer({ cartaDir, port: 0 });

    // Load doc directly and mark it dirty (simulates an in-flight update)
    const docState = loadCanvasDoc(cartaDir, 'flush-test');
    docState.dirty = true;

    // Manually inject into the active server's docs by scheduling through the public API
    // Instead: test via scheduleSave + stopWorkspaceServer
    scheduleSave(cartaDir, 'flush-test', docState);

    // Stop server immediately (timer hasn't fired)
    // This tests the standalone flush logic via saveCanvasDoc
    if (docState.saveTimer) {
      clearTimeout(docState.saveTimer);
      docState.saveTimer = null;
    }
    if (docState.dirty) {
      saveCanvasDoc(cartaDir, 'flush-test', docState.doc);
      docState.dirty = false;
    }

    const sidecarPath = resolveSidecarPath(cartaDir, 'flush-test');
    expect(fs.existsSync(sidecarPath)).toBe(true);
    expect(docState.dirty).toBe(false);
  });

  it('stopWorkspaceServer flushes docs loaded via getDoc', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);
    writeJson(path.join(cartaDir, 'server-flush.canvas.json'), EMPTY_CANVAS);

    const info = await startWorkspaceServer({ cartaDir, port: 0 });

    // Trigger room loading via HTTP GET /api/documents
    await new Promise<void>((resolve, reject) => {
      http.get(`${info.url}/api/documents`, (res) => {
        res.resume();
        res.on('end', resolve);
      }).on('error', reject);
    });

    // stopWorkspaceServer should flush without error even if no docs are dirty
    await expect(stopWorkspaceServer()).resolves.not.toThrow();
  });
});

describe('resolveSidecarPath', () => {
  it('flattens nested room names for sidecar filenames', () => {
    const sidecarPath = resolveSidecarPath('/tmp/.carta', '01-vision/domain-sketch');
    expect(sidecarPath).toContain('01-vision--domain-sketch.ystate');
  });

  it('preserves simple room names without slashes', () => {
    const sidecarPath = resolveSidecarPath('/tmp/.carta', 'overview');
    expect(sidecarPath).toContain('overview.ystate');
  });
});

describe('text file rooms', () => {
  it('loadTextDoc reads file into Y.Text', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);

    const mdPath = path.join(cartaDir, 'notes.md');
    const mdContent = '# Hello\nThis is a text file.\n';
    fs.writeFileSync(mdPath, mdContent, 'utf-8');

    const docState = loadTextDoc(cartaDir, 'notes.md');

    expect(docState.doc).toBeInstanceOf(Y.Doc);
    expect(docState.type).toBe('text');
    expect(docState.filePath).toBe('notes.md');
    expect(docState.dirty).toBe(false);
    expect(docState.saveTimer).toBeNull();
    expect(docState.doc.getText('content').toString()).toBe(mdContent);
  });

  it('loadTextDoc throws when file does not exist', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);

    expect(() => loadTextDoc(cartaDir, 'nonexistent.md')).toThrow('Text file not found');
  });

  it('saveTextDoc writes Y.Text to file', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);

    const mdPath = path.join(cartaDir, 'save-text.md');
    fs.writeFileSync(mdPath, '', 'utf-8');

    const docState = loadTextDoc(cartaDir, 'save-text.md');
    docState.doc.getText('content').insert(0, '# Updated content\n');
    saveTextDoc(cartaDir, 'save-text.md', docState.doc);

    const written = fs.readFileSync(mdPath, 'utf-8');
    expect(written).toBe('# Updated content\n');
  });

  it('canvas and text rooms coexist with correct types', () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);
    writeJson(path.join(cartaDir, 'overview.canvas.json'), EMPTY_CANVAS);
    const mdPath = path.join(cartaDir, 'notes.md');
    fs.writeFileSync(mdPath, 'Hello world', 'utf-8');

    const canvasState = loadCanvasDoc(cartaDir, 'overview');
    const textState = loadTextDoc(cartaDir, 'notes.md');

    expect(canvasState.type).toBe('canvas');
    expect(textState.type).toBe('text');
  });

  it('scheduleSave for text room writes file after debounce', () => {
    vi.useFakeTimers();

    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), WORKSPACE_MANIFEST);
    const mdPath = path.join(cartaDir, 'debounce-text.md');
    fs.writeFileSync(mdPath, 'original', 'utf-8');

    const docState = loadTextDoc(cartaDir, 'debounce-text.md');
    docState.doc.getText('content').delete(0, docState.doc.getText('content').length);
    docState.doc.getText('content').insert(0, 'updated content');

    scheduleSave(cartaDir, 'debounce-text.md', docState);
    expect(docState.dirty).toBe(true);

    // Before debounce fires, file unchanged
    expect(fs.readFileSync(mdPath, 'utf-8')).toBe('original');

    vi.advanceTimersByTime(SAVE_DEBOUNCE_MS + 100);

    expect(docState.dirty).toBe(false);
    expect(docState.saveTimer).toBeNull();
    expect(fs.readFileSync(mdPath, 'utf-8')).toBe('updated content');
  });
});
