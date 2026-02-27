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

Carta exposes an MCP (Model Context Protocol) server for AI tool integration. The MCP API is the primary interface for programmatic document manipulation.

### Tool Architecture: Multiplexed Intent

MCP tools are organized as **multiplexed intent tools** — each tool covers a domain category and dispatches via an `op` discriminated union. This reduces tool count while preserving full capability. Every tool call requires an `op` field selecting the operation.

```
carta_document { op: list | list_active | get | create | delete | rename }
carta_page     { op: list | create | update | delete | set_active | summary }
carta_schema   { op: list | get | create | update | delete }
carta_schema_migrate { op: rename_field | remove_field | add_field | rename_port | remove_port | add_port | rename_type | change_field_type | narrow_enum | change_port_type }
carta_construct { op: list | get | create | create_bulk | update | delete | delete_bulk | move }
carta_connection { op: connect | disconnect | connect_bulk }
carta_organizer { op: create | update | delete }
carta_layout   { op: flow | arrange | pin | list_pins | remove_pin | apply_pins }
carta_package  { op: list | get | create | list_standard | apply | check_drift }
carta_resource { op: list | get | create | update | delete | publish | history | diff }
carta_compile
carta_batch_mutate
carta_list_port_types
carta_rebuild_page
```

### Tool Reference

**`carta_document`** — Document management
- `op: list` — List all documents with metadata
- `op: list_active` — List documents with active browser connections (Yjs collaboration mode)
- `op: get` — Get document by ID
- `op: create` — Create new document with title
- `op: delete` — Delete document by ID
- `op: rename` — Change document title

**`carta_page`** — Page operations
- `op: list` — List all pages (returns pages array + activePage ID)
- `op: create` — Create new page with name and optional description
- `op: update` — Update page name, description, or sort order
- `op: delete` — Delete page (document must have >1 page)
- `op: set_active` — Switch active page; returns constructs, organizers, edgeCount, and schemas for orientation. Accepts `pageId` or `pageName` (case-insensitive)
- `op: summary` — Get compact document summary (page/construct/edge counts). Accepts optional `include: ["constructs","schemas"]` for embedded data, and `pageName` as alternative to `pageId`

**`carta_schema`** — Schema operations
- `op: list` — List all schemas (built-in + custom). Use `output="compact"` for token efficiency. Filter by `groupId`
- `op: get` — Get schema by type
- `op: create` — Create custom schema (smart defaults: primary fields auto-get displayTier, default ports added if none specified)
- `op: update` — Update non-breaking properties (color, displayName, nodeShape, fieldUpdates map, etc). Cannot change type, fields array, or ports array
- `op: delete` — Delete custom schema by type

**`carta_schema_migrate`** — Structural schema changes with instance fixup
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

**`carta_construct`** — Construct (node) operations
- `op: list` — List constructs (compact summaries by default). Filter by `constructType` or `pageId`. Use `output="full"` for values/position/connections
- `op: get` — Get construct by semantic ID. `output="compact"` is lightweight
- `op: create` — Create construct instance. `parentId` makes position relative to organizer
- `op: create_bulk` — Bulk create (all-or-nothing transaction). Nodes without x/y auto-placed in grid
- `op: update` — Update field values or `instanceColor`
- `op: delete` — Delete construct by semantic ID
- `op: delete_bulk` — Bulk delete (cleans up edges and wagons)
- `op: move` — Move construct into/out of organizer (`parentId=null` to detach; connections preserved)

**`carta_connection`** — Connection operations
- `op: connect` — Connect two constructs via ports. Accepts `pageId`
- `op: disconnect` — Remove connection between constructs
- `op: connect_bulk` — Bulk connect (best-effort; individual failures reported)

**`carta_organizer`** — Organizer operations
- `op: create` — Create organizer for visual grouping. `attachedToSemanticId` creates a wagon
- `op: update` — Update name, color, collapsed state, layout, description
- `op: delete` — Delete organizer. Default: detach members. `deleteMembers=true` also deletes contents

**`carta_layout`** — Layout and pin constraint operations
- `op: flow` — Arrange nodes in topological order along TB/BT/LR/RL direction (Sugiyama framework). Accepts sourcePort, sinkPort, layerGap, nodeGap, scope
- `op: arrange` — Declarative constraint-based layout. Strategies: `grid`, `preserve`, `force`. Constraint types: align, order, spacing, group, distribute, position, flow
- `op: pin` — Declare relative positioning between organizers (directions: N/NE/E/SE/S/SW/W/NW)
- `op: list_pins` — List all pin constraints for a page
- `op: remove_pin` — Remove a pin constraint by constraintId
- `op: apply_pins` — Resolve and apply all pin constraints; returns updated count + warnings

**`carta_package`** — Schema package operations
- `op: list` — List packages with member counts
- `op: get` — Get package with schemas/ports/groups/relationships
- `op: create` — Create new package (schemas assigned via `packageId` on schema create/update)
- `op: list_standard` — List standard library packages with status (available/loaded/modified)
- `op: apply` — Load a standard library package by ID (idempotent)
- `op: check_drift` — Compare loaded package against its snapshot to detect modifications

**`carta_resource`** — Resource operations (versioned data contracts: API specs, TypeScript types, schemas)
- `op: list` — List all resources (id, name, format, currentHash, version count)
- `op: get` — Get resource by id (includes current body)
- `op: create` — Create resource with name, format, body
- `op: update` — Edit the working copy body (no version created)
- `op: delete` — Delete resource (fields referencing it become orphaned)
- `op: publish` — Create a published version snapshot from the current working copy
- `op: history` — Return the version timeline for a resource
- `op: diff` — Compare two versions, or working copy against a published version

**`carta_compile`** — Compile document to AI-readable output (takes `documentId`)

**`carta_batch_mutate`** — Execute heterogeneous operations in a single transaction (create, update, delete, connect, disconnect, move). Supports `@N` placeholder syntax for referencing results of earlier operations in the same batch. Accepts optional `pageId`

**`carta_list_port_types`** — List available port types and compatibility rules (takes `documentId`)

**`carta_rebuild_page`** — Rebuild Yjs data for a page by round-tripping through plain objects. Flushes corrupt state, orphaned keys, and stale references while preserving node IDs, positions, fields, edges, and organizer membership. Debug tool

### Operation Scoping

All construct and connection operations target the **active page**, which can be switched via `carta_page op:set_active`. Organizers are per-page (doc02.09). When creating constructs with `parentId`, position is relative to the organizer bounds.

In desktop mode, the local MCP server auto-discovers via `{userData}/server.json` (contains URL and PID). This enables zero-config MCP when Carta Desktop is running. The MCP server reads the locally-synced Y.Doc, providing fast access regardless of whether the document source is local or remote. The same MCP binary can also connect to remote servers via the `CARTA_SERVER_URL` environment variable.

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
