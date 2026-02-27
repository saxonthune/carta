/**
 * Integration tests for `carta serve` static file serving behavior.
 *
 * Tests the `clientDir` option on `startWorkspaceServer`, which enables:
 * - Static file serving from a dist/ directory
 * - SPA fallback to index.html for unknown paths
 * - Runtime config injection (__CARTA_CONFIG__) into HTML
 * - API route pass-through (non-static paths still hit document server)
 * - Port auto-increment when the requested port is in use
 * - Path traversal prevention
 */
import { describe, it, expect, afterEach } from 'vitest';
import * as http from 'node:http';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  startWorkspaceServer,
  stopWorkspaceServer,
} from '../src/workspace-server.js';

// ===== Helpers =====

let tempDirs: string[] = [];

function mkTemp(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'carta-serve-test-'));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await stopWorkspaceServer();
  for (const dir of tempDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  tempDirs = [];
});

function writeFile(filePath: string, content: string | Buffer): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
}

function writeJson(filePath: string, data: unknown): void {
  writeFile(filePath, JSON.stringify(data, null, 2));
}

/** Create a minimal valid workspace directory */
function mkValidWorkspace(): string {
  const base = mkTemp();
  const cartaDir = path.join(base, '.carta');
  fs.mkdirSync(cartaDir);
  writeJson(path.join(cartaDir, 'workspace.json'), { formatVersion: 1, title: 'Test' });
  writeJson(path.join(cartaDir, 'overview.canvas.json'), { formatVersion: 1, nodes: [], edges: [] });
  return cartaDir;
}

/** Create a minimal mock web-client dist directory */
function mkClientDir(): string {
  const clientDir = mkTemp();
  const html = `<!DOCTYPE html><html><head><title>Carta</title></head><body></body></html>`;
  writeFile(path.join(clientDir, 'index.html'), html);
  writeFile(path.join(clientDir, 'assets', 'app.js'), 'console.log("app");');
  writeFile(path.join(clientDir, 'assets', 'style.css'), 'body { margin: 0; }');
  return clientDir;
}

/** Make an HTTP GET request and return status + body */
async function httpGet(url: string): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let body = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk: string) => { body += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body });
      });
    }).on('error', reject);
  });
}

// ===== Tests =====

describe('static file serving', () => {
  it('serves index.html with __CARTA_CONFIG__ injected', async () => {
    const cartaDir = mkValidWorkspace();
    const clientDir = mkClientDir();

    const info = await startWorkspaceServer({ cartaDir, port: 0, clientDir });

    const { status, headers, body } = await httpGet(`${info.url}/`);

    expect(status).toBe(200);
    expect(headers['content-type']).toContain('text/html');
    expect(body).toContain('__CARTA_CONFIG__');
    expect(body).toContain('"syncUrl"');
    expect(body).toContain(info.url);
  });

  it('serves static JS with correct MIME type', async () => {
    const cartaDir = mkValidWorkspace();
    const clientDir = mkClientDir();

    const info = await startWorkspaceServer({ cartaDir, port: 0, clientDir });

    const { status, headers, body } = await httpGet(`${info.url}/assets/app.js`);

    expect(status).toBe(200);
    expect(headers['content-type']).toContain('application/javascript');
    expect(body).toContain('console.log');
  });

  it('serves static CSS with correct MIME type', async () => {
    const cartaDir = mkValidWorkspace();
    const clientDir = mkClientDir();

    const info = await startWorkspaceServer({ cartaDir, port: 0, clientDir });

    const { status, headers, body } = await httpGet(`${info.url}/assets/style.css`);

    expect(status).toBe(200);
    expect(headers['content-type']).toContain('text/css');
    expect(body).toContain('margin');
  });
});

