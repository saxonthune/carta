---
title: Interfaces
status: active
---

# Interfaces

## File Format (.carta)

Version 5 JSON format containing:
- Title and description
- Levels (each with nodes, edges, deployables)
- Custom schemas, port schemas, schema groups
- Backwards compatible with v4 and earlier

Import validates structure and shows a preview modal with conflict detection (existing items with same ID). Export offers selective export by category.

## Document REST API

The server exposes REST endpoints for document management:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/documents` | GET | List all documents with summary metadata |
| `/api/documents` | POST | Create a new document |
| `/api/documents/:id` | GET | Get document details |
| `/api/documents/:id` | DELETE | Delete a document |

Document summary includes:
- `id`: Document ID (used in WebSocket room name)
- `title`: Document title
- `folder`: Virtual folder path (e.g., `/projects/webapp`)
- `updatedAt`: Last modification timestamp
- `nodeCount`: Number of constructs
- `version`: Document format version

## Compiler Output

JSON output structured for AI consumption:
- Deployable groupings
- Schema definitions with ports and semantic descriptions
- Construct instances grouped by deployable, then by type
- Bidirectional relationship metadata (references/referencedBy) using semantic IDs

## MCP Server

Carta exposes an MCP (Model Context Protocol) server for AI tool integration. Tools include document CRUD, construct CRUD, connection management, schema operations, and compilation.

In desktop mode, the local MCP server auto-discovers via `{userData}/server.json` (contains URL and PID). This enables zero-config MCP when Carta Desktop is running. The MCP server reads the locally-synced Y.Doc, providing fast access regardless of whether the document source is local or remote. The same MCP binary can also connect to remote servers via the `CARTA_SERVER_URL` environment variable.

## WebSocket Protocol

Server mode uses y-websocket for real-time collaboration. The Yjs CRDT handles conflict resolution automatically. Connection state is surfaced via the ConnectionStatus indicator.

## DocumentAdapter Interface

The internal contract between UI and storage. Methods for CRUD on all document entities (nodes, edges, schemas, deployables, levels, port schemas, schema groups). Subscribe for change notifications. Transaction support for atomic multi-operation changes.
