# Replacement Effort Estimate

What it takes to replace React Flow, piece by piece.

## Strategy: Use d3-zoom Directly

RF uses `d3-zoom` and `d3-drag` internally. We can use the same primitives directly, cutting out RF's opinionated layer. d3-zoom is ~5-7kb, battle-tested, handles wheel/pinch/touch, and provides coordinate transforms.

**Architecture**: A `<Canvas>` component that:
- Wraps a container div with d3-zoom attached
- Applies CSS `transform: translate(tx, ty) scale(k)` to an inner "world" div
- Renders nodes as absolutely-positioned divs inside the world div
- Renders edges in an SVG layer

This is essentially what RF does, minus the node/edge state management layer.

---

## Piece 1: Viewport (Pan/Zoom/Fit)

**What RF does**: Wheel zoom, mouse-button pan, pinch-to-zoom, fitView, animated viewport transitions, screenToFlowPosition.

**Replacement approach**: d3-zoom on a container div.

```typescript
// Pseudocode — the core viewport hook
function useViewport(containerRef: RefObject<HTMLDivElement>) {
  const [transform, setTransform] = useState({ x: 0, y: 0, k: 1 });

  useEffect(() => {
    const zoom = d3.zoom()
      .scaleExtent([0.15, 2])
      .on('zoom', (event) => setTransform(event.transform));

    d3.select(containerRef.current).call(zoom);
    return () => d3.select(containerRef.current).on('.zoom', null);
  }, []);

  const screenToCanvas = (screenX, screenY) => ({
    x: (screenX - transform.x) / transform.k,
    y: (screenY - transform.y) / transform.k,
  });

  const fitView = (nodeRects, padding = 0.1) => { /* compute bounds, set transform */ };

  return { transform, screenToCanvas, fitView, setTransform };
}
```

**Lines of code**: ~80-120
**Complexity**: LOW-MEDIUM. d3-zoom handles the hard stuff (wheel normalization, pinch gestures, momentum). We just wire it up.

**What we gain**: Direct control over zoom behavior, no need to go through RF's controlled/uncontrolled mode.

**Risk**: d3-zoom's interaction with React state. Well-documented pattern though — many d3+React examples exist.

---

## Piece 2: Node Rendering & Positioning

**What RF does**: Positions node divs via CSS transforms inside the viewport. Maintains a `nodeLookup` map. Measures nodes via ResizeObserver. Dispatches to custom node components via `nodeTypes`.

**Replacement approach**: Direct rendering.

```tsx
// In Canvas component
<div className="canvas-world" style={{ transform: `translate(${tx}px, ${ty}px) scale(${k})` }}>
  {nodes.map(node => {
    const Component = nodeTypes[node.type];
    const absPos = getAbsolutePosition(node, nodesById); // resolve parentId chain
    return (
      <div
        key={node.id}
        ref={el => measureNode(node.id, el)} // ResizeObserver
        style={{ position: 'absolute', left: absPos.x, top: absPos.y, ...node.style }}
        className={cn('canvas-node', { selected: node.selected })}
      >
        <Component data={node.data} id={node.id} selected={node.selected} />
      </div>
    );
  })}
</div>
```

**Lines of code**: ~100-150
**Complexity**: MEDIUM. The tricky parts:
- Parent-relative positioning (resolve `parentId` chain to absolute coords)
- Node measurement via ResizeObserver (need a measurement store for edge anchoring)
- Hidden node handling
- z-ordering (CSS z-index or render order)

**What we gain**: No more `useNodeId()` context — just pass `id` as a prop. No more `reactFlow.setNodes()` — just re-render.

---

## Piece 3: Node Dragging

**What RF does**: d3-drag on each node div. Multi-select drag. Drag threshold. Parent containment. Drag start/drag/stop callbacks.

**Replacement approach**: d3-drag or pointer events directly.

```typescript
function useDrag(nodeId: string, onDragStart, onDrag, onDragStop) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const drag = d3.drag()
      .filter(event => /* threshold, button check */)
      .on('start', (event) => onDragStart(nodeId, event))
      .on('drag', (event) => {
        // Move this node + all selected nodes by delta
        const dx = event.dx / transform.k; // account for zoom
        const dy = event.dy / transform.k;
        onDrag(nodeId, dx, dy);
      })
      .on('end', (event) => onDragStop(nodeId, event));

    d3.select(ref.current).call(drag);
  }, []);
}
```

