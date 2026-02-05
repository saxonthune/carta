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
| Schema `renderStyle` + LOD band | Which component renders this node | Dispatch to variant |
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

Each organizer has a **layout strategy** that determines how its collection is arranged:

| Strategy | Behavior | Use Case |
|----------|----------|----------|
| `freeform` | Members positioned freely within bounds. NodeResizer for manual sizing. This is the default. | General-purpose grouping, spatial clustering |
| `stack` | One member visible at a time. Arrow navigation between members. Index-based visibility. | Alternatives, versions, step-by-step sequences |
| `grid` | Members auto-arranged in a resizable grid. Column count adjustable. | Compact overviews, card-wall style layouts |

Layout strategies are a **Strategy pattern** — each is a pure function that computes member positions and visibility from the organizer's state:

```
layoutStrategy(organizer, members) → { positionedMembers, visibleSet }
```

### Nesting Rules

Organizers can nest — an organizer can be a member of another organizer. React Flow handles this natively via chained `parentId`.

**Business rules** are enforced at the attach point (when a node is dragged into an organizer):

- A freeform organizer can contain other organizers of any type
- A stack organizer cannot contain other organizers (stacks navigate between leaf constructs)
- A grid organizer cannot contain other organizers (grids auto-position leaf constructs)

These rules live in the attach validation function, making them easy to add, change, or remove.

### Collapse Behavior

All organizer layouts share the same collapse behavior:

- **Expanded**: Shows the layout with its members
- **Collapsed**: Shows a compact chip with organizer name and member count. All members are hidden. Edges to/from hidden members are remapped to the chip.

This is handled by the presentation model's visibility pass, not by individual layout components.

## Node Presentation Dispatch

The presentation model also governs which component renders each construct. This is a two-key dispatch:

```
(schema.renderStyle, lodBand) → Component
```

| renderStyle / LOD | `pill` (zoom < 0.5) | `normal` (zoom >= 0.5) |
|-------------------|---------------------|------------------------|
| `'default'` | ConstructNodePill | ConstructNodeDefault |
| `'simple'` | ConstructNodePill | ConstructNodeSimple |
| `'card'` | ConstructNodePill | ConstructNodeCard |
| future styles... | ConstructNodePill | ConstructNode{Style} |

Adding a new render style = add a component + add a row to the dispatch table. No other changes needed. Variant components are pure (no hooks), receive identical `ConstructNodeVariantProps`, and share only the data contract and connection infrastructure.

## Relationship to Other Layers

| Layer | Relationship |
|-------|-------------|
| **Domain** (`@carta/domain`) | Presentation model consumes domain types but never modifies them |
| **Document** (`@carta/document`) | Presentation model reads via adapter hooks, never writes |
| **Compiler** (`@carta/compiler`) | Compiler ignores organizers; presentation model ignores compilation |
| **React Flow** | Presentation model produces React Flow-compatible node/edge arrays |

The presentation model lives in the **Visual Editor Layer** (doc02.01) but is conceptually distinct from React components. It is the bridge between "what exists" and "what you see."
