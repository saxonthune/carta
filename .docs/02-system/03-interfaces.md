---
title: Interfaces
status: active
---

# Interfaces

## File Format (.carta)

Version 7 JSON format containing:
- Title and description
- Pages (each with nodes, edges, deployables)
- Custom schemas, port schemas, schema groups
- Resources (versioned data contracts — added in v7)
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
| `/api/documents/:id/layout/flow` | POST | Apply topological flow layout to active page |
| `/api/documents/:id/layout/arrange` | POST | Apply constraint-based layout to active page |
| `/api/documents/:id/layout/pin` | POST | Manage pin constraints for relative organizer positioning |

Document summary includes:
- `id`: Document ID (used in WebSocket room name)
- `title`: Document title
- `folder`: Virtual folder path (e.g., `/projects/webapp`)
- `updatedAt`: Last modification timestamp
- `nodeCount`: Number of constructs
- `version`: Document format version

## Workspace REST API

When the server is configured with a workspace path (`.carta/` directory), additional endpoints are available:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/workspace` | GET | Workspace tree: manifest, groups, files |
| `/api/workspace/schemas` | GET | Parsed schemas.json content |
| `/api/workspace/files/:path` | GET | Read text file content; returns `{ content: string, path: string }` |

These endpoints are read-only. File mutations happen through Y.Doc operations (canvas editing, text file rooms) or direct filesystem access (resources).

## Compiler Output

The compiler transforms a single canvas into a context-window-friendly JSON representation — stripping coordinates and visual-only data while preserving semantic structure. Output sections:

- **Organizer groupings**: Visual groupings with member lists (for AI spatial context)
- **Schema definitions**: Construct schemas referenced by this canvas, with ports and semantic descriptions
- **Constructs by type**: Construct instances grouped by schema type
- **Relationship metadata**: Bidirectional reference maps (references/referencedBy) using semantic IDs
- **Resources section**: Resource bodies (verbatim, format-agnostic) with a `referencedBy` graph showing which constructs reference each resource and via which field/pathHint. Emitted only when resources exist

## MCP Server

Carta exposes an MCP (Model Context Protocol) server for AI tool integration. The MCP API is the primary interface for programmatic canvas manipulation.

### Tool Architecture: Multiplexed Intent

MCP tools are organized as **multiplexed intent tools** — each tool covers a domain category and dispatches via an `op` discriminated union. This reduces tool count while preserving full capability. Every tool call requires an `op` field selecting the operation (except `carta_compile` which takes only `canvasId`).

All tools use `canvasId` (not `documentId`). Workspace canvases are single-page — there is no page management.

```
carta_canvas     { op: list | get | summary | create | create_bulk | update | delete | delete_bulk | move |
                       connect | disconnect | connect_bulk |
                       create_organizer | update_organizer | delete_organizer | batch }
carta_schema     { op: list | get | create | update | delete |
                       rename_field | remove_field | add_field | rename_port | remove_port | add_port |
                       rename_type | change_field_type | narrow_enum | change_port_type |
                       list_packages | get_package | create_package | list_standard_packages | apply_package | check_drift |
                       list_port_types }