describe('SPA fallback', () => {
  it('serves index.html (with config injection) for unknown deep paths', async () => {
    const cartaDir = mkValidWorkspace();
    const clientDir = mkClientDir();

    const info = await startWorkspaceServer({ cartaDir, port: 0, clientDir });

    const { status, headers, body } = await httpGet(`${info.url}/some/deep/path`);

    expect(status).toBe(200);
    expect(headers['content-type']).toContain('text/html');
    expect(body).toContain('__CARTA_CONFIG__');
  });

  it('serves index.html for root path without trailing slash', async () => {
    const cartaDir = mkValidWorkspace();
    const clientDir = mkClientDir();

    const info = await startWorkspaceServer({ cartaDir, port: 0, clientDir });

    const { status, body } = await httpGet(info.url);

    expect(status).toBe(200);
    expect(body).toContain('__CARTA_CONFIG__');
  });
});

describe('API routes pass-through', () => {
  it('/health returns JSON health response, not static file', async () => {
    const cartaDir = mkValidWorkspace();
    const clientDir = mkClientDir();

    const info = await startWorkspaceServer({ cartaDir, port: 0, clientDir });

    const { status, headers, body } = await httpGet(`${info.url}/health`);

    expect(status).toBe(200);
    expect(headers['content-type']).toContain('application/json');
    const parsed = JSON.parse(body) as unknown;
    expect(parsed).toMatchObject({ status: 'ok' });
  });

  it('/api/workspace returns workspace tree, not static file', async () => {
    const cartaDir = mkValidWorkspace();
    const clientDir = mkClientDir();

    const info = await startWorkspaceServer({ cartaDir, port: 0, clientDir });

    const { status, headers } = await httpGet(`${info.url}/api/workspace`);

    expect(status).toBe(200);
    expect(headers['content-type']).toContain('application/json');
  });
});

describe('port auto-increment', () => {
  it('uses next available port when requested port is in use', async () => {
    const cartaDir = mkValidWorkspace();

    // Start first server to occupy a port
    const first = await startWorkspaceServer({ cartaDir, port: 0 });
    const occupiedPort = first.port;

    // Stop first server, then manually bind a plain TCP server to that port
    await stopWorkspaceServer();

    const blocker = http.createServer();
    await new Promise<void>((resolve) => blocker.listen(occupiedPort, '127.0.0.1', resolve));

    try {
      // Start workspace server on the occupied port — it should auto-increment
      const second = await startWorkspaceServer({ cartaDir, port: occupiedPort });
      expect(second.port).toBeGreaterThan(occupiedPort);
      expect(second.port).toBe(occupiedPort + 1);
    } finally {
      blocker.close();
    }
  });
});

describe('path traversal prevention', () => {
  it('does not serve files outside clientDir via path traversal', async () => {
    const cartaDir = mkValidWorkspace();
    const clientDir = mkClientDir();

    // Write a sentinel file outside clientDir
    const outsideDir = mkTemp();
    writeFile(path.join(outsideDir, 'secret.txt'), 'top secret');

    const info = await startWorkspaceServer({ cartaDir, port: 0, clientDir });

    // Attempt path traversal to reach the outside file
    const traversalPath = encodeURIComponent('../' + path.relative(clientDir, path.join(outsideDir, 'secret.txt')));
    const { body } = await httpGet(`${info.url}/${traversalPath}`);

    // Should serve index.html fallback (SPA), not the secret file
    expect(body).not.toContain('top secret');
  });
});

describe('config injection content', () => {
  it('injects syncUrl matching the actual server URL', async () => {
    const cartaDir = mkValidWorkspace();
    const clientDir = mkClientDir();

    const info = await startWorkspaceServer({ cartaDir, port: 0, clientDir });

    const { body } = await httpGet(`${info.url}/`);

    // Extract the injected config
    const match = body.match(/window\.__CARTA_CONFIG__=(\{[^<]+\})/);
    expect(match).not.toBeNull();
    const injected = JSON.parse(match![1]) as { syncUrl: string };
    expect(injected.syncUrl).toBe(info.url);
  });

  it('serves without clientDir without touching static file logic', async () => {
    const cartaDir = mkValidWorkspace();

    // No clientDir — server only handles API routes
    const info = await startWorkspaceServer({ cartaDir, port: 0 });

    const { status, headers } = await httpGet(`${info.url}/health`);
    expect(status).toBe(200);
    expect(headers['content-type']).toContain('application/json');
  });
});
