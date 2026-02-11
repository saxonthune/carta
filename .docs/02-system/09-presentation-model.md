---
title: Presentation Model
status: active
---

# Presentation Model

The presentation model is a pure transformation layer that converts domain state (constructs, schemas, connections, organizers) into view state (positioned, styled, visible/hidden React Flow nodes and edges). It owns all decisions about **how** data appears on screen, keeping the domain model free of rendering concerns.

## Why This Layer Exists

Without the presentation model, rendering logic is scattered: Map.tsx enhances node data with callbacks, useVisualGroups hides collapsed children, ConstructNode dispatches to variants, each variant makes its own styling decisions. The presentation model makes this explicit:

- **Domain model** describes what exists and how it relates (constructs, schemas, connections)
- **Presentation model** decides what the view should show given what exists
- **React Flow** renders the result

This separation means new rendering behaviors (organizer layouts, render styles, LOD bands) are added in one place without touching domain logic or React Flow integration.

## Architecture

```
Domain State                  Presentation Model                    React Flow
─────────────                 ──────────────────                    ──────────
Constructs (M0)        →      Node visibility, positioning     →    nodes[]
Schemas (M1)           →      Component selection (dispatch)   →    nodeTypes
Connections            →      Edge routing, remapping           →    edges[]
Organizers             →      Layout strategy (children)        →    parentId + position
Zoom level             →      LOD band selection                →    variant props
```

### Pure Function

The presentation model is a stateless function:

```
presentationModel(nodes, edges, schemas, organizers, zoom) → (processedNodes, processedEdges)
```

No side effects, no hooks internally. Hooks subscribe to state changes and feed into the function. This makes it testable in isolation.

### What the Presentation Model Decides

| Input | Decision | Output |
|-------|----------|--------|
| Schema `nodeShape` + LOD band | Which component renders this node | Dispatch to variant |
| Organizer collapse state | Which children are visible | `hidden` flag on nodes |
| Organizer layout strategy | Where children are positioned | `position` on child nodes |
| Organizer nesting | Edge remapping for collapsed ancestors | `edgeRemap` map |
| Connection data | Edge visibility, bundling | Processed edges |

### What the Presentation Model Does NOT Decide

- What constructs exist (domain)
- What connections mean (domain — port polarity, compatibleWith)
- How to persist state (adapter layer)
- How to compile output (compiler layer)

## Organizers

An **organizer** is a canvas-level grouping mechanism for visual organization. Organizers let users arrange constructs into collections without affecting the semantic model. They are never compiled — the compiler ignores them entirely.

### Organizers vs. Connections

This is the most important architectural distinction in Carta:

| | Organizers | Connections (Ports) |
|---|---|---|
| **Purpose** | Organize the canvas spatially | Model semantic relationships |
| **Layer** | Canvas / presentation | Domain |
| **Compiled?** | Never | Always |
| **User action** | Drag node into organizer, or select + group | Drag port to port |
| **Vocabulary** | "contains", "organizes", "collects" | "connects to", "flows to", "owns" |
| **Nesting** | Organizers can nest in organizers | N/A — connections are flat links |
| **Storage** | React Flow `parentId` on child nodes | `ConnectionValue` on source construct |
| **Semantics** | None — purely visual convenience | Full — polarity, compatibility, direction |

**The word "parent/child" is reserved for the port system.** Organizers use "contains/organized-in" language. A construct inside an organizer is a **member**, not a child.

### Why This Distinction Matters

The dual mandate (doc01.01) requires Carta to be useful for both human visual organization and AI-readable output. Organizers serve the human; connections serve the AI. If these were conflated:

