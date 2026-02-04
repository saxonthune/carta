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
DataKind                ConstructSchema              ConstructNodeData
DisplayHint             FieldSchema                    - constructType
Polarity                PortConfig                     - semanticId
PortSchema interface    PortSchema instances            - values {}
                        SchemaGroup                    - connections[]
                        Deployable                     - instanceColor?
```

**M2** defines the grammar — what kinds of things can exist. **M1** defines the vocabulary — what specific types exist in this document. **M0** holds the sentences — actual instances placed on the canvas.

## M2: Fixed Primitives

These types are fixed at design time. Users cannot add, remove, or modify them.

### DataKind

The five primitive data types for field values. Every field has exactly one (see doc01.02, "DataKind Is Exhaustive").

| Kind | Description | Example Values |
|------|-------------|----------------|
| `string` | Text data | "Hello", "/api/users" |
| `number` | Numeric data | 42, 3.14 |
| `boolean` | True/false | true, false |
| `date` | Date values | "2024-01-15" |
| `enum` | Fixed choices | "GET", "POST", "PUT" |

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

### ConstructSchema

Defines a construct type. Key properties:

| Property | Purpose |
|----------|---------|
| `type` | Unique identifier |
| `displayName` | Human-readable name |
| `color` | Visual accent color |
| `description` | AI compilation context |
| `displayField` | Which field value becomes the node title |
| `fields` | Array of FieldSchema |
| `ports` | Array of PortConfig |
| `backgroundColorPolicy` | Controls instance color picker: `defaultOnly` (none), `tints` (7 swatches), `any` (full picker) |

### FieldSchema

Defines a data slot on a construct type:

| Property | Purpose |
|----------|---------|
| `name` | Internal key |
| `label` | Display label |
| `type` | One of the five DataKinds |
| `description` | AI compilation context |
| `options` | Enum choices (enum type only) |
| `displayHint` | Rendering hint (string type only) |
| `displayTier` | Display tier: `pill`, `minimal`, `details`, or `full` |
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

Node titles derive from the schema's `displayField` value, falling back to `semanticId`. There is no separate `name` field (see doc01.03, "Display Name").

### Virtual Parent Nodes

Visual grouping containers for child constructs. Not compiled — the compiler filters them out. Created when a port has `allowsGrouping: true`. Three collapse states: expanded, no-edges, collapsed (pill).

## Child Construct Pattern

Instead of embedding structured data as table fields, use child constructs connected via parent-child ports (see doc01.02, "No Embedded Tables").

```
Old: Controller.params = [{name: "id", in: "path", ...}]
New: Controller <--parent-- ApiParameter instances
```

The compiler finds children by traversing connections from child ports targeting the parent's semanticId.

## Port Registry

The `PortRegistry` class manages port schemas with polarity-based validation. It receives schemas as a parameter (not a singleton). Components access port schemas through `usePortSchemas()`, and the registry syncs with document state.
