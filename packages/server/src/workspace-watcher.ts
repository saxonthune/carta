/**
 * WorkspaceWatcher — watches the .carta/ directory for external file changes.
 *
 * Emits typed events when canvas files or schemas change externally.
 * Integrates with workspace-server.ts to re-hydrate idle rooms on change.
 *
 * See ADR 009 (doc02.04.09) — resolved: hot reload strategy.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { EventEmitter } from 'node:events';
import createDebug from 'debug';

const log = createDebug('carta:workspace-watcher');

const DEBOUNCE_MS = 100; // Zed uses 100ms

export class WorkspaceWatcher extends EventEmitter {
  private cartaDir: string;
  private watcher: fs.FSWatcher | null = null;
  private debounceTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
  /** Track known files for create/delete detection */
  private knownFiles: Set<string> = new Set();

  constructor(cartaDir: string) {
    super();
    this.cartaDir = cartaDir;
  }

  start(): void {
    this.knownFiles = this.scanKnownFiles();
    log('starting watcher on %s (%d known files)', this.cartaDir, this.knownFiles.size);

    this.watcher = fs.watch(this.cartaDir, { recursive: true }, (eventType, filename) => {
      if (!filename) return;
      // Normalize Windows backslashes to forward slashes
      const normalizedFilename = filename.replace(/\\/g, '/');
      if (normalizedFilename.startsWith('.state')) return; // ignore sidecar dir
      this.handleFileEvent(normalizedFilename);
    });
  }

  stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
    this.removeAllListeners();
    log('stopped');
  }

  private scanKnownFiles(): Set<string> {
    const files = new Set<string>();
    const walk = (dir: string, prefix: string) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name.startsWith('.')) continue;
          const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
          if (entry.isDirectory() && entry.name !== '.state') {
            walk(path.join(dir, entry.name), relPath);
          } else if (entry.isFile()) {
            if (entry.name.endsWith('.canvas.json') || relPath === 'schemas/schemas.json') {
              files.add(relPath);
            }
          }
        }
      } catch { /* directory may not exist */ }
    };
    walk(this.cartaDir, '');
    return files;
  }

  private handleFileEvent(filename: string): void {
    const existing = this.debounceTimers.get(filename);
    if (existing) clearTimeout(existing);

    this.debounceTimers.set(filename, setTimeout(() => {
      this.debounceTimers.delete(filename);
      this.classifyAndEmit(filename);
    }, DEBOUNCE_MS));
  }

  private classifyAndEmit(filename: string): void {
    const absPath = path.join(this.cartaDir, filename);
    const exists = fs.existsSync(absPath);
    const wasKnown = this.knownFiles.has(filename);

    if (filename === 'schemas/schemas.json') {
      if (exists) {
        log('schemas.json changed');
        this.emit('schemas-changed');
      }
      // deleted schemas.json is also a tree change
      if (!exists && wasKnown) {
        this.knownFiles.delete(filename);
        this.emit('tree-changed');
      } else if (exists && !wasKnown) {
        this.knownFiles.add(filename);
        this.emit('tree-changed');
      }
      return;
    }

    if (filename.endsWith('.canvas.json')) {
      // Strip the .canvas.json extension to get the canvas path (room name)
      const canvasPath = filename.replace(/\.canvas\.json$/, '');

      if (exists && wasKnown) {
        log('canvas changed: %s', canvasPath);
        this.emit('canvas-changed', canvasPath);
      } else if (exists && !wasKnown) {
        log('canvas created: %s', canvasPath);
        this.knownFiles.add(filename);
        this.emit('canvas-created', canvasPath);
        this.emit('tree-changed');
      } else if (!exists && wasKnown) {
        log('canvas deleted: %s', canvasPath);
        this.knownFiles.delete(filename);
        this.emit('canvas-deleted', canvasPath);
        this.emit('tree-changed');
      }
      return;
    }

    // Non-canvas file or directory change — just a tree structure change
    // (new resource file, deleted group directory, etc.)
    if (exists !== wasKnown) {
      if (exists) this.knownFiles.add(filename);
      else this.knownFiles.delete(filename);
      this.emit('tree-changed');
    }
  }
}
