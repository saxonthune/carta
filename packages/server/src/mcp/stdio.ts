#!/usr/bin/env node
/**
 * Carta MCP Server - stdio transport
 *
 * This server exposes Carta functionality via the Model Context Protocol,
 * allowing AI agents to read, analyze, and modify Carta documents.
 *
 * All operations communicate with the document server via HTTP REST API.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import createDebug from 'debug';
import { getToolDefinitions, createToolHandlers } from './tools.js';
import { getResourceDefinitions, getResourceContent } from './resources.js';

const log = createDebug('carta:mcp');

/**
 * Discover the Carta Desktop embedded server URL from server.json.
 * Checks platform-specific Electron userData paths.
 */
function discoverDesktopServer(): string | null {
  const platform = os.platform();
  let userDataPath: string;

  if (platform === 'darwin') {
    userDataPath = path.join(os.homedir(), 'Library', 'Application Support', '@carta', 'desktop');
  } else if (platform === 'win32') {
    userDataPath = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), '@carta', 'desktop');
  } else {
    userDataPath = path.join(os.homedir(), '.config', '@carta', 'desktop');
  }

  const serverJsonPath = path.join(userDataPath, 'server.json');
  if (!fs.existsSync(serverJsonPath)) return null;

  try {
    const data = JSON.parse(fs.readFileSync(serverJsonPath, 'utf-8'));
    if (data.url && data.pid) {
      // Verify the process is still running
      try {
        process.kill(data.pid, 0);
        return data.url;
      } catch {
        // Process not running, stale server.json
        return null;
      }
    }
  } catch {
    return null;
  }
  return null;
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
    discoverDesktopServer() ||
    'http://localhost:1234';

  log('Carta MCP server using HTTP API (%s)', serverUrl);

  // Create tool handlers that use HTTP API
  const toolHandlers = createToolHandlers({ serverUrl });

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
      inputSchema: {
        type: 'object' as const,
        properties: tool.inputSchema,
        required: Object.keys(tool.inputSchema).filter(
          (key) => !(tool.inputSchema as Record<string, { optional?: boolean }>)[key]?.optional
        ),
      },
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
