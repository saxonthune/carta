---
title: Wagon-Aware Layout Architecture
status: active
date: 2026-02-13
tags: layout, organizers, wagons, presentation, state-management
---

# Wagon-Aware Layout Architecture

> **Question**: How should organizer layout actions (grid, spread, flow) account for wagon organizers attached to constructs, and what are the state-management pitfalls?

## Context

Organizer layout actions (grid, spread, flow, fit-to-children) need to treat a construct and its wagon organizer as a single "layout unit". Without this, layout algorithms use construct-only dimensions, placing items too close together and causing wagons to overlap with adjacent constructs.

This research session documents the architecture, the React Flow parent chain, the state update sequence, and the pitfalls discovered during implementation.

## React Flow Parent Chain

Wagon organizers are children of their parent construct in React Flow's node hierarchy, NOT children of the enclosing organizer:

```
Outer organizer (parentId=null)
├── Construct A (parentId=organizer)
│   └── Wagon A (type=organizer, parentId=Construct A, data.attachedToSemanticId=A's semanticId)
│       ├── Child 1 (parentId=Wagon A)
│       └── Child 2 (parentId=Wagon A)
├── Construct B (parentId=organizer)
│   └── Wagon B (type=organizer, parentId=Construct B, data.attachedToSemanticId=B's semanticId)
│       └── ...
```

Key implications:
- **Moving a construct moves its wagon subtree automatically** (React Flow parent chain).
- **Layout actions only need to position constructs** — wagons follow via the parent chain.
- **Wagon positions are relative to the construct**, not the enclosing organizer.
- **`directChildren` of an organizer includes only constructs** (and non-wagon child organizers), not wagon organizers.

## Layout Unit Expansion

A "layout unit" is the bounding box of a construct plus its entire wagon tree. The expansion is computed by `computeLayoutUnitBounds()` in `@carta/schema`:

```
Construct (180×100)    Wagon (420×163)
┌─────────┐ 10px gap  ┌──────────────────┐
│         │───────────>│                  │
│         │            │   [children]     │
└─────────┘            └──────────────────┘
<───────────── 610px ────────────────────>
```

The function walks the wagon tree from each construct, tracking min/max extents. Returns `LayoutUnitBounds { offsetX, offsetY, width, height }`.

- **offsetX/Y**: how far the bounding box extends above/left of the construct origin (typically 0 after wagon snap)
- **width/height**: total bounding box dimensions

After layout algorithms place items using expanded dimensions, `convertToConstructPositions()` subtracts the offsets to get actual construct positions.

## Wagon Snap Normalization

Before computing layout units, wagon positions must be normalized ("snapped") to a consistent position relative to their construct. Without this, wagons at arbitrary positions (below, overlapping, etc.) produce unpredictable expanded bounds.

`snapWagonsInOrganizer(organizerId)` normalizes all wagons within an organizer to `{x: constructWidth + 10, y: 0}` (right of construct, 10px gap, top-aligned).

**Critical**: Must be batched into a single `applyPositionPatches` call. Individual `positionWagonNextToConstruct` calls per wagon risk React batching issues with `setNodesLocal`.

## State Update Sequence

React Flow uses **uncontrolled mode** (`defaultNodes`). The internal Zustand store is the source of truth:

```
snapWagonsInOrganizer()
  └── applyPositionPatches(wagons)
        ├── reactFlow.setNodes(updater)    ← Zustand: synchronous ✓
        ├── setNodesLocal(updater)         ← React: batched/queued
        └── adapter.patchNodes(patches)    ← Yjs: updated
            └── origin='drag-commit' → subscriber skips ✓

reactFlow.getNodes()  ← reads from Zustand, reflects snap ✓

getChildLayoutUnits(rfNodes, organizerId)
  └── computeLayoutUnitBounds()  ← uses snapped wagon positions ✓

applyPositionPatches(constructs)  ← grid/spread/flow positions
fitToChildren(organizerId)        ← resize organizer to fit
```

### Why uncontrolled mode matters

- `reactFlow.setNodes()` and `reactFlow.getNodes()` both hit the same Zustand store
- `setNodesLocal` (React setState) is a separate mirror for non-RF consumers
- `adapter.patchNodes` uses `'drag-commit'` origin, which the Yjs observer skips (prevents re-notification loops)

### CRITICAL: `reactFlow.getNodes()` returns stale data after `setNodes()`

Despite using Zustand internally, `reactFlow.getNodes()` called immediately after `reactFlow.setNodes(updater)` may return **stale node data** for the changed nodes. This was confirmed empirically: after snapping a wagon from `{x:177, y:154}` to `{x:190, y:0}`, the subsequent `getNodes()` still returned the old position.

**Pattern**: Never rely on reading back from `reactFlow.getNodes()` after `setNodes()` within the same synchronous call. Instead, **pass known positions forward** as parameters to subsequent functions.

### The 3-layer sync pattern

Every position/style change must update three layers:
1. **React Flow Zustand store** (`reactFlow.setNodes`) — drives rendering
2. **React local state** (`setNodesLocal`) — mirror for hooks/components
3. **Yjs** (`adapter.patchNodes`) — persistence and collaboration

Helper functions `applyPositionPatches()` and `applyStylePatches()` encapsulate this pattern.

## Key Functions

| Function | Location | Purpose |
|----------|----------|---------|
| `computeLayoutUnitBounds()` | `@carta/schema/utils/layoutUnitSize.ts` | Computes construct+wagon bounding box with offsets |
| `getChildLayoutUnits()` | `useLayoutActions.ts` (module-level) | Returns SpreadInput[] with expanded dims + offset map |
| `convertToConstructPositions()` | `useLayoutActions.ts` (module-level) | Converts expanded-space positions back to construct positions |
| `getChildVisualFootprints()` | `useLayoutActions.ts` (module-level) | Returns NodeGeometry[] for fitToChildren |
| `snapWagonsInOrganizer()` | `useLayoutActions.ts` (hook) | Normalizes wagon positions before layout |
| `applyPositionPatches()` | `useLayoutActions.ts` (module-level) | 3-layer sync for position changes |
| `applyStylePatches()` | `useLayoutActions.ts` (module-level) | 3-layer sync for style (width/height) changes |

## Discovered Pitfalls

1. **`reactFlow.getNodes()` is stale after `setNodes()`** — the most impactful finding. Any function that calls `setNodes` and then reads `getNodes` in the same synchronous block will see stale data. Solution: pass known positions forward as parameters (e.g., `knownWagonPositions`, `knownChildPositions` maps).

2. **Wagon snap must happen before bounds computation** — otherwise expanded bounds reflect arbitrary wagon positions, producing unpredictable spacing.

3. **Batch wagon snaps** — individual `positionWagonNextToConstruct` calls each trigger `applyPositionPatches`. Multiple calls should be consolidated into a single batch.

4. **`fitToChildren` needs wagon-aware footprints** — the `getChildVisualFootprints` function must use `computeLayoutUnitBounds` to include wagon extents, not just direct child dimensions.

5. **Recursive layout processes bottom-up** — innermost organizers first, so that when outer organizers compute layout, inner wagon sizes are already finalized.

6. **Layout pin skips layout+fit but not recursion** — a pinned organizer keeps its children in place, but recursion continues through it to reach deeper unpinned organizers.

## Outcome

- Implementation in `useLayoutActions.ts` (wagon-aware grid/spread/flow/fit)
- `computeLayoutUnitBounds` added to `@carta/schema` (doc02.09 update needed)
- `layoutPinned` flag added to `OrganizerNodeData`
- Recursive layout via `recursiveLayout()` with bottom-up processing
