---
name: react-flow-expert
description: Expert guidance on React Flow uncontrolled mode, presentation layer performance, and edge rendering. Invoke when investigating UI jank, render loops, or designing new visual features.
---

# react-flow-expert

Guides performance investigation and feature design for Carta's React Flow integration. Understands the constraints of uncontrolled mode, the presentation model pipeline, and edge rendering patterns.

## When This Triggers

- Performance issues: jank, lag, hitchy interactions, slow renders
- Questions about uncontrolled vs controlled mode trade-offs
- Designing new visual features that touch the presentation layer
- Edge rendering, pathfinding, or re-render storms
- Organizer layout, auto-sizing, or feedback loops
- "Why does X cause re-renders?" or "How should I implement Y in the presentation layer?"

## Reference Files

Read these before diagnosing:

```
.docs/02-system/09-presentation-model.md          # Presentation model architecture
packages/web-client/src/presentation/              # Pure presentation functions
packages/web-client/src/hooks/usePresentation.ts   # Hook wrapper
packages/web-client/src/components/canvas/Map.tsx   # Container: sync effects, onNodesChange
packages/web-client/src/components/canvas/DynamicAnchorEdge.tsx  # Edge component
```

## Carta's React Flow Architecture

Carta uses **uncontrolled mode** (`defaultNodes`/`defaultEdges`) with sync effects:

```
                    ┌─────────────────────────────────────────────────────┐
                    │                  React Flow                         │
                    │  (owns node/edge state after mount)                 │
                    │                                                     │
  defaultNodes ───→ │  internal nodeLookup ──→ render ──→ measure         │
  defaultEdges ──→ │                                        │             │
                    │  ←── reactFlow.setNodes() ◄───────────│─── sync ──┐ │
                    │  ──→ onNodesChange() ─────────────────│──────┐    │ │
                    └───────────────────────────────────────│──────│────│─┘
                                                           │      │    │
                                                           ▼      │    │
                                          dimension changes  │      │    │
                                                  │         │      │    │
                                                  ▼         │      │    │
                                          setNodesLocal()   │      │    │
                                                  │         │      │    │
                                                  ▼         │      │    │
                                            nodes state ────┘      │    │
                                                  │                │    │
                                                  ▼                │    │
                                         usePresentation()         │    │
                                                  │                │    │
                                                  ▼                │    │
                                           sortedNodes ────────────┘    │
                                                  │                     │
                                                  └─── useEffect ──────┘
```

### Why Uncontrolled Mode

**Controlled mode** (`nodes=`/`edges=`) re-renders the entire React tree on every state change. During drag/pan/zoom this means thousands of re-renders per second — unusable for large graphs.

**Uncontrolled mode** lets React Flow manage its own internal state. Drag, pan, zoom are handled internally with zero React re-renders. External state is synced via effects only when needed (collapse, layout changes, Yjs updates).

The trade-off: you cannot intercept React Flow's render pipeline. You observe after the fact and push corrections, which means one frame of stale visuals before corrections land.

## The Feedback Loop Problem

The most common performance bug. Pattern:

1. Presentation model creates new node objects (position/style/size overrides)
2. `sortedNodes` reference changes → sync `useEffect` fires → `reactFlow.setNodes()`
3. React Flow re-measures → fires `onNodesChange` with dimension changes
4. Dimension changes update `nodes` state → triggers `usePresentation` again
5. Go to 1

### Prevention: Equality Guards

**Never create a new node object if the override values match the current values.** The presentation model must compare before spreading:

```typescript
// BAD — always creates new object, always triggers re-render
positionOverrides.set(id, computedPosition);

// GOOD — skip if unchanged, preserves object identity
if (cur.x !== pos.x || cur.y !== pos.y) {
  positionOverrides.set(id, pos);
}
```

Same for size overrides on organizers — compare `width`/`height` before overriding `style`.

**Key invariant:** When the presentation model's inputs are stable (no actual changes), it must return the same node array (by reference). If any node object is recreated unnecessarily, the sync effect fires, triggering a full cascade.

### Prevention: Skip Dimension Changes During Drag

`onNodesChange` receives dimension changes from React Flow's ResizeObserver. During drag, these are noise — content doesn't resize while dragging. Processing them during drag feeds the loop. The guard:

```typescript
if (change.type === 'dimensions' && !isDraggingRef.current) {
  dimensionChanges.push(change);
}
```

## Edge Re-render Storms

### The Problem

`DynamicAnchorEdge` uses `useStore` to read source/target node geometry for boundary-point pathfinding. When `reactFlow.setNodes()` replaces all nodes, every node reference in `nodeLookup` changes, every edge's store selector sees a "new" object, and every edge re-renders + recalculates `getSmoothStepPath`.

### The Fix: Value-Based Selectors

Extract only the geometry values needed and use a custom equality function:

```typescript
const sourceRect = useStore(
  useCallback((s) => {
    const n = s.nodeLookup.get(source);
    if (!n?.internals?.positionAbsolute || !n?.measured?.width) return null;
    return {
      x: n.internals.positionAbsolute.x,
      y: n.internals.positionAbsolute.y,
      width: n.measured.width,
      height: n.measured.height,
    };
  }, [source]),
  // Value equality — prevents re-render when position/size unchanged
  (a, b) => a?.x === b?.x && a?.y === b?.y && a?.width === b?.width && a?.height === b?.height,
);
```

**Rule:** Any `useStore` selector in an edge component must use a custom equality function that compares by value, not reference.

### getSmoothStepPath Cost

React Flow's `getSmoothStepPath` is non-trivial (step routing with offsets). For N edges, that's N path calculations per frame during interaction. If edge count grows large, consider:

