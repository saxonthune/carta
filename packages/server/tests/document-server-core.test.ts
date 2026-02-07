import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import * as http from 'node:http';
import * as Y from 'yjs';
import {
  createDocumentServer,
  type DocState,
  type DocumentServerConfig,
} from '../src/document-server-core.js';

// ===== Test helpers =====

const docs = new Map<string, DocState>();

function makeConfig(overrides?: Partial<DocumentServerConfig>): DocumentServerConfig {
  return {
    getDoc: async (docId: string) => {
      let docState = docs.get(docId);
      if (!docState) {
        docState = { doc: new Y.Doc(), conns: new Set() };
        docs.set(docId, docState);
      }
      return docState;
    },
    listDocuments: async () => [],
    deleteDocument: async (docId: string) => {
      docs.delete(docId);
      return true;
    },
    logPrefix: '[Test]',
    healthMeta: { storage: 'memory', rooms: 0 },
    ...overrides,
  };
}

/** Create an ephemeral HTTP server wrapping the handler, make a request, return the response. */
async function request(
  handler: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: unknown }> {
  const server = http.createServer((req, res) => {
    handler(req, res).catch(() => {
      res.writeHead(500);
      res.end();
    });
  });

  const port = await new Promise<number>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve((server.address() as { port: number }).port);
    });
  });

  try {
    return await new Promise((resolve, reject) => {
      const reqOpts: http.RequestOptions = {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
      };

      const req = http.request(reqOpts, (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed: unknown;
          try {
            parsed = JSON.parse(data);
          } catch {
            parsed = data;
          }
          resolve({ status: res.statusCode!, headers: res.headers, body: parsed });
        });
      });

      req.on('error', reject);
      if (body) req.write(JSON.stringify(body));
      req.end();
    });
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

// ===== Tests =====

describe('document-server-core HTTP handler', () => {
  let handleHttpRequest: (req: http.IncomingMessage, res: http.ServerResponse) => Promise<void>;

  beforeAll(() => {
    const config = makeConfig();
    const handlers = createDocumentServer(config);
    handleHttpRequest = handlers.handleHttpRequest;
  });

  afterEach(() => {
    docs.clear();
  });

  it('GET /health returns 200 with status ok', async () => {
    const res = await request(handleHttpRequest, 'GET', '/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ status: 'ok' }));
  });

  it('GET /health includes healthMeta fields', async () => {
    const res = await request(handleHttpRequest, 'GET', '/health');
    expect(res.body).toEqual(expect.objectContaining({
      storage: 'memory',
      rooms: 0,
    }));
  });

  it('HEAD /health returns 200 (used by wait-on)', async () => {
    const res = await request(handleHttpRequest, 'HEAD', '/health');
    expect(res.status).toBe(200);
  });

  it('GET / returns 404', async () => {
    const res = await request(handleHttpRequest, 'GET', '/');
    expect(res.status).toBe(404);
  });

  it('GET /nonexistent returns 404', async () => {
    const res = await request(handleHttpRequest, 'GET', '/nonexistent');
    expect(res.status).toBe(404);
  });

  it('OPTIONS returns 204 with CORS headers', async () => {
    const res = await request(handleHttpRequest, 'OPTIONS', '/health');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('*');
    expect(res.headers['access-control-allow-methods']).toContain('GET');
  });

  it('GET /api/documents returns empty list', async () => {
    const res = await request(handleHttpRequest, 'GET', '/api/documents');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ documents: [] });
  });

  it('POST /api/documents creates a document', async () => {
    const res = await request(handleHttpRequest, 'POST', '/api/documents', {
      title: 'Test Project',
    });
    expect(res.status).toBe(201);
    const body = res.body as { document: { title: string; id: string } };
    expect(body.document.title).toBe('Test Project');
    expect(body.document.id).toBeTruthy();
  });
});