**Lines of code**: ~120-180
**Complexity**: MEDIUM-HIGH. The tricky parts:
- Zoom-aware deltas (divide by scale)
- Multi-node drag (move all selected nodes)
- Drag threshold (5px before starting)
- Interaction with pan (d3-zoom and d3-drag can conflict — need to stop propagation)
- Organizer containment during drag
- The ctrl+drag attach/detach narrative hints (but this is already our code)

**What we gain**: Direct control over drag behavior. No more isDraggingRef guard — we directly update Yjs in onDragStop and React re-renders.

**Risk**: d3-drag + d3-zoom on the same element tree needs careful event coordination. RF solves this internally.

---

## Piece 4: Selection System

**What RF does**: Click-to-select (with shift/meta for add-to-selection). Lasso selection box. Selection change callback. Visual feedback via `.selected` class.

**Replacement approach**: Pointer events + a selection box component.

```typescript
// Click handler on node wrapper div
onClick={(e) => {
  if (e.shiftKey || e.metaKey) {
    toggleSelection(node.id);
  } else {
    setSelection([node.id]);
  }
}}

// Lasso: mousedown on background → track rect → find intersecting nodes
function useLassoSelection() {
  // onPointerDown on canvas background → start tracking
  // onPointerMove → update rect, find intersecting nodes
  // onPointerUp → commit selection
}
```

**Lines of code**: ~80-120
**Complexity**: MEDIUM. The tricky parts:
- Lasso selection box rendering (SVG rect overlay)
- Hit testing (point-in-rect for each visible node)
- Keyboard modifiers (shift-add, meta-toggle)
- Selection mode toggle (selectionOnDrag vs panOnDrag)

**What we gain**: Selection is just React state — no sync needed.

---

## Piece 5: Connection System

**What RF does**: Drag from Handle to Handle creates edges. Visual connection line during drag. Snap to nearby handles. Connection validation.

**Replacement approach**: Custom connection drag with pointer events.

```typescript
// On Handle mousedown → start connection drag
// Track mouse position → render preview SVG line
// On mouseup over another Handle → validate + create edge
// Snap: find nearest Handle within connectionRadius
```

**Lines of code**: ~150-250
**Complexity**: HIGH. The tricky parts:
- Handle positioning (absolute coords from nested node positions)
- Visual connection preview line during drag
- Snap-to-handle detection (spatial search within radius)
- Drop zone highlighting (`useConnection()` equivalent)
- Port polarity validation
- PortDrawer (expandable port list) interaction during connection drag

**What we gain**: Simpler Handle component — just a div with data attributes. No more Handle's internal connection machinery.

**Risk**: This is the most complex piece and the one where RF provides the most value. The connection drag UX is subtle (snapping, preview, validation feedback).

---

## Piece 6: Resize

**What RF does**: `<NodeResizer>` renders corner/edge handles. Drag to resize. Fires dimension changes.

**Replacement approach**: Custom resize handles with pointer events.

```typescript
function ResizeHandle({ nodeId, direction, onResize }) {
  const onPointerDown = (e) => {
    e.stopPropagation(); // don't start drag
    // Track pointer, compute new width/height, call onResize
  };
  return <div className={`resize-handle resize-${direction}`} onPointerDown={onPointerDown} />;
}
```

**Lines of code**: ~80-120
**Complexity**: MEDIUM. Standard resize-handle pattern.

**What we gain**: Resize directly writes to Yjs. No sync module race. No resizingNodeIds guard. No snap-back. This alone might justify the migration.

---

## Piece 7: Edge SVG Layer

**What RF does**: Renders edges in an SVG layer. Provides edge type dispatch. Edge click/hover handlers.

**Replacement approach**: SVG layer in the viewport.

```tsx
<svg className="canvas-edges" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
  <defs>{/* arrow markers */}</defs>
  {edges.map(edge => {
    const Component = edgeTypes[edge.type] || DynamicAnchorEdge;
    return <Component key={edge.id} {...computeEdgeProps(edge)} />;
  })}
</svg>
```

**Lines of code**: ~50-80
**Complexity**: LOW. DynamicAnchorEdge already does its own path calculation. We just need to provide source/target rects from our measurement store instead of from `useStore(s => s.nodeLookup)`.

---

## Piece 8: Misc Utilities

