---
title: Metamodel Architecture
status: active
---

# Metamodel Architecture

Carta uses a three-level metamodel (M2/M1/M0) to provide modeling flexibility while maintaining type safety. This is the core type system that makes Carta domain-agnostic.

## Levels

```
M2 (Designer-fixed)     M1 (User-defined)           M0 (Instances)
---------------------   -------------------------   ---------------------
DataKind                SchemaPackage                ConstructNodeData
DisplayHint             ConstructSchema                - constructType
Polarity                FieldSchema                    - semanticId
PortSchema interface    PortConfig                     - values {}
                        PortSchema instances            - connections[]
                        SchemaGroup (visual)            - instanceColor?
                        Deployable
```

**M2** defines the grammar — what kinds of things can exist. **M1** defines the vocabulary — what specific types exist in this document. **M0** holds the sentences — actual instances placed on the canvas.

## M2: Fixed Primitives

These types are fixed at design time. Users cannot add, remove, or modify them.

### DataKind

The six data types for field values. Every field has exactly one (see doc01.02, "DataKind Is Exhaustive").

| Kind | Description | Example Values |
|------|-------------|----------------|
| `string` | Text data | "Hello", "/api/users" |
| `number` | Numeric data | 42, 3.14 |
| `boolean` | True/false | true, false |
| `date` | Date values | "2024-01-15" |
| `enum` | Fixed choices | "GET", "POST", "PUT" |
| `resource` | Reference to a document resource | `{ resourceId: "abc-123", pathHint: "Page.nodes" }` |

The first five kinds are scalar values. The sixth — `resource` — is a reference type introduced by doc02.04.08. Its value is a compound `{ resourceId, pathHint? }` pointing to a Resource entity in the document and optionally hinting at a location within the resource body. The `pathHint` is a freeform string — Carta stores and displays it but does not validate or navigate it, because resource bodies are format-agnostic (see doc02.04.08, "Resource bodies are opaque to Carta").

### DisplayHint

Optional presentation hints for string fields. Affects rendering only, not storage (see doc01.02, "DataKind Is Exhaustive").

| Hint | Renders As |
|------|------------|
| (none) | Single-line input |
| `multiline` | Textarea |
| `code` | Monospace textarea |
| `password` | Password input |
| `url` | URL input |
| `color` | Color picker |

### Polarity

Determines connection direction semantics. Five values — see doc02.04.02 for the design decision.

| Polarity | Meaning | Built-in Examples |
|----------|---------|-------------------|
| `source` | Initiates connections | flow-out, parent |
| `sink` | Receives connections | flow-in, child |
| `bidirectional` | Both directions | symmetric |
| `relay` | Pass-through output, bypasses type checking | relay |
| `intercept` | Pass-through input, bypasses type checking | intercept |

Validation uses a two-step algorithm in `canConnect()`:
1. **Direction check**: relay maps to source, intercept maps to sink. Same-direction pairs are blocked.
2. **compatibleWith check**: Skipped if either side is relay, intercept, or bidirectional. For plain source+sink, at least one side must list the other in `compatibleWith`.

## M1: User-Defined Schemas

Users define their domain vocabulary at this level. All M1 entities are stored in the Yjs Y.Doc and accessed through the DocumentAdapter.

### SchemaPackage

The unit of schema bundling and library portability. A package groups related schemas and their domain-specific port schemas into a self-contained vocabulary. Packages are what get published to and applied from the schema library (doc03.01.01.07).

| Property | Purpose |
|----------|---------|
| `id` | Unique identifier |
| `name` | Human-readable name (e.g., "Backend Stack") |
| `description` | Optional description for library browsing |
| `color` | Visual accent color |

Schemas and port schemas declare their package membership via `packageId`. Schema groups (visual) also declare `packageId` to scope their nesting within a package. Port schemas without a `packageId` are document-level (cross-package connectors); the built-in port schemas (flow, parent/child, relay, intercept) serve as default cross-package connectors.

### SchemaRelationship

Schema-level relationships stored in the document's `schemaRelationships` Y.Map. Each relationship is stored once (not bidirectional duplicates). Replaces the deprecated `suggestedRelated` array on schemas.

| Property | Purpose |
|----------|---------|
| `id` | Unique identifier |
| `sourceSchemaType` | Source schema type |
| `sourcePortId` | Port on source schema |
| `targetSchemaType` | Target schema type |
| `targetPortId` | Port on target schema |
| `label` | Optional label for the relationship |
| `packageId` | Present = intra-package (travels with library), absent = document-scoped |

Used by MetamapV2 to render edges between schema nodes and drive quick-add menus.

### ConstructSchema

Defines a construct type. Key properties:

| Property | Purpose |
|----------|---------|
| `type` | Unique identifier |
| `displayName` | Human-readable name |
| `color` | Visual accent color |
| `semanticDescription` | AI compilation context |
| `fields` | Array of FieldSchema |
| `ports` | Array of PortConfig |
| `packageId` | References SchemaPackage.id — which package this schema belongs to |
| `groupId` | Optional visual grouping within the package (references SchemaGroup.id) |
| `instanceColors` | `true` = per-instance color palette picker enabled; absent/false = schema color only |
| `isFavorite` | `true` = schema pinned to top-level context menu for quick "Add X" access |
| `nodeShape` | Visual shape: `default`, `simple`, `circle`, `diamond`, `document` |

