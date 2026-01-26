#!/usr/bin/env node
/**
 * Carta MCP Server - stdio transport
 *
 * This server exposes Carta functionality via the Model Context Protocol,
 * allowing AI agents to read, analyze, and modify Carta documents.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { FileSystemAdapter, YjsStorageAdapter } from '../storage/index.js';
import type { StorageAdapter } from '../storage/index.js';
import { DocumentService } from '../documents/index.js';
import { getToolDefinitions, createToolHandlers } from './tools.js';
import { getResourceDefinitions, getResourceContent } from './resources.js';

/**
 * Start MCP server with stdio transport
 * This is for CLI/Claude Desktop integration
 */
async function main() {
  // Determine storage mode from environment
  const storageMode = process.env.CARTA_STORAGE_MODE || 'file';
  const collabUrl = process.env.CARTA_COLLAB_URL || 'ws://localhost:1234';
  const collabApiUrl = process.env.CARTA_COLLAB_API_URL || 'http://localhost:1234';
  const dataDir = process.env.CARTA_DATA_DIR || './data';

  // Initialize storage adapter based on mode
  let storage: StorageAdapter;
  if (storageMode === 'yjs') {
    console.error(`Carta MCP server using Yjs storage (${collabUrl})`);
    storage = new YjsStorageAdapter(collabUrl, collabApiUrl);
  } else {
    console.error(`Carta MCP server using file storage (${dataDir})`);
    storage = new FileSystemAdapter(dataDir);
  }

  const documentService = new DocumentService(storage);
  const toolHandlers = createToolHandlers(documentService, { collabApiUrl });

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

  console.error('Carta MCP server running on stdio');
  console.error('Available resources:');
  getResourceDefinitions().forEach((r) => {
    console.error(`  - ${r.uri}: ${r.name}`);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
