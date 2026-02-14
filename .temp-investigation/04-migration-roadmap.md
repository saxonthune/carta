# Migration Roadmap: LayoutView → Metamap → Map

Replace React Flow incrementally across three canvas instances, from simplest to most complex. Each phase produces a working app — no big-bang cutover.

## Why This Order

| Canvas | RF Features Used | Complexity | Risk |
|--------|-----------------|------------|------|
| **LayoutView** | Pan/zoom, drag, connect, fitView, background | LOW | Isolated overlay, no Yjs sync, own local state |
| **Metamap** | Pan/zoom, drag, connect, click, selection, fitView | MEDIUM | Own state (not Yjs-backed), but richer interactions |
| **Map** | Everything — drag, resize, sync module, selection, LOD, context menus | HIGH | The sync tax lives here; this is the payoff |

LayoutView is the perfect proving ground: it's a self-contained overlay with ~250 lines, uses local React state (no Yjs), has no sync module, and exercises the core RF features (viewport, drag, connections). If the replacement works here, we know the primitives are solid before touching Map.tsx.

---

## Phase 1: LayoutView (Proving Ground)

**Goal**: Build the core `<Canvas>` component and connection system. Validate d3-zoom, node rendering, dragging, and connections work correctly.

**Scope**: Replace LayoutView.tsx and LayoutOrganizerNode.tsx to use zero RF imports.

**New shared code produced**:
- `useViewport(containerRef)` — d3-zoom hook (pan/zoom/fitView/screenToCanvas)
- `<CanvasViewport>` — container div with transform, world div, SVG edge layer
- `useDrag(nodeRef, callbacks)` — d3-drag or pointer-event drag hook
- `useConnectionDrag()` — drag-from-handle-to-handle with validation
- `<ConnectionHandle>` — replacement for `<Handle>`, just a div with pointer events
- Edge rendering in SVG (default straight/bezier paths)

**What it proves**:
- d3-zoom works in our React architecture
- Drag doesn't conflict with pan (event coordination)
- Connection drag UX is acceptable
- Node positioning and measurement work

**Estimated effort**: 1-2 sessions. ~400-500 lines of new shared infrastructure.

**Verification**: Open Layout View, pan/zoom, drag organizers, create/delete pin constraints, test layout. Compare behavior to current RF version.

---

## Phase 2: Metamap (Rich Interactions)

**Goal**: Validate the shared canvas primitives handle a more complex canvas with selection, node click, edge click, and the Metamap's schema-editing interactions.

**Scope**: Replace Metamap.tsx's RF usage with shared canvas components.

**New shared code produced**:
- `useSelection()` — click-to-select, shift-add, lasso box
- `<SelectionBox>` — SVG rect overlay during lasso
- Click handlers (node click, edge click, pane click)
- Node measurement store (for DynamicAnchorEdge-style edge routing, if Metamap uses it)

**Additional Metamap-specific work**:
- Schema node rendering (already custom — just needs new positioning wrapper)
- Schema edge rendering (currently uses default RF edges, not DynamicAnchorEdge)
- Metamap's own drag-stop handler (writes schema positions to Yjs)
- Metamap's connection handler (creates schema relationships)

**What it proves**:
- Selection system works (click, shift, lasso)
- Canvas primitives handle a real-world canvas with ~50+ nodes
- Metamap's Yjs write-back on drag-stop works without guards (since there's no sync module — Metamap manages its own state)

**Estimated effort**: 1-2 sessions. ~200-300 lines of new shared code + Metamap-specific migration.

**Verification**: Open Metamap, create/edit/delete schemas, drag schema nodes, connect schemas, select multiple, verify positions persist.

---

## Phase 3: Map (The Payoff)

**Goal**: Eliminate the sync module and all guard machinery. This is where the architectural win materializes.

**Scope**: Replace Map.tsx's RF usage. This is the largest change but also the one that eliminates the most complexity.

**New shared code produced**:
- `<NodeResizeHandles>` — replacement for `<NodeResizer>`, writes directly to Yjs
- Node measurement store integration with DynamicAnchorEdge
- LOD band from viewport zoom (replaces `useStore(s => s.transform[2])`)

