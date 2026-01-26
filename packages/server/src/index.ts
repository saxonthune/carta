/**
 * Carta Server - Main entry point
 *
 * Provides REST API and WebSocket endpoints for Carta document management.
 * This server proxies requests to the collab server's HTTP API.
 */

import express from 'express';
import { createServer } from 'node:http';
import { FileSystemAdapter } from './storage/index.js';
import { DocumentService } from './documents/index.js';
import { createWebSocketServer } from './websocket/index.js';
import { createToolHandlers } from './mcp/index.js';

const PORT = parseInt(process.env.PORT || '3001', 10);
const DATA_DIR = process.env.CARTA_DATA_DIR || './data';
const COLLAB_API_URL = process.env.CARTA_COLLAB_API_URL || 'http://localhost:1234';

async function main() {
  // Initialize storage and services (for WebSocket fallback)
  const storage = new FileSystemAdapter(DATA_DIR);
  const documentService = new DocumentService(storage);

  // Tool handlers now use HTTP API to collab server
  const toolHandlers = createToolHandlers({ collabApiUrl: COLLAB_API_URL });

  // Create Express app
  const app = express();
  app.use(express.json());

  // CORS for development
  app.use((_req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
  });

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', version: '0.1.0' });
  });

  // REST API endpoints that mirror MCP tools
  app.get('/api/documents', async (_req, res) => {
    try {
      const result = await toolHandlers.carta_list_documents({});
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/api/documents', async (req, res) => {
    try {
      const result = await toolHandlers.carta_create_document(req.body);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get('/api/documents/:id', async (req, res) => {
    try {
      const result = await toolHandlers.carta_get_document({ documentId: req.params.id });
      if ('error' in (result as object)) {
        res.status(404).json(result);
      } else {
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get('/api/documents/:id/constructs', async (req, res) => {
    try {
      const result = await toolHandlers.carta_list_constructs({ documentId: req.params.id });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/api/documents/:id/constructs', async (req, res) => {
    try {
      const result = await toolHandlers.carta_create_construct({
        documentId: req.params.id,
        ...req.body,
      });
      if ('error' in (result as object)) {
        res.status(400).json(result);
      } else {
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get('/api/documents/:id/constructs/:semanticId', async (req, res) => {
    try {
      const result = await toolHandlers.carta_get_construct({
        documentId: req.params.id,
        semanticId: req.params.semanticId,
      });
      if ('error' in (result as object)) {
        res.status(404).json(result);
      } else {
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.put('/api/documents/:id/constructs/:semanticId', async (req, res) => {
    try {
      const result = await toolHandlers.carta_update_construct({
        documentId: req.params.id,
        semanticId: req.params.semanticId,
        ...req.body,
      });
      if ('error' in (result as object)) {
        res.status(404).json(result);
      } else {
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete('/api/documents/:id/constructs/:semanticId', async (req, res) => {
    try {
      const result = await toolHandlers.carta_delete_construct({
        documentId: req.params.id,
        semanticId: req.params.semanticId,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/api/documents/:id/connections', async (req, res) => {
    try {
      const result = await toolHandlers.carta_connect_constructs({
        documentId: req.params.id,
        ...req.body,
      });
      if ('error' in (result as object)) {
        res.status(400).json(result);
      } else {
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete('/api/documents/:id/connections', async (req, res) => {
    try {
      const result = await toolHandlers.carta_disconnect_constructs({
        documentId: req.params.id,
        ...req.body,
      });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get('/api/documents/:id/schemas', async (req, res) => {
    try {
      const result = await toolHandlers.carta_list_schemas({ documentId: req.params.id });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/api/documents/:id/schemas', async (req, res) => {
    try {
      const result = await toolHandlers.carta_create_schema({
        documentId: req.params.id,
        ...req.body,
      });
      if ('error' in (result as object)) {
        res.status(400).json(result);
      } else {
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get('/api/documents/:id/deployables', async (req, res) => {
    try {
      const result = await toolHandlers.carta_list_deployables({ documentId: req.params.id });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post('/api/documents/:id/deployables', async (req, res) => {
    try {
      const result = await toolHandlers.carta_create_deployable({
        documentId: req.params.id,
        ...req.body,
      });
      if ('error' in (result as object)) {
        res.status(400).json(result);
      } else {
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get('/api/documents/:id/compile', async (req, res) => {
    try {
      const result = await toolHandlers.carta_compile({ documentId: req.params.id });
      if ('error' in (result as object)) {
        res.status(404).json(result);
      } else {
        res.json(result);
      }
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get('/api/documents/:id/port-types', async (req, res) => {
    try {
      const result = await toolHandlers.carta_list_port_types({ documentId: req.params.id });
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  // Attach WebSocket server
  createWebSocketServer(httpServer, documentService);

  // Start server
  httpServer.listen(PORT, () => {
    console.log(`Carta server running on http://localhost:${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
    console.log(`Data directory: ${DATA_DIR}`);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