- Simpler path functions (`getBezierPath`) for edges at low zoom
- Skipping path recalculation during pan/zoom (edges don't move relative to nodes)
- Edge virtualization (only render edges whose source/target are in viewport)

## Designing New Visual Features

### Safe Patterns (no perf risk)

- **Read-only presentation transforms** that add `hidden` flags or select components — no feedback loop possible since they don't change dimensions/positions
- **LOD-based component dispatch** — switching between pill/default variants based on zoom level; React Flow handles zoom internally
- **Edge styling** (color, width, dash) — changing SVG attributes without recalculating paths

### Risky Patterns (need equality guards)

- **Auto-sizing** anything based on measured content — creates the measure→compute→set cycle
- **Position overrides** from layout algorithms — must compare before writing
- **Style overrides** that affect DOM dimensions (`width`, `height`, `padding`) — triggers ResizeObserver
- **Adding/removing nodes** in the presentation layer — changes node count, triggers full reconciliation

### Forbidden Patterns

- **Controlled mode** (`nodes=` prop) — kills drag/pan/zoom performance
- **Reading `reactFlow.getNodes()` inside useMemo** — stale closures, or worse, subscribes to all changes
- **Calling `reactFlow.setNodes()` outside useEffect** — synchronous state update during render
- **Store selectors that return derived objects without equality functions** — re-render on every store tick
- **Writing positions to RF + Yjs but skipping local state** — cascade overwrites RF from stale local state on next trigger (the "snap-back" bug)

## The Three-Layer Write Rule

Carta has three layers of node state that must stay in sync:

```
Layer 1: Yjs Y.Doc           — persistence + collaboration (source of truth)
Layer 2: Local React state    — nodes/setNodes/setNodesLocal (drives the cascade)
Layer 3: React Flow internal  — reactFlow.setNodes() (what's rendered)
```

**Any operation that changes node positions or dimensions must write to all three layers.** Skipping layer 2 causes a "snap-back" bug: the cascade sync effect pushes stale layer-2 positions into RF on the next trigger (zoom, pan, any state change).

```typescript
// CORRECT — write to all three layers
const applyPositions = (nds: Node[]) => nds.map(n => {
  const pos = newPositions.get(n.id);
  return pos ? { ...n, position: pos } : n;
});
reactFlow.setNodes(applyPositions);   // Layer 3: immediate visual update
setNodesLocal(applyPositions);        // Layer 2: keeps cascade in sync
adapter.patchNodes?.(patches);        // Layer 1: persists to Yjs

// WRONG — skips layer 2, cascade overwrites layer 3 on next trigger
reactFlow.setNodes(applyPositions);   // Layer 3 ✓
adapter.patchNodes?.(patches);        // Layer 1 ✓
// Layer 2 still has old positions → next cascade snap-back
```

**Exception: selection-only changes.** Toggling `selected` flags via `reactFlow.setNodes()` without updating local state is safe because the cascade sync effect preserves RF's current selection when it runs. Selection is visual-only state that doesn't persist.

### Diagnosis

If positions "snap back" after zoom/pan/any interaction:
1. Find the function that set the positions
2. Check if it writes to all three layers
3. Add the missing `setNodesLocal()` call

## The setNodes Blast Radius

`reactFlow.setNodes(allNodes)` replaces every node in the internal lookup. This means:

1. Every `useStore(s => s.nodeLookup.get(id))` selector fires (O(edges))
2. Every node's ResizeObserver may re-trigger (O(nodes))
3. React Flow does internal reconciliation (O(nodes))

**Prefer `reactFlow.updateNode(id, changes)` for single-node updates** when possible. It only touches one entry in the lookup, limiting the blast radius.

The sync effect in Map.tsx currently uses `setNodes` for all updates because the presentation model may change multiple nodes simultaneously (layout strategies). This is acceptable as long as equality guards prevent it from firing when nothing changed.

## Diagnosis Checklist

When investigating performance issues:

1. **Is usePresentation creating new node objects unnecessarily?**
   - Check: Are equality guards present for all position/size/style overrides?
   - Check: Does the output array preserve identity when inputs are unchanged?

2. **Is the sync effect firing too often?**
   - Check: Add `console.log('sync effect')` in the `useEffect` at Map.tsx ~line 727
   - If it fires continuously, something in the memo chain is creating new references

3. **Are edges re-rendering in bulk?**
   - Check: React DevTools Profiler → look for DynamicAnchorEdge re-renders
   - Check: Are store selectors using value-based equality?

4. **Is onNodesChange processing unnecessary changes?**
   - Check: Is the `isDraggingRef` guard in place?
   - Check: Are dimension changes being batched?

5. **Do position-changing operations write to all three layers?**
   - Check: Does the function call `setNodesLocal()` in addition to `reactFlow.setNodes()` and `adapter.patchNodes()`?
   - Symptom: positions snap back on zoom/pan/any interaction
   - Fix: Add the missing `setNodesLocal()` call

6. **Is the ResizeObserver looping?**
   - Symptom: "ResizeObserver loop completed with undelivered notifications" warning
   - Cause: Style override → resize → dimension change → state update → new style override
   - Fix: Equality guard on the style override

## Do NOT

- Switch to controlled mode to "simplify" the architecture — it will destroy interaction performance
- Add new `useStore` selectors in edge/node components without custom equality functions
- Create new sync effects that call `reactFlow.setNodes()` — consolidate into the existing one
- Use `requestAnimationFrame` as a "fix" for render loops — it just throttles the loop without fixing the root cause