carta_layout     { op: flow | arrange | pin | list_pins | remove_pin | apply_pins }
carta_compile    (takes canvasId)
carta_workspace  { op: status }
```

### Tool Reference

**`carta_canvas`** — Canvas read and mutation operations. Merges construct, connection, organizer, and batch into one tool.
- `op: list` — List all canvases in the workspace (no canvasId required)
- `op: get` — Get full canvas contents (all constructs, connections, schemas)
- `op: summary` — Compact canvas summary (counts). Accepts optional `include: ["constructs","schemas"]` for embedded data
- `op: create` — Create construct instance. `parentId` makes position relative to organizer
- `op: create_bulk` — Bulk create (all-or-nothing transaction). Nodes without x/y auto-placed
- `op: update` — Update field values or `instanceColor`
- `op: delete` — Delete construct by semantic ID
- `op: delete_bulk` — Bulk delete (cleans up edges and wagons)
- `op: move` — Move construct into/out of organizer (`parentId=null` to detach; connections preserved)
- `op: connect` — Connect two constructs via ports
- `op: disconnect` — Remove connection between constructs
- `op: connect_bulk` — Bulk connect (best-effort; individual failures reported)
- `op: create_organizer` — Create organizer for visual grouping. `attachedToSemanticId` creates a wagon
- `op: update_organizer` — Update name, color, collapsed state, layout, description
- `op: delete_organizer` — Delete organizer. Default: detach members. `deleteMembers=true` also deletes contents
- `op: batch` — Execute heterogeneous operations in a single transaction. Supports `@N` placeholder syntax for referencing results of earlier operations

**`carta_schema`** — Schema CRUD, structural migrations, package management, and port type queries. All ops take `canvasId`.
- `op: list` — List all schemas (built-in + custom). Use `output="compact"` for token efficiency. Filter by `groupId`
- `op: get` — Get schema by type
- `op: create` — Create custom schema (smart defaults: primary fields auto-get displayTier, default ports added if none specified)
- `op: update` — Update non-breaking properties (color, displayName, nodeShape, fieldUpdates map, etc)
- `op: delete` — Delete custom schema by type
- `op: rename_field` — Rename a field and migrate all instance data
- `op: remove_field` — Remove a field and clean up instance data
- `op: add_field` — Add field to schema; optionally populate existing instances with defaultValue
- `op: rename_port` — Rename a port and update all connections
- `op: remove_port` — Remove a port and disconnect edges
- `op: add_port` — Add a port (no instance fixup needed)
- `op: rename_type` — Rename schema type and update all instance references
- `op: change_field_type` — Change field data type; dry-run by default, set `force=true` to execute
- `op: narrow_enum` — Update enum field options with optional value remapping
- `op: change_port_type` — Change port type reference, disconnecting incompatible edges
- `op: list_packages` — List packages with member counts
- `op: get_package` — Get package with schemas/ports/groups/relationships
- `op: create_package` — Create new package (schemas assigned via `packageId` on schema create/update)
- `op: list_standard_packages` — List standard library packages with status (available/loaded/modified)
- `op: apply_package` — Load a standard library package by ID (idempotent)
- `op: check_drift` — Compare loaded package against its snapshot to detect modifications
- `op: list_port_types` — List available port types and compatibility rules

**`carta_layout`** — Layout and pin constraint operations. All ops take `canvasId`.
- `op: flow` — Arrange nodes in topological order along TB/BT/LR/RL direction (Sugiyama framework). Accepts sourcePort, sinkPort, layerGap, nodeGap, scope
- `op: arrange` — Declarative constraint-based layout. Strategies: `grid`, `preserve`, `force`. Constraint types: align, order, spacing, group, distribute, position, flow
- `op: pin` — Declare relative positioning between organizers (directions: N/NE/E/SE/S/SW/W/NW)
- `op: list_pins` — List all pin constraints for the canvas
- `op: remove_pin` — Remove a pin constraint by constraintId
- `op: apply_pins` — Resolve and apply all pin constraints; returns updated count + warnings

**`carta_compile`** — Compile a canvas to AI-readable output (takes `canvasId`)

**`carta_workspace`** — Workspace-level operations.
- `op: status` — Return workspace tree: groups, canvases, files, schemas metadata

### Operation Scoping

All construct and connection operations target the canvas's single page. Workspace canvases are single-page files — there is no page switching. When creating constructs with `parentId`, position is relative to the organizer bounds.

In desktop mode, the local MCP server auto-discovers via `{userData}/server.json` (contains URL and PID). This enables zero-config MCP when Carta Desktop is running. The MCP server reads the locally-synced Y.Doc, providing fast access regardless of whether the canvas source is local or remote. The same MCP binary can also connect to remote servers via the `CARTA_SERVER_URL` environment variable.

## Guides API

Carta provides static markdown resources for AI agents, exposed as MCP resources from `@carta/schema`. All guides use `mimeType: text/markdown`.

| Guide | Constant | URI | Purpose |
|-------|----------|-----|---------|
| Metamodel | `METAMODEL_GUIDE` | `carta://guide/metamodel` | Carta's three-level metamodel (M2/M1/M0), how to read documents, connection semantics, and traversal patterns |
| Analysis | `ANALYSIS_GUIDE` | `carta://guide/analysis` | How to analyze Carta documents for structural issues, completeness gaps, and code generation readiness |
| Domain Directory | `DOMAIN_DIRECTORY_GUIDE` | `carta://guide/domains` | Index of domain-specific modeling guides with schema recommendations |
| Software Architecture | `SOFTWARE_ARCHITECTURE_GUIDE` | `carta://guide/domains/software-architecture` | Schema recommendations for REST APIs, services, databases, and UI components |
| AWS Cloud | `AWS_GUIDE` | `carta://guide/domains/aws` | Schema recommendations for Lambda, API Gateway, DynamoDB, S3, and serverless patterns |
| BPMN Process | `BPMN_GUIDE` | `carta://guide/domains/bpmn` | Schema recommendations for business processes, workflows, events, and gateways |

Guides are consumed by MCP clients to provide context to AI agents when working with Carta documents. They are versioned with the `@carta/schema` package and stay synchronized with the metamodel. The `GUIDES` constant (exported from `@carta/schema`) is a typed map from guide key to `{ uri, name, description, mimeType }`.

## WebSocket Protocol

Server mode uses y-websocket for real-time collaboration. The Yjs CRDT handles conflict resolution automatically. Connection state is surfaced via the ConnectionStatus indicator.

## DocumentAdapter Interface

The internal contract between UI and storage. Methods for CRUD on all document entities (nodes, edges, schemas, deployables, pages, port schemas, schema groups). Subscribe for change notifications. Transaction support for atomic multi-operation changes.
