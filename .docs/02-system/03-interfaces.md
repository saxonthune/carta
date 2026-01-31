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

## Compiler Output

JSON output structured for AI consumption:
- Deployable groupings
- Schema definitions with ports and semantic descriptions
- Construct instances grouped by deployable, then by type
- Bidirectional relationship metadata (references/referencedBy) using semantic IDs

## MCP Server

Carta exposes an MCP (Model Context Protocol) server for AI tool integration. Tools include document CRUD, construct CRUD, connection management, schema operations, and compilation.

## WebSocket Protocol

Server mode uses y-websocket for real-time collaboration. The Yjs CRDT handles conflict resolution automatically. Connection state is surfaced via the ConnectionStatus indicator.

## DocumentAdapter Interface

The internal contract between UI and storage. Methods for CRUD on all document entities (nodes, edges, schemas, deployables, levels, port schemas, schema groups). Subscribe for change notifications. Transaction support for atomic multi-operation changes.