**What gets deleted from Map.tsx**:
- Sync module useEffect (~20 lines)
- `isDraggingRef`, `resizingNodeIds`, `suppressUpdates` guards (~40 lines)
- `onNodesChange` handler with dimension/drag change routing (~50 lines)
- `applyNodeChanges` / `applyEdgeChanges` usage
- `initialRenderRef` / first-render skip
- `defaultNodes` / `defaultEdges` (uncontrolled mode)
- All `reactFlow.setNodes()` calls throughout Map.tsx

**What changes in Map.tsx**:
- Direct pointer-event drag handlers write to Yjs on drag-stop
- Resize handles write to Yjs on resize-end (no guard needed — no sync module to race)
- Selection is React state (no RF internal selection)
- Node rendering is direct (components in positioned divs)
- Edge rendering reads from our measurement store
- LOD reads zoom from our viewport hook

**What stays the same**:
- All node visual components (ConstructNode variants, OrganizerNode visual rendering)
- Enhancement pipeline (nodesWithHiddenFlags → nodesWithCallbacks → sortedNodes)
- Edge bundling, aggregation, validation, waypoint routing
- Context menus, keyboard shortcuts, clipboard
- Organizer drag attach/detach logic (just uses our drag instead of RF's)
- useLayoutActions (simplified — stops calling `reactFlow.setNodes()`, just patches Yjs)

**Estimated effort**: 2-4 sessions. Highest complexity.

**Verification**: Full E2E test suite. Manual testing of drag, resize, selection, connections, layout actions, collapse/expand, LOD rendering, context menus, undo/redo.

---

## Shared Infrastructure Built Across Phases

| Component | Built In | Used By |
|-----------|----------|---------|
| `useViewport` | Phase 1 | All three canvases |
| `<CanvasViewport>` | Phase 1 | All three canvases |
| `useDrag` | Phase 1 | All three canvases |
| `useConnectionDrag` | Phase 1 | LayoutView, Metamap, Map |
| `<ConnectionHandle>` | Phase 1 | All node components |
| Edge SVG layer | Phase 1 | All three canvases |
| `useSelection` | Phase 2 | Metamap, Map |
| `<SelectionBox>` | Phase 2 | Metamap, Map |
| Node measurement store | Phase 2 | Map (DynamicAnchorEdge) |
| `<NodeResizeHandles>` | Phase 3 | Map only |
| LOD viewport zoom | Phase 3 | Map only |

---

## Risk Checkpoints

After each phase, evaluate before proceeding:

1. **After Phase 1**: Does d3-zoom feel right? Any jank on trackpad pinch? Does connection drag UX match or exceed RF's? If connection drag feels worse, consider keeping RF just for Map.tsx and accepting the sync tax.

2. **After Phase 2**: Does selection work correctly with shift/meta? Does lasso feel responsive? Any edge cases with Metamap's more complex node interactions? If yes, shared primitives are proven.

3. **After Phase 3**: Run full test suite. Check resize persistence (the bug that started this investigation). Check drag smoothness. Check layout action responsiveness. If all pass, remove `@xyflow/react` from package.json.

---

## Rollback Strategy

Each phase is independently revertible:
- Phase 1: LayoutView is an overlay — old version is one `git revert` away
- Phase 2: Metamap is a separate route/panel — same story
- Phase 3: Map.tsx is the main canvas — this is the hardest to revert, but if Phases 1-2 went well, confidence should be high

If Phase 3 proves too complex, the fallback is: keep RF for Map.tsx only, apply targeted fixes (onResizeEnd, better guard timing), and accept the sync module as permanent infrastructure. Phases 1-2 still reduce RF surface area.

---

## Timeline Estimate

| Phase | Sessions | Prerequisite |
|-------|----------|-------------|
| Phase 1: LayoutView | 1-2 | None |
| Phase 2: Metamap | 1-2 | Phase 1 complete |
| Phase 3: Map | 2-4 | Phase 2 complete |
| Cleanup & RF removal | 1 | Phase 3 complete |
| **Total** | **5-9 sessions** | |

Each "session" is one focused `/execute-plan` run or equivalent interactive session.