| Utility | Lines | Notes |
|---------|-------|-------|
| `applyNodeChanges` | 0 | Eliminated — no change stream, just React state |
| `applyEdgeChanges` | 0 | Eliminated |
| `addEdge` | ~5 | Trivial dedup |
| `getSmoothStepPath` | ~50 | Can inline or use a small SVG path library. Only used as fallback. |
| `Position` enum | ~5 | `type Position = 'top' \| 'bottom' \| 'left' \| 'right'` |
| Controls/ControlButton | 0 | Already just styled divs |
| Background dots | ~10 | SVG pattern |
| `getIntersectingNodes` | ~15 | AABB intersection test |

---

## Effort Summary

| Piece | Lines | Complexity | Eliminates |
|-------|-------|-----------|------------|
| Viewport (d3-zoom) | 80-120 | LOW-MEDIUM | RF viewport layer |
| Node rendering | 100-150 | MEDIUM | `reactFlow.setNodes()`, sync module |
| Dragging | 120-180 | MEDIUM-HIGH | isDraggingRef guard, suppressUpdates |
| Selection | 80-120 | MEDIUM | — |
| Connections | 150-250 | HIGH | Handle internals |
| Resize | 80-120 | MEDIUM | resizingNodeIds guard, snap-back bugs |
| Edge layer | 50-80 | LOW | useStore nodeLookup dependency |
| Misc | ~80 | LOW | applyNodeChanges, change stream |

**Total new code**: ~740-1100 lines
**Code eliminated**: ~200 lines of sync/guard machinery in Map.tsx, plus simplification across all files using RF hooks

---

## What Gets Eliminated

### Gone entirely:
- **Sync module** (~30 lines) — no more pushing to RF's internal state
- **Guard machinery** (~40 lines) — isDraggingRef, resizingNodeIds, suppressUpdates
- **applyNodeChanges/applyEdgeChanges** — no change stream pattern
- **Uncontrolled mode workarounds** — defaultNodes, initial render skip
- **`reactFlow.setNodes()` calls** throughout Map.tsx, useLayoutActions
- **Three-layer state sync** — entire category of bugs eliminated

### Simplified:
- **onNodesChange handler** (~80 lines) → direct event handlers on each interaction
- **useLayoutActions** — stops calling `reactFlow.setNodes()`, just writes to Yjs
- **DynamicAnchorEdge** — reads from our measurement store instead of RF's nodeLookup
- **useLodBand** — reads zoom from our viewport state instead of RF's store

### Unchanged:
- All node visual components (ConstructNode variants, OrganizerNode)
- All layout algorithms
- Yjs adapter, state management
- Edge bundling, validation, waypoint routing
- Context menus, keyboard shortcuts, clipboard
- AI integration

---

## Migration Strategy

### Option A: Big Bang
Replace RF in one pass. Estimated 3-5 focused sessions.
- Risk: Many things break at once
- Benefit: Clean break, no hybrid state

### Option B: Incremental (Recommended)
1. **Phase 1**: Build viewport layer (d3-zoom) alongside RF. Prove pan/zoom works.
2. **Phase 2**: Build node rendering layer. Switch one canvas view (LayoutView?) first.
3. **Phase 3**: Migrate Map.tsx — drag, selection, resize.
4. **Phase 4**: Connection system — last, because it's the most complex.
5. **Phase 5**: Remove RF dependency, clean up.

Each phase is independently testable and revertible.

### Option C: Targeted Fix
Don't replace RF. Instead, fix the specific pain points:
- Use `onResizeEnd` from NodeResizer instead of detecting from onNodesChange
- Use `onNodeDragStop` more directly
- Accept the sync module as a cost of RF

This is the least effort but doesn't eliminate the architectural root cause.

---

## Recommendation

**The sync module is the tax**. Every RF feature we use requires paying this tax. The question is whether 740-1100 lines of focused viewport/interaction code is worth eliminating an entire class of state-sync bugs.

Arguments for replacing:
- Eliminates all sync bugs by construction (not by guarding)
- Carta already does most of the visual work — RF is mostly a viewport + event dispatcher
- d3-zoom is what RF uses internally, so we're not trading proven code for homebrew
- Simpler mental model: Yjs → React → DOM (two layers, not three)

Arguments against:
- Connection drag is genuinely complex and RF's implementation is mature
- RF handles edge cases we haven't thought about (accessibility, mobile, keyboard nav)
- We'd own all the viewport interaction code ourselves
- Time investment for uncertain payoff if sync bugs can be fixed case-by-case
