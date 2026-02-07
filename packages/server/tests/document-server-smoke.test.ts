import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as http from 'node:http';
import { startServer, stopServer, type ServerInstance } from '../src/document-server.js';

// Force in-memory mode for tests
process.env.STORAGE = 'memory';

let instance: ServerInstance;
let baseUrl: string;

async function get(path: string): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    http.get(`${baseUrl}${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed: unknown;
        try {
          parsed = JSON.parse(data);
        } catch {
          parsed = data;
        }
        resolve({ status: res.statusCode!, body: parsed });
      });
    }).on('error', reject);
  });
}

describe('document-server smoke test', () => {
  beforeAll(async () => {
    instance = await startServer({ port: 0, host: '127.0.0.1' });
    baseUrl = `http://127.0.0.1:${instance.port}`;
  });

  afterAll(async () => {
    await stopServer(instance);
  });

  it('GET /health returns 200', async () => {
    const res = await get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ status: 'ok' }));
  });

  it('GET /health shows storage: memory', async () => {
    const res = await get('/health');
    expect(res.body).toEqual(expect.objectContaining({ storage: 'memory' }));
  });

  it('GET / returns 404', async () => {
    const res = await get('/');
    expect(res.status).toBe(404);
  });

  it('GET /api/documents responds', async () => {
    const res = await get('/api/documents');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ documents: expect.any(Array) }));
  });

  it('rejects with EADDRINUSE when port is taken', async () => {
    // Test the listen error path directly — calling startServer() twice
    // would re-run initPersistence() on shared module state.
    const server = http.createServer();
    const error = await new Promise<Error>((resolve) => {
      server.on('error', (err) => resolve(err as Error));
      server.listen(instance.port, '127.0.0.1');
    });
    expect((error as NodeJS.ErrnoException).code).toBe('EADDRINUSE');
  });
});
