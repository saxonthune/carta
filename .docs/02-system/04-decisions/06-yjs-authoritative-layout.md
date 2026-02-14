---
title: "ADR: Yjs-Authoritative Layout with RF as Renderer"
status: proposed
date: 2026-02-14
tags: adr, state, layout, react-flow, yjs, architecture
---

# ADR: Yjs-Authoritative Layout with RF as Renderer

## Context

Layout actions (grid, spread, flow, fit-to-children) must update node positions, organizer sizes, and wagon positions. The current architecture requires every mutation to synchronize four stores manually:

1. **React Flow's internal Zustand store** — `reactFlow.setNodes(updater)`
2. **React local state mirror** — `setNodesLocal(updater)`
3. **Yjs Y.Doc** — `adapter.patchNodes(patches)`
4. **RF internal measured/width/height** — set implicitly by `expandParent` and DOM measurement

This creates several classes of bugs:

- **Stale reads**: `reactFlow.getNodes()` returns stale data immediately after `reactFlow.setNodes()` in the same synchronous block (doc05.03). Requires passing "known positions" forward as parameters — a fragile workaround.
- **expandParent ratchet**: RF's `expandParent` uses `Math.max(currentDimensions, childNeeds)` — it only grows, never shrinks. Setting `style.height` is overridden by internal `measured.height`. Required setting explicit `width`/`height` on the node object as a workaround.
- **Suppression hacks**: `suppressExpandParentWriteback` ref prevents dimension changes from writing back to Yjs during layout, but doesn't prevent RF's internal expansion.
- **3-layer sync**: `applyPositionPatches()` and `applyStylePatches()` must update RF + React + Yjs atomically, but can't guarantee consistency because each layer processes updates at different times.

Every new layout feature (wagon-aware bounds, recursive layout, layout pins) multiplies these synchronization points. The architecture is unsustainable.

## Decision

Make Yjs the authoritative store for all layout operations. React Flow becomes a pure renderer that receives position/size updates via a single sync module.

### Architecture

```
┌─────────────────────────────────┐
│  Layout actions                 │
│  (useLayoutActions)             │
│                                 │
│  READ:  adapter.getNodes()      │
│  WRITE: adapter.patchNodes()    │
│                                 │
│  No RF dependency.              │
│  No setNodesLocal.              │
│  No knownPositions forwarding.  │
└───────────────┬─────────────────┘
                │ writes to Yjs (default origin)
                ▼
┌─────────────────────────────────┐
│  Yjs Y.Doc                      │
│  (sole source of truth)         │
└───────────────┬─────────────────┘
                │ observeDeep
                ▼
┌─────────────────────────────────┐
│  Sync module                    │
│  (extended useNodes.ts)         │
│                                 │
│  On Yjs change:                 │
│    if origin === 'drag-commit'  │
│      → skip (RF already knows)  │
│    else                         │
│      → reactFlow.setNodes(...)  │
│      → setNodesLocal(...)       │
└───────────────┬─────────────────┘
                │
                ▼
┌─────────────────────────────────┐
│  React Flow                     │
│  (renderer only)                │
│                                 │
│  Uncontrolled mode preserved    │
│  for drag performance.          │
│  expandParent = DISABLED.       │
│  Organizer sizing = explicit.   │
└─────────────────────────────────┘
```

### Drag path (unchanged, fast)

Drag is the one case where RF originates the change:

1. **mousemove**: RF updates its internal Zustand store directly (bypasses React, 60fps)
2. **mouseup**: `onNodeDragStop` → `adapter.patchNodes(positions, 'drag-commit')`
3. **Yjs observer**: sees `'drag-commit'` origin → skips RF push (RF already has the position)

RF remains the owner of in-flight drag state. The `'drag-commit'` origin tag is the signal that the sync module should swallow the write.

### Layout action path (simplified)

1. **Read** from `adapter.getNodes()` — always consistent, no staleness
2. **Compute** new positions/sizes (pure functions, no RF dependency)
3. **Write** to `adapter.patchNodes(patches)` — default origin
4. **Sync module** observes the change → pushes to RF → RF re-renders

No manual 3-layer sync. No `knownPositions` forwarding. No `suppressExpandParentWriteback`.

### What gets removed

