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
| `semanticDescription` | AI compilation context |
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

## Schema Seeds

**Location:** `@carta/domain/schemas/built-ins.ts`

Schema seeds are pre-packaged collections of related construct schemas for specific modeling domains (software architecture, BPMN, AWS, capability modeling, etc.). The domain package exports individual seeds for selective hydration:

**Exports:**
- `softwareArchitectureSeed` — Service, API endpoint, database, etc.
- `sketchingSeed` — Note, Box, etc.
- `bpmnSeed` — Activities, events, gateways
- `awsSeed` — EC2, S3, Lambda, etc.
- `capabilityModelSeed` — Capabilities, sub-capabilities

**Catalog metadata:**
```typescript
builtInSeedCatalog: Array<{
  id: string;
  displayName: string;
  description: string;
  seed: SchemaSeed;
}>
```

**Hydration:**
```typescript
hydrateSeed(seed: SchemaSeed, groupId?: string): ConstructSchema[]
```

Hydrates a single seed with fresh UUIDs and optional groupId override. This enables UI for adding schema collections without requiring full built-in hydration, supporting the schema seeding redesign.

**Type export:**
```typescript
export type { SchemaSeed } from './seed-loader.js';
```
