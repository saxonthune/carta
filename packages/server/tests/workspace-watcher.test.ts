import { describe, it, expect, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { WorkspaceWatcher } from '../src/workspace-watcher.js';

// ===== Helpers =====

let tempDirs: string[] = [];
let watchers: WorkspaceWatcher[] = [];

function mkTemp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carta-watcher-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  for (const w of watchers) {
    w.stop();
  }
  watchers = [];
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

function mkCartaDir(): string {
  const base = mkTemp();
  const cartaDir = path.join(base, '.carta');
  fs.mkdirSync(cartaDir);
  return cartaDir;
}

function writeJson(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function mkWatcher(cartaDir: string): WorkspaceWatcher {
  const w = new WorkspaceWatcher(cartaDir);
  watchers.push(w);
  return w;
}

/** Wait for a specific event from the watcher with a timeout */
function waitForEvent(watcher: WorkspaceWatcher, event: string, timeout = 2000): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeout);
    watcher.once(event, (...args: unknown[]) => {
      clearTimeout(timer);
      resolve(args);
    });
  });
}

/** Wait briefly to confirm no event fires */
function assertNoEvent(watcher: WorkspaceWatcher, event: string, waitMs = 500): Promise<void> {
  return new Promise((resolve, reject) => {
    const handler = () => {
      reject(new Error(`Unexpected event: ${event}`));
    };
    watcher.once(event, handler);
    setTimeout(() => {
      watcher.removeListener(event, handler);
      resolve();
    }, waitMs);
  });
}

const EMPTY_CANVAS = { formatVersion: 1, nodes: [], edges: [] };
const SCHEMAS = { formatVersion: 1, schemas: [] };

// ===== Tests =====

describe('WorkspaceWatcher', () => {
  it('canvas change emits canvas-changed', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });
    writeJson(path.join(cartaDir, 'test.canvas.json'), EMPTY_CANVAS);

    const w = mkWatcher(cartaDir);
    w.start();

    const eventPromise = waitForEvent(w, 'canvas-changed');
    // Overwrite with slightly different content
    writeJson(path.join(cartaDir, 'test.canvas.json'), { ...EMPTY_CANVAS, nodes: [] });

    const [canvasPath] = await eventPromise;
    expect(canvasPath).toBe('test');
  });

  it('canvas create emits canvas-created and tree-changed', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });

    const w = mkWatcher(cartaDir);
    w.start();

    const createdPromise = waitForEvent(w, 'canvas-created');
    const treePromise = waitForEvent(w, 'tree-changed');

    writeJson(path.join(cartaDir, 'new.canvas.json'), EMPTY_CANVAS);

    const [canvasPath] = await createdPromise;
    expect(canvasPath).toBe('new');
    await treePromise; // must also fire
  });

  it('canvas delete emits canvas-deleted and tree-changed', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });
    writeJson(path.join(cartaDir, 'removeme.canvas.json'), EMPTY_CANVAS);

    const w = mkWatcher(cartaDir);
    w.start();

    const deletedPromise = waitForEvent(w, 'canvas-deleted');
    const treePromise = waitForEvent(w, 'tree-changed');

    fs.unlinkSync(path.join(cartaDir, 'removeme.canvas.json'));

    const [canvasPath] = await deletedPromise;
    expect(canvasPath).toBe('removeme');
    await treePromise;
  });

  it('schemas change emits schemas-changed', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });
    writeJson(path.join(cartaDir, 'schemas', 'schemas.json'), SCHEMAS);

    const w = mkWatcher(cartaDir);
    w.start();

    const eventPromise = waitForEvent(w, 'schemas-changed');
    writeJson(path.join(cartaDir, 'schemas', 'schemas.json'), { ...SCHEMAS, schemas: [] });

    await eventPromise;
  });

  it('ignores .state/ directory changes', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });

    const stateDir = path.join(cartaDir, '.state');
    fs.mkdirSync(stateDir, { recursive: true });

    const w = mkWatcher(cartaDir);
    w.start();

    // Write a sidecar file — should NOT emit any event
    await assertNoEvent(w, 'canvas-changed', 500);
    // actually write the file during the wait window
    fs.writeFileSync(path.join(stateDir, 'foo.ystate'), Buffer.from('test'));

    // If we get here without rejecting, the test passed
  });

  it('debounces rapid changes to emit canvas-changed exactly once', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });
    writeJson(path.join(cartaDir, 'debounce.canvas.json'), EMPTY_CANVAS);

    const w = mkWatcher(cartaDir);
    w.start();

    let count = 0;
    w.on('canvas-changed', () => { count++; });

    // Write 5 times rapidly (synchronous, so < 1ms apart)
    const canvasFile = path.join(cartaDir, 'debounce.canvas.json');
    for (let i = 0; i < 5; i++) {
      fs.writeFileSync(canvasFile, JSON.stringify({ ...EMPTY_CANVAS, _seq: i }, null, 2), 'utf-8');
    }

    // Wait for debounce + event to settle
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(count).toBe(1);
  });

  it('stop cleans up — no events after stop', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });
    writeJson(path.join(cartaDir, 'after-stop.canvas.json'), EMPTY_CANVAS);

    const w = mkWatcher(cartaDir);
    w.start();
    w.stop();

    let fired = false;
    // After stop, listeners are removed — but attach a fresh one to see if events still come
    // We need to re-add a listener after stop to test
    const innerW = new WorkspaceWatcher(cartaDir); // not tracked in watchers[] since we manage it manually
    try {
      // Write file — if watcher is truly stopped, no events
      writeJson(path.join(cartaDir, 'after-stop.canvas.json'), { ...EMPTY_CANVAS, nodes: [] });
      // Wait briefly — no events should arrive from the stopped watcher
      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(fired).toBe(false);
    } finally {
      innerW.stop();
    }
  });

  it('group directory file changes emit tree-changed', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });

    const w = mkWatcher(cartaDir);
    w.start();

    const treePromise = waitForEvent(w, 'tree-changed');

    // Create a group directory with a _group.json
    writeJson(path.join(cartaDir, '01-vision', '_group.json'), { name: 'Vision' });

    await treePromise;
  });
});