- Dropping a node into an organizer would create a semantic relationship the user didn't intend
- The AI would see organizational convenience as architectural meaning
- Users would have two ways to express "A contains B" (put B in A's organizer, OR connect B's child port to A's parent port), violating "Necessary and Sufficient Primitives" (doc01.02)

By keeping them separate, the user gets spatial freedom without semantic noise.

### Organized Collection

An **organized collection** is the set of nodes that belong to a single organizer. The organizer is the container; the collection is its contents.

### Layout Strategies

Each organizer has a **layout strategy** that determines how its collection is arranged. Currently only `freeform` is implemented:

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| `freeform` | Members positioned freely within bounds. NodeResizer for manual sizing. This is the default and only layout. | General-purpose grouping, spatial clustering |

Layout strategies follow a **Strategy pattern** — each is a pure function that computes member positions and visibility from the organizer's state:

```
layoutStrategy(organizer, members) → { positionedMembers, visibleSet }
```

### Nesting Rules

Organizers can nest — an organizer can be a member of another organizer — **only when the nested organizer is a wagon attached to a construct that's a member of the outer organizer**. General-purpose organizer nesting is not supported.

- A freeform organizer can contain constructs and their wagon organizers
- A freeform organizer CANNOT contain non-wagon organizers
- Wagon organizers maintain `parentId` pointing at their construct, not at the outer organizer — nesting is implicit via the construct's membership

React Flow handles this natively via chained `parentId`: the wagon's `parentId` points to the construct node, and the construct's `parentId` points to the organizer.

**Business rules** are enforced at the attach point (when a node is dragged into an organizer) by the `canNestInOrganizer` validation function in `useOrganizerOperations.ts`.

### Collapse Behavior

All organizer layouts share the same collapse behavior:

- **Expanded**: Shows the layout with its members
- **Collapsed**: Shows a compact chip with organizer name and member count. All members are hidden. Edges to/from hidden members are remapped to the chip.

This is handled by the presentation model's visibility pass, not by individual layout components.

## Layout Algorithms

Carta provides several automated layout algorithms for arranging nodes on the canvas. These are utility functions that compute new positions while preserving the original centroid (preventing camera jumps).

### Flow Layout (Domain)

**Location:** `@carta/domain/utils/flowLayout.ts`
**Purpose:** Topological layout using the Sugiyama framework
**Algorithm:** Layer assignment → crossing minimization → coordinate assignment
**Directions:** TB (top-bottom), BT (bottom-top), LR (left-right), RL (right-left)

Flow layout analyzes port connections to determine hierarchy:
- Filters edges by `sourcePort` (default: "flow-out")
- Detects and breaks cycles using DFS
- Assigns layers via longest path from sources (nodes with no incoming edges)
- Minimizes edge crossings using barycenter heuristic
- Assigns coordinates based on direction

**Configurable:**
- `sourcePort` / `sinkPort` — which ports define flow direction
- `layerGap` — spacing between layers (default: 250)
- `nodeGap` — spacing between nodes in same layer (default: 150)
- `scope` — 'all' or array of node IDs to layout

This algorithm is exposed via:
- MCP tool: `carta_flow_layout`
- REST endpoint: `POST /api/documents/:id/layout/flow`
- Client utility: imported from domain package

### Hierarchical Layout (Web Client)

**Location:** `@carta/web-client/utils/hierarchicalLayout.ts`
**Purpose:** Client-side top-to-bottom arrangement using Sugiyama-style algorithm
**Use case:** Quick local layout without server round-trip

Similar to flow layout but optimized for client-side execution. Uses edge direction (source → target) to compute layers, breaks cycles via DFS, and arranges nodes top-to-bottom.

### Compact Nodes (Web Client)

**Location:** `@carta/web-client/utils/compactNodes.ts`
**Purpose:** Remove whitespace while preserving spatial order
**Algorithm:** Group by rows (y-threshold) → place tightly with gap spacing

Compacting:
1. Groups nodes into rows (30px y-threshold)
2. Sorts each row left-to-right
3. Places rows top-to-bottom with configurable gap
4. Shifts entire result to preserve original centroid

**Use case:** Tidy up after manual editing or bulk operations

All layout algorithms return `Map<string, {x, y}>` for easy integration with node update operations.

### Constraint Layout (Domain)

**Location:** `@carta/domain/utils/constraintLayout.ts`
**Purpose:** Declarative constraint-based node arrangement
**Algorithm:** Sequential constraint resolution with strategy-driven initial placement

Constraint layout provides a declarative API for arranging nodes using high-level constraints rather than absolute positions:

**Strategies:**
- `grid` — Initial placement in a uniform grid
- `preserve` — Adjust existing positions to satisfy constraints
- `force` — Organic spring-force layout (not yet implemented)

**Constraint types:**
- `align` — Align nodes along x or y axis (center, min, max)
- `order` — Sort nodes by field value or alphabetically
- `spacing` — Enforce minimum or equal spacing
- `group` — Cluster nodes by constructType or field value
- `distribute` — Even spacing along axis
- `position` — Anchor to canvas edge (top, bottom, left, right, center)
- `flow` — Topological layout (delegates to flowLayout internally)

**Configurable:**
- `nodeGap` — default spacing between nodes (default: 40)
- `scope` — 'all' or array of semanticIds to layout
- `constraints` — array of constraints applied sequentially

This algorithm is exposed via:
- MCP tool: `carta_arrange`
- REST endpoint: `POST /api/documents/:id/layout/arrange`
- Client utility: imported from domain package

### Sequence Badges

**Location:** `@carta/web-client/presentation/sequenceBadges.ts`
**Purpose:** Compute topology-derived ordinals for organizer members

Sequence badges are small numbered overlays (1, 2, 3...) that appear on constructs inside organizers when they participate in flow-based sequences. The badges are computed from the graph topology — not stored as data — ensuring they stay synchronized with connections.

**Algorithm:**
1. Group nodes by organizer membership
2. Find flow-out → flow-in edges between members
3. Compute topological layers via longest path from sources (nodes with no incoming flow edges)
4. Assign 1-based ordinals from layer numbers

**When shown:**
- Only for constructs inside organizers
- Only for constructs connected by flow edges
- Disconnected members get no badge

**Pure function:**
```typescript
computeSequenceBadges(nodes, edges) → { badges: Map<nodeId, ordinal> }
```

This feature was designed in research session doc05.01 to address visual clarity in BPMN-style sequential processes. The badges are presentation-layer only — the compiler never sees them.

## Node Presentation Dispatch

The presentation model also governs which component renders each construct. This is a two-key dispatch:

```
(schema.nodeShape, lodBand) → Component
```

| nodeShape / LOD | `marker` (zoom < 0.5) | `normal` (zoom >= 0.5) |
|-------------------|---------------------|------------------------|
| `'default'` | ConstructNodeMarker | ConstructNodeDefault |
| `'simple'` | ConstructNodeMarker | ConstructNodeSimple |
| `'card'` | ConstructNodeMarker | ConstructNodeCard |
| `'circle'` | ConstructNodeMarker | ConstructNodeCircle |
| `'diamond'` | ConstructNodeMarker | ConstructNodeDiamond |
| `'document'` | ConstructNodeMarker | ConstructNodeDocument |

The shape variants (`circle`, `diamond`, `document`) support notation-specific rendering for BPMN and other visual languages (see doc05.01). Circle renders as a circular node (events, states), diamond as a diamond shape (gateways, decisions), and document as a document-shaped icon (artifacts, data objects).

Adding a new render style = add a component + add a row to the dispatch table. No other changes needed. Variant components are pure (no hooks), receive identical `ConstructNodeVariantProps`, and share only the data contract and connection infrastructure.

## Relationship to Other Layers

| Layer | Relationship |
|-------|-------------|
| **Domain** (`@carta/domain`) | Presentation model consumes domain types but never modifies them |
| **Document** (`@carta/document`) | Presentation model reads via adapter hooks, never writes |
| **Compiler** (`@carta/compiler`) | Compiler ignores organizers; presentation model ignores compilation |
| **React Flow** | Presentation model produces React Flow-compatible node/edge arrays |

The presentation model lives in the **Visual Editor Layer** (doc02.01) but is conceptually distinct from React components. It is the bridge between "what exists" and "what you see."