### FieldSchema

Defines a data slot on a construct type:

| Property | Purpose |
|----------|---------|
| `name` | Internal key |
| `label` | Display label |
| `type` | One of the six DataKinds |
| `semanticDescription` | AI compilation context |
| `options` | Enum choices (enum type only) |
| `displayHint` | Rendering hint (string type only) |
| `displayTier` | Display tier: `pill` (node title, max 1 per schema) or `summary` (shown on canvas). Omit for inspector-only fields. |
| `displayOrder` | Sort order within the assigned tier |

### PortConfig

Configures a port on a construct type:

| Property | Purpose |
|----------|---------|
| `id` | Unique within construct |
| `portType` | References a PortSchema.id |
| `label` | Display label |
| `suggestedTypes` | Hint for what construct types to connect |
| `allowsGrouping` | Enables virtual parent grouping |

### PortSchema

User-editable port type definitions. Built-in defaults:

| Port Type | Polarity | Compatible With |
|-----------|----------|-----------------|
| `flow-in` | sink | `['flow-out']` |
| `flow-out` | source | `['flow-in']` |
| `parent` | source | `['child']` |
| `child` | sink | `['parent']` |
| `symmetric` | bidirectional | `[]` (skips check) |
| `intercept` | intercept | `[]` (skips check) |
| `relay` | relay | `[]` (skips check) |

Users can create custom port types via the Metamap view.

Port schemas have an optional `packageId`. In-package ports (those with a `packageId`) are domain-specific vocabulary that travels with the package in libraries (e.g., "modifies/modified-by" in a sentence diagramming package). Document-level ports (no `packageId`) are cross-package connectors. The built-in port schemas above have no `packageId` — they serve as default cross-package plumbing.

## M0: Construct Instances

Instances live on the canvas. Each has:

| Property | Purpose |
|----------|---------|
| `constructType` | References a ConstructSchema.type |
| `semanticId` | Human/AI-readable identifier (see doc01.02, "Dual Identity System") |
| `values` | Field values keyed by field name |
| `connections` | Array of {portId, targetSemanticId, targetPortId} |
| `deployableId` | Optional logical grouping assignment |
| `instanceColor` | Visual-only color override (not compiled) |

Node titles derive from field values (typically the first field), falling back to `semanticId`. There is no separate `name` field (see doc01.03, "Display Name").

### Organizers Are Not Part of the Metamodel

Organizers (visual grouping containers) exist at the canvas/presentation layer, not the domain layer. They are never compiled and carry no semantic meaning. The metamodel governs constructs, schemas, fields, ports, and connections — all of which are compiled. See doc02.09 for organizer architecture.

## Child Construct Pattern

Instead of embedding structured data as table fields, use child constructs connected via parent-child ports (see doc01.02, "No Embedded Tables").

```
Old: Controller.params = [{name: "id", in: "path", ...}]
New: Controller <--parent-- ApiParameter instances
```

The compiler finds children by traversing connections from child ports targeting the parent's semanticId.

## Port Registry

The `PortRegistry` class manages port schemas with polarity-based validation. It receives schemas as a parameter (not a singleton). Components access port schemas through `usePortSchemas()`, and the registry syncs with document state.

## Standard Library

**Location:** `@carta/schema` — `schemas/package-loader.ts` and `schemas/packages/`

Schema packages are `SchemaPackageDefinition` objects — self-contained, portable package definitions with stable UUIDs that load through the idempotent `applyPackage()` function (doc02.04.07). The old imperative seed system has been removed.

**Standard library packages:**
- Software Architecture — Service, API endpoint, database, etc.
- Sketching — Note, Box, etc.
- BPMN — Activities, events, gateways
- AWS — EC2, S3, Lambda, etc.
- Capability Model — Capabilities, sub-capabilities

Each package has a stable UUID, display metadata for the package picker, and a complete `SchemaPackageDefinition` containing schemas, in-package port schemas, groups, and relationships.

**Loading:** All packages are opt-in. Users load them via the package picker (doc03.01.01.07). No auto-seeding. The document's package manifest tracks which packages have been loaded and provides drift detection via content hashing.

**Key functions** exported from `@carta/schema`:
- `applyPackage(adapter, definition)` — idempotent package load
- `isPackageModified(adapter, packageId)` — fast drift check via content hash
- `isLibraryNewer(manifestEntry, libraryDefinition)` — detects app-shipped library updates
- `computePackageDiff(adapter, packageId)` — detailed field-level diff against snapshot
- `computePackageDiffFromDefinitions(baseline, current)` — diff two definitions (snapshot vs library)
- `extractPackageDefinition(adapter, packageId)` — extract current state for publishing
- `debugPackageDrift(adapter, packageId)` — diagnostic helper when drift status and diff view disagree
