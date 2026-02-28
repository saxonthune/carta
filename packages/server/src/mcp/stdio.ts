#!/usr/bin/env node
/**
 * Carta MCP Server - stdio transport
 *
 * This server exposes Carta functionality via the Model Context Protocol,
 * allowing AI agents to read, analyze, and modify Carta documents.
 *
 * Document access uses the Yjs binary state endpoint for in-process-equivalent
 * tool execution, eliminating per-operation HTTP round-trips.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import * as Y from 'yjs';
import createDebug from 'debug';
import { readServerDiscovery, getDefaultDiscoveryPath } from '../server-discovery.js';
import { getToolDefinitions, createToolHandlers } from './tools.js';
import type { ToolHandlerConfig, DocStateWithFlush } from './tools.js';
import { getResourceDefinitions, getResourceContent } from './resources.js';

const log = createDebug('carta:mcp');

/**
 * Make an HTTP request to the document server.
 */
async function httpRequest<T>(
  serverUrl: string,
  method: string,
  urlPath: string,
  body?: unknown
): Promise<{ data?: T; error?: string }> {
  try {
    const response = await fetch(`${serverUrl}${urlPath}`, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = (await response.json()) as T & { error?: string };
    if (!response.ok) {
      return { error: data.error || `HTTP ${response.status}: ${response.statusText}` };
    }
    return { data };
  } catch (error) {
    return {
      error: `Failed to connect to document server at ${serverUrl}. Is it running? Start it with: pnpm document-server`,
    };
  }
}

/**
 * Build a ToolHandlerConfig backed by HTTP calls to a remote workspace server.
 *
 * Per-canvas tool calls (getDoc) fetch the binary Yjs state, reconstruct
 * a local Y.Doc, run tool execution in-process, then flush accumulated updates
 * back to the server via the yjs-update endpoint.
 *
 * Workspace-level calls (listCanvases, getWorkspaceTree) use the REST API directly.
 */
function buildRemoteConfig(serverUrl: string): ToolHandlerConfig {
  async function getDoc(canvasId: string): Promise<DocStateWithFlush> {
    const result = await httpRequest<{ state: string }>(serverUrl, 'GET', `/api/documents/${encodeURIComponent(canvasId)}/yjs-state`);
    if (result.error || !result.data) {
      throw new Error(result.error ?? 'Failed to fetch Y.Doc state');
    }

    const doc = new Y.Doc();
    const stateBytes = new Uint8Array(Buffer.from(result.data.state, 'base64'));
    Y.applyUpdate(doc, stateBytes);

    // Track accumulated updates for flush
    const pendingUpdates: Uint8Array[] = [];
    doc.on('update', (update: Uint8Array) => {
      pendingUpdates.push(update);
    });

    const flush = async (): Promise<void> => {
      if (pendingUpdates.length === 0) return;
      const merged = Y.mergeUpdates(pendingUpdates);
      pendingUpdates.length = 0;
      const update = Buffer.from(merged).toString('base64');
      await httpRequest(serverUrl, 'POST', `/api/documents/${encodeURIComponent(canvasId)}/yjs-update`, { update });
    };

    return { doc, conns: new Set(), flush };
  }

  async function listCanvases() {
    const result = await httpRequest<{ documents: unknown[] }>(serverUrl, 'GET', '/api/documents');
    return (result.data?.documents ?? []) as import('../document-server-core.js').DocumentSummary[];
  }

  async function getWorkspaceTree(): Promise<unknown> {
    const result = await httpRequest<unknown>(serverUrl, 'GET', '/api/workspace');
    return result.data ?? { error: result.error ?? 'Failed to fetch workspace tree' };
  }

  return { getDoc, listCanvases, getWorkspaceTree };
}

/**
 * Start MCP server with stdio transport
 * This is for CLI/Claude Desktop integration
 */
async function main() {
  // Get document server URL: env var > legacy env var > desktop discovery > default
  const serverUrl =
    process.env.CARTA_SERVER_URL ||
    (() => {
      if (process.env.CARTA_COLLAB_API_URL) {
        log('CARTA_COLLAB_API_URL is deprecated, use CARTA_SERVER_URL instead');
        return process.env.CARTA_COLLAB_API_URL;
      }
      return null;
    })() ||
    readServerDiscovery(getDefaultDiscoveryPath())?.url ||
    'http://localhost:1234';

  log('Carta MCP server using HTTP API (%s)', serverUrl);

  // Create tool handlers backed by the remote document server
  const toolHandlers = createToolHandlers(buildRemoteConfig(serverUrl));

  // Create MCP server with tools AND resources capabilities
  const server = new Server(
    {
      name: 'carta-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    const tools = getToolDefinitions().map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
      annotations: tool.annotations,
    }));
    return { tools };
  });

  // Handle call tool request
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const handler = toolHandlers[name];

    if (!handler) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({ error: `Unknown tool: ${name}` }),
          },
        ],
      };
    }

    try {
      const result = await handler(args || {});
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              error: error instanceof Error ? error.message : 'Unknown error',
            }),
          },
        ],
        isError: true,
      };
    }
  });

  // Handle list resources request
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const resources = getResourceDefinitions();
    return { resources };
  });

  // Handle read resource request
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    const resource = getResourceContent(uri);

    if (!resource) {
      throw new Error(`Resource not found: ${uri}`);
    }

    return {
      contents: [
        {
          uri,
          mimeType: resource.mimeType,
          text: resource.content,
        },
      ],
    };
  });

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('Carta MCP server running on stdio');
  log('Available resources:');
  getResourceDefinitions().forEach((r) => {
    log('  - %s: %s', r.uri, r.name);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