| Current | Replacement |
|---------|-------------|
| `applyPositionPatches()` (3-layer sync) | `adapter.patchNodes()` (Yjs only) |
| `applyStylePatches()` (3-layer sync) | `adapter.patchNodes()` (Yjs only) |
| `knownWagonPositions` parameter threading | Gone — reads from Yjs are consistent |
| `knownChildPositions` parameter threading | Gone |
| `suppressExpandParentWriteback` ref | Gone — `expandParent` disabled entirely |
| `expandParent` on construct nodes | Gone — organizer sizing is explicit via `fitToChildren` |
| Layout actions importing `reactFlow` | Gone — only `adapter` needed |
| `reactFlow.getNodes()` in layout code | `adapter.getNodes()` |

### What stays the same

- Uncontrolled mode (`defaultNodes`) — drag performance preserved
- `onNodesChange` handler in Map.tsx — still filters RF events, commits drag-end to Yjs
- `'drag-commit'` transaction origin — still used to prevent observer echo
- `fitToChildren` logic — same computation, just reads/writes Yjs instead of RF
- `computeLayoutUnitBounds`, `computeOrganizerFit` — pure domain functions, unchanged

### expandParent removal

`expandParent` is disabled on all nodes. Organizer sizing is fully managed by `fitToChildren` (called after layout actions and drag-end). This eliminates:

- The one-way ratchet bug (measured dimensions only grow)
- The `suppressExpandParentWriteback` hack
- The need to set `width`/`height` on node objects alongside `style`
- Dimension change events from `expandParent` in `onNodesChange`

Manual resize via `NodeResizer` continues to work — resize-end commits to Yjs via the existing `onNodesChange` handler.

## Consequences

### Positive

- **One source of truth**: Layout actions read and write Yjs only. No staleness, no sync bugs.
- **Simpler code**: ~100 lines of sync helpers replaced by one observer in the sync module.
- **Fewer parameters**: Functions like `getChildLayoutUnits`, `getChildVisualFootprints`, `fitToChildren` lose their `knownPositions` / `knownWagonPositions` / `excludeNodeIds` parameters.
- **Predictable testing**: Layout functions become pure (Yjs data in → Yjs patches out).
- **Collaboration-ready**: Remote Yjs changes automatically propagate to RF via the same sync module.

### Negative

- **Yjs read overhead**: `adapter.getNodes()` deserializes from Y.Map on every call. May need caching for hot paths (profile first).
- **Observer latency**: Layout results appear after Yjs observer fires (microtask boundary), not synchronously. Visually imperceptible for layout actions but worth monitoring.
- **Migration scope**: Touches `useLayoutActions.ts`, `useNodes.ts`, `Map.tsx`, possibly `yjsAdapter.ts`. Must be done atomically — partial migration would have both patterns coexisting.

### Risks

- **Drag jank if observer misfires**: If the sync module accidentally pushes during drag (origin tag missing), it could cause position fights. Mitigation: the `'drag-commit'` pattern is already tested and working.
- **Yjs deserialization perf**: If `adapter.getNodes()` is slow for large documents, layout actions that call it multiple times could lag. Mitigation: cache per-action (read once at start, compute, write).

## Alternatives Considered

### Full controlled mode

Use `<ReactFlow nodes={nodes} onNodesChange={handler}>`. Yjs → React state → RF. Eliminates RF's internal store as a concern.

**Rejected**: Drag performance. Every drag tick flows through React state. GitHub issues [#2119](https://github.com/xyflow/xyflow/issues/2119), [#4391](https://github.com/xyflow/xyflow/issues/4391), [discussion #4975](https://github.com/xyflow/xyflow/discussions/4975) confirm this kills performance at 80+ nodes.

### Keep current architecture, fix incrementally

Continue with 3-layer sync, add more `knownPositions` parameters, more suppression flags.

**Rejected**: Each new feature multiplies sync points. The `knownWagonPositions` pattern was already the second workaround layer. Unsustainable.

## Migration Plan

1. **Extend sync module**: Add `reactFlow.setNodes()` call to Yjs observer (skip for `'drag-commit'` origin)
2. **Disable `expandParent`**: Remove from `shouldExpandParent()` in Map.tsx, ensure `fitToChildren` is called after drag-end into organizers
3. **Migrate layout actions**: One by one, switch from RF read/write to Yjs read/write
4. **Remove dead code**: `applyPositionPatches`, `applyStylePatches`, `knownPositions` params, `suppressExpandParentWriteback`
5. **Verify**: Drag performance, layout correctness, collaboration sync