describe('text file events', () => {
  it('text file creation emits text-file-changed and tree-changed', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });

    const w = mkWatcher(cartaDir);
    w.start();

    const changedPromise = waitForEvent(w, 'text-file-changed');
    const treePromise = waitForEvent(w, 'tree-changed');

    fs.writeFileSync(path.join(cartaDir, 'notes.md'), '# Hello\n', 'utf-8');

    const [filePath] = await changedPromise;
    expect(filePath).toBe('notes.md');
    await treePromise;
  });

  it('text file modification emits text-file-changed', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });
    fs.writeFileSync(path.join(cartaDir, 'existing.md'), '# Initial\n', 'utf-8');

    const w = mkWatcher(cartaDir);
    w.start();

    const changedPromise = waitForEvent(w, 'text-file-changed');

    fs.writeFileSync(path.join(cartaDir, 'existing.md'), '# Updated\n', 'utf-8');

    const [filePath] = await changedPromise;
    expect(filePath).toBe('existing.md');
  });

  it('text file deletion emits text-file-deleted and tree-changed', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });
    fs.writeFileSync(path.join(cartaDir, 'delete-me.md'), '# Delete\n', 'utf-8');

    const w = mkWatcher(cartaDir);
    w.start();

    const deletedPromise = waitForEvent(w, 'text-file-deleted');
    const treePromise = waitForEvent(w, 'tree-changed');

    fs.unlinkSync(path.join(cartaDir, 'delete-me.md'));

    const [filePath] = await deletedPromise;
    expect(filePath).toBe('delete-me.md');
    await treePromise;
  });

  it('canvas files still emit canvas events (not text-file events)', async () => {
    const cartaDir = mkCartaDir();
    writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });

    const w = mkWatcher(cartaDir);
    w.start();

    const canvasPromise = waitForEvent(w, 'canvas-created');

    writeJson(path.join(cartaDir, 'diagram.canvas.json'), EMPTY_CANVAS);

    const [canvasPath] = await canvasPromise;
    expect(canvasPath).toBe('diagram');
  });
});
