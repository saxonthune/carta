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

Carta exposes an MCP (Model Context Protocol) server for AI tool integration. The MCP API is the primary interface for programmatic document manipulation.

### Tool Categories

**Document management:**
- `carta_list_documents` — List all documents with metadata
- `carta_get_document` — Get document by ID
- `carta_create_document` — Create new document
- `carta_delete_document` — Delete document
- `carta_rename_document` — Rename document
- `carta_get_document_summary` — Get compact summary (level/construct/edge counts) for orientation
- `carta_list_active_documents` — List documents with active browser connections (Yjs collaboration mode)

**Level operations:**
- `carta_list_levels` — List all levels (returns levels array + activeLevel ID)
- `carta_create_level` — Create new level
- `carta_rename_level` — Update level name, description, or order
- `carta_delete_level` — Delete level (document must have >1 level)
- `carta_set_active_level` — Switch active level (construct/connection operations target active level)

**Schema operations:**
- `carta_list_schemas` — List all schemas (built-in + custom). Use `output="compact"` for token efficiency
- `carta_get_schema` — Get schema by type
- `carta_create_schema` — Create custom construct schema (smart defaults: primary fields auto-get displayTier='minimal', default ports added if none specified)
- `carta_delete_schema` — Delete custom schema

**Construct operations:**
- `carta_list_constructs` — List constructs (compact summaries). Optionally filter by `constructType` or target specific level via `levelId`
- `carta_get_construct` — Get construct by semantic ID (full details)
- `carta_create_construct` — Create construct instance. When `parentId` set, position is relative to organizer
- `carta_update_construct` — Update construct values or instance color
- `carta_delete_construct` — Delete construct
- `carta_create_constructs` — Bulk create (all-or-nothing transaction). Nodes without x/y auto-placed in grid
- `carta_delete_constructs` — Bulk delete (best-effort, per-item results)
- `carta_move_construct` — Move construct into/out of organizer (position auto-converted, connections preserved)

**Connection operations:**
- `carta_connect_constructs` — Connect two constructs via ports
- `carta_disconnect_constructs` — Disconnect two constructs
- `carta_connect_constructs_bulk` — Bulk connect (best-effort, individual failures reported)
- `carta_list_port_types` — List port types and compatibility rules

**Organizer operations:**
- `carta_create_organizer` — Create organizer for visual grouping. Supports layout strategies (freeform/stack/grid) and wagon attachment
- `carta_update_organizer` — Update organizer (name, color, collapsed state, layout, description)
- `carta_delete_organizer` — Delete organizer. Default: detach members. Set `deleteMembers=true` to delete contents

**Batch operations:**
- `carta_batch_mutate` — Execute heterogeneous operations in single transaction (create, update, delete, connect, disconnect, move). Supports "@N" placeholder syntax for referencing results of earlier operations in same batch

**Compilation:**
- `carta_compile` — Compile document to AI-readable output

### Operation Scoping

All construct and connection operations target the **active level**, which can be switched via `carta_set_active_level`. Organizers are per-level (doc02.09). When creating constructs with `parentId`, position is relative to the organizer bounds.

In desktop mode, the local MCP server auto-discovers via `{userData}/server.json` (contains URL and PID). This enables zero-config MCP when Carta Desktop is running. The MCP server reads the locally-synced Y.Doc, providing fast access regardless of whether the document source is local or remote. The same MCP binary can also connect to remote servers via the `CARTA_SERVER_URL` environment variable.

## Guides API

Carta provides static markdown resources for AI agents, exported from `@carta/domain`:

| Guide | Constant | URI | Purpose |
|-------|----------|-----|---------|
| Metamodel | `METAMODEL_GUIDE` | `carta://guide/metamodel` | Learn Carta's three-level metamodel (M2/M1/M0), how to read documents, connection semantics, and traversal patterns |
| Analysis | `ANALYSIS_GUIDE` | `carta://guide/analysis` | Learn how to analyze Carta documents for structural issues, completeness gaps, and code generation readiness |

These guides are consumed by MCP tools to provide context to AI agents when working with Carta documents. They are versioned with the domain package and stay synchronized with the metamodel.

## WebSocket Protocol

Server mode uses y-websocket for real-time collaboration. The Yjs CRDT handles conflict resolution automatically. Connection state is surfaced via the ConnectionStatus indicator.

## DocumentAdapter Interface

The internal contract between UI and storage. Methods for CRUD on all document entities (nodes, edges, schemas, deployables, levels, port schemas, schema groups). Subscribe for change notifications. Transaction support for atomic multi-operation changes.
