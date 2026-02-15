---
name: yjs-rf-sync-expert
description: Expert on canvas synchronization, d3-zoom viewport, resize/drag persistence, dimension handling, and state ownership. Invoke when debugging canvas interaction bugs (pan/zoom, drag, connections, snap-back, lost dimensions) or designing new write-back paths.
---

# yjs-rf-sync-expert

Diagnoses and resolves synchronization and interaction bugs across Carta's canvas layers: Yjs (source of truth), React state (pipeline), and the rendering layer. The primary canvas is **MapV2** (canvas-engine based, no React Flow). Legacy Map.tsx (React Flow) still exists but is being replaced.

## When This Triggers

- Resize doesn't persist / snaps back to old size
- Drag is hitchy or positions snap back
- Children don't move with parent organizer during drag
- Pan/zoom interferes with drag or connections
- Connection drag doesn't work / conflicts with viewport
- Layout actions don't visually update
- Style changes lost after interaction
- Dimension/position state ownership questions
- Designing new write-back paths (e.g., new interactions that modify node state)
- d3-zoom event filtering or coordinate transform issues
- Stale closure bugs in event handlers

## Related Skills

- `/react-flow-expert` — RF-specific performance, edge rendering (legacy Map.tsx only)
- `.docs/02-system/11-canvas-engine.md` — canvas engine primitives
- `.docs/02-system/04-decisions/06-yjs-authoritative-layout.md` — ADR for Yjs-authoritative architecture
- `.docs/02-system/10-canvas-data-pipelines.md` — pipeline documentation

## Investigation Protocol

### Step 1: Identify which canvas

```
MapV2.tsx  → canvas-engine, d3-zoom, no RF, two-layer sync
Map.tsx    → React Flow, three-layer sync with guards (legacy, being removed)
```

If MapV2: follow the **Canvas Engine** sections below.
If Map.tsx (legacy): skip to the **Legacy: React Flow Architecture** section at the bottom.

### Step 2: Read the current code

Always read these files before diagnosing — they change frequently:

```
packages/web-client/src/components/canvas/MapV2.tsx         # Main canvas: drag, resize, position rendering
packages/web-client/src/hooks/useNodes.ts                   # Yjs observer → React state
packages/web-client/src/stores/adapters/yjsAdapter.ts       # patchNodes, getNodes, Yjs transact
packages/web-client/src/canvas-engine/                      # useViewport, useConnectionDrag, useNodeDrag
```

### Step 3: Trace the data flow

For any bug, trace the complete path for the relevant interaction type (see diagrams below).

---

## React Execution Model & Closure Mechanics

Understanding why sync bugs happen requires understanding JavaScript's single-threaded event loop, React's batched rendering, and closures.

### JavaScript Event Loop

JS is single-threaded. One call stack, one thing executing at a time. Browser events (clicks, pointer moves) queue callbacks. The event loop pulls callbacks off the queue when the call stack is empty. Each callback **runs to completion** — nothing interrupts it.

```
┌─────────────────────────────┐
│         Call Stack           │  ← currently executing function
│  (one function at a time)   │
└──────────────┬──────────────┘
               │ when empty, pull next from:
┌──────────────▼──────────────┐
│        Task Queue            │  ← click handlers, setTimeout callbacks,
│  (FIFO queue of callbacks)  │     pointer events, Yjs observer callbacks
└─────────────────────────────┘
```

**Implication for React**: `setState()` doesn't update the value mid-function. It queues work for React. The current function finishes first, THEN React re-renders.

### Closures

A closure is any function that references a variable from an outer scope. The function captures a **pointer to the environment record** (a heap-allocated struct holding the outer scope's variables). If the outer scope has ended, the environment record stays alive because the closure holds a reference.

**How to spot one**: look at the function body. If any variable is NOT a parameter and NOT a global, it was captured from an enclosing scope.

```typescript
function MyComponent() {
  const [count, setCount] = useState(0);
  // Every render creates a NEW environment record: { count: <current value> }

  const handler = () => console.log(count);
  // `handler` captures this render's environment. It will always see
  // the `count` value from the render when it was created.

  return <button onClick={handler}>Click</button>;
}
```

### Stale Closures — The Root Cause of Snap-Back Bugs

A stale closure occurs when a function outlives the render that created it, and reads outdated values from its captured environment.

**Timeline of the drag snap-back bug we fixed:**

```
1. pointermove fires → onDrag → setDragOffsets(new Map with offsets)
   - React queues a re-render but hasn't run it yet
   - The current closure's `dragOffsets` is still the OLD empty Map

2. pointerup fires IMMEDIATELY (same frame, next task in queue)
   → onDragEnd reads dragOffsets from its closure → gets empty Map (stale!)
   → Writes position + 0 to Yjs → node snaps back

3. React finally re-renders with the new dragOffsets → too late
```

The native `pointerup` event fires synchronously before React has a chance to re-render. The `onDragEnd` function was created during the previous render, so it captured the old `dragOffsets` value.

### Ref vs State — When to Use Each

| | `useState` | `useRef` |
|--|--|--|
| Stored as | Slot in React's internal array | `{ current: value }` object |
| On update | Schedules re-render, new value on next render | Immediate mutation, no re-render |
| In closures | Captured by value (stale in old closures) | Captured by reference (always current) |
| Use for | Data that affects what's rendered | Data that event handlers need synchronously |

**The ref fix pattern** (used for dragOffsets):
```typescript
const [dragOffsets, setDragOffsets] = useState(new Map());
const dragOffsetsRef = useRef(dragOffsets);

// On update: write to BOTH
setDragOffsets(newMap);         // Triggers re-render (for visual updates)
dragOffsetsRef.current = newMap; // Immediate (for event handlers)

// In native event handler:
function onDragEnd() {
  const offsets = dragOffsetsRef.current; // Always current, not stale
}
```

### The callbacksRef Pattern

Used in `useNodeDrag.ts`. Problem: native event listeners need to call the latest version of a callback, but re-subscribing on every render is wasteful.

```typescript
// useNodeDrag stores callbacks in a ref:
const callbacksRef = useRef(options.callbacks);
useEffect(() => { callbacksRef.current = options.callbacks; }, [options.callbacks]);

// Native pointer handler (created once per drag, lives across renders):
const handlePointerMove = (e: PointerEvent) => {
  // Reads .current at call time → always the latest callbacks
  // The closure captured `callbacksRef` (the ref OBJECT, which never changes)
  // NOT the callbacks themselves
  callbacksRef.current.onDrag?.(nodeId, cumulativeX, cumulativeY);
};

window.addEventListener('pointermove', handlePointerMove);
// Subscribe once. Never re-subscribe. Always calls latest callback.
```

Without this pattern, you'd need to remove/re-add the event listener every render (expensive and can miss events during the swap).

### Decision Framework for New Interactions

When writing a callback that modifies or reads canvas state:

| Question | Answer | Pattern |
|----------|--------|---------|
| Does this callback need to trigger a visual update? | Yes | `useState` + `setState` |
| Does this callback read data that changes between renders? | Yes | Read from `ref.current`, not from state closure |
| Is this attached to a native DOM event (pointer, keyboard)? | Yes | **Must** use refs for any state it reads |
| Is this responding to a user action (click, drop)? | Yes | Do the work in the handler, not in a `useEffect` |
| Does this need to run once and stay attached? | Yes | `callbacksRef` pattern |

---

## Canvas Engine Architecture (MapV2)

Two layers, no sync module, no guards:

```
┌──────────────────────────────────────────────────────────┐
│                    Yjs Y.Doc                              │
│  Source of truth for: positions, dimensions, field values │
│  Write via: adapter.patchNodes(), adapter.updateNode()    │
│  Read via: adapter.getNodes()                             │
└──────────────────┬───────────────────────────────────────┘
                   │ Yjs observer
                   ▼
┌──────────────────────────────────────────────────────────┐
│              useNodes React State                         │
│  setNodesState(adapter.getNodes())                        │
│  No guards. No suppression. Always accepts Yjs state.     │
└──────────────────┬───────────────────────────────────────┘
                   │ props / useMemo pipeline
                   ▼
┌──────────────────────────────────────────────────────────┐
│         MapV2.tsx Rendering                                │
│  useViewport() → d3-zoom transform                        │
│  Nodes rendered as positioned divs in transform group     │
│  Edges rendered as SVG in transform group                 │
│  Drag via useNodeDrag → dragOffsets (React state + ref)   │
│  Commit on drop → adapter.patchNodes()                    │
│  No sync module. No guards. Two layers only.              │
└──────────────────────────────────────────────────────────┘
```

### Why No Guards Are Needed

With React Flow, a "sync module" pushed Yjs state into RF's internal Zustand store. During drag, RF owned position internally, so the sync module had to be suppressed (guarded) to avoid fighting. This created timing-sensitive bugs.

With the canvas engine, there is no internal store to fight with. React state IS the rendering input. During drag, visual position is `node.position + dragOffset` — Yjs is not touched until drop. There is no race.

### State Ownership Rules (MapV2)

| Interaction | During | Write-Back | Visual Mechanism |
|-------------|--------|------------|------------------|
| **Drag** | `dragOffsets` (state + ref) | `onDragEnd` → `adapter.patchNodes(patches, 'drag-commit')` | `absPosition + dragOffset` |
| **Resize** | `resizeDeltas` (React state) | `onResizeEnd` → `adapter.patchNodes(patches)` | `width + dw`, `height + dh` |
| **Layout action** | Yjs owns everything | `adapter.patchNodes()` → observer → re-render | Direct from Yjs state |
| **Collapse/expand** | Yjs | `adapter.updateNode()` → observer → re-render | Direct from Yjs state |
| **Fit-to-children** | Yjs | `adapter.patchNodes()` → observer → re-render | Direct from Yjs state |

### Data Flow: Drag

```
pointerdown on node
  → useNodeDrag records origin position
  → onDragStart callback stores origin in dragOriginRef

pointermove (delta from origin)
  → onDrag callback fires with (nodeId, deltaX, deltaY)
  → builds allIdsToMove (selected nodes + wagon followers)
  → setDragOffsets(map of id → { dx, dy })
  → ALSO updates dragOffsetsRef.current (for onDragEnd to read synchronously)
  → React re-renders:
      absX = node.position.x + parent?.position.x + dragOffset.dx
      children follow via parent offset resolution (no explicit child offsets needed)

pointerup
  → onDragEnd fires (native event — React may not have re-rendered yet)
  → reads from dragOffsetsRef.current (NOT from closure — avoids stale data)
  → for each id in offsets: compute new position = old + offset
  → adapter.patchNodes(patches, 'drag-commit')
  → fitToChildren for parent organizers of moved nodes
  → setDragOffsets(new Map()) + dragOffsetsRef.current = new Map()
  → Yjs observer fires → React re-renders with committed positions
```

### Parent-Child Position Resolution

Children have **relative** positions. The rendering code computes absolute position:

```typescript
let absX = node.position.x;
let absY = node.position.y;
if (node.parentId) {
  const parent = sortedNodes.find(p => p.id === node.parentId);
  if (parent) {
    absX += parent.position.x;
    absY += parent.position.y;
    // Parent's drag offset propagates to children automatically
    const parentOffset = dragOffsets.get(parent.id);
    if (parentOffset) {
      absX += parentOffset.dx;
      absY += parentOffset.dy;
    }
  }
}
// Then apply this node's own drag offset (if directly dragged)
const offset = dragOffsets.get(node.id);
if (offset) { absX += offset.dx; absY += offset.dy; }
```

**Key insight**: Children don't need explicit drag offsets. Dragging a parent organizer only patches the parent's position in Yjs. Children's relative positions stay the same — they move because the absolute position calculation includes the parent.

### Data Flow: Layout Action

```
Layout function called (e.g., grid, spread, flow)
  → reads adapter.getNodes() — always consistent, no staleness
  → computes new positions/sizes (pure function)
  → adapter.patchNodes(patches) — default origin
  → Yjs observer fires synchronously at end of transact()
  → useNodes calls setNodesState(adapter.getNodes())
  → React re-renders MapV2 with new positions
  → Done. One hop.
```

### Data Flow: Resize

```
pointerdown on resize handle
  → onResizeStart: records initial dimensions, sets resizingNodeId

pointermove
  → onResize: updates resizeDeltas state ({ dw, dh })
  → React re-renders with width + dw, height + dh

pointerup
  → onResizeEnd: computes final dimensions
  → adapter.patchNodes([{ id, style: { width, height } }])
  → clears resizingNodeId and resizeDeltas
  → Yjs observer fires → re-render with committed dimensions
```

## Common Bugs and Fixes (Canvas Engine)

### Bug: Drag snaps back to old position (stale closure)

**Symptoms**: Node drag works visually, but on release the node jumps back to where it was before the drag.

**Root cause**: `onDragEnd` reads `dragOffsets` from a stale closure. `setDragOffsets` is batched by React and hasn't taken effect when the native `pointerup` fires.

**Fix**: Mirror drag offsets in a ref. Write to both `setDragOffsets(newMap)` and `dragOffsetsRef.current = newMap` in `onDrag`. Read from `dragOffsetsRef.current` in `onDragEnd`.

**General principle**: Any native event handler that needs React state must read it from a ref, not from the closure.

### Bug: Organizer drag snaps back / children don't follow

**Symptoms**: Dragging an organizer visually moves only the organizer, children stay put. On drop, organizer snaps back OR children are displaced.

**Root cause**: The absolute position calculation for children doesn't include the parent's drag offset.

**Fix**: When computing `absX/absY` for a child, also add `dragOffsets.get(parent.id)`. Children follow the parent visually during drag, and on drop only the parent's Yjs position is committed (children have relative positions).

### Bug: Edges don't follow nodes during drag

**Symptoms**: Nodes move visually during drag but edge endpoints stay anchored to the pre-drag positions.

**Root cause**: `renderEdges` computes node positions from `sortedNodes` (Yjs state) without applying drag offsets. Also `dragOffsets` may not be in the `useCallback` dependency array.

**Fix**: Apply drag offsets in `renderEdges` node rect calculation (same `getAbsolutePosition` logic as node rendering). Add `dragOffsets` to the useCallback dependency array.

### Bug: Layout action doesn't visually update

**Symptoms**: Layout writes to Yjs but nodes don't move.

**Root cause**: The `sortedNodes` memo didn't recompute (referential equality — Yjs observer returned the same array reference, or a useMemo dependency is missing).

**Diagnosis**:
1. Verify Yjs was actually written (read adapter.getNodes() after patchNodes)
2. Check useNodes observer fired (add console.log)
3. Check sortedNodes memo dependencies

### Bug: patchNodes replaces entire style object

**Symptoms**: Writing `{ width, height }` via patchNodes loses other style properties.

**Root cause**: `ynode.set('style', style)` replaces the entire style key. It doesn't merge.

**Fix**: Merge styles:
```typescript
if (style) {
  const existing = ynode.get('style') as Record<string, unknown> | undefined;
  ynode.set('style', existing ? { ...yToPlain(existing), ...style } : style);
}
```

## d3-zoom & Viewport Debugging

### d3-zoom Event Model

d3-zoom attaches **native DOM listeners** (not React synthetic events) to the container element:

```
mousedown.zoom    → initiates pan (drag to pan)
wheel.zoom        → zoom in/out
dblclick.zoom     → zoom on double-click
touchstart.zoom   → mobile pan/pinch initiation
touchmove.zoom    → mobile pan/pinch
touchend.zoom     → mobile gesture end
```

**Critical**: React's `stopPropagation()` does NOT prevent d3 from seeing events because they are separate event systems (React synthetic vs native DOM).

### Preventing Pan on Interactive Elements

Use d3-zoom's `.filter()` function — NOT React `stopPropagation`:

```typescript
d3Zoom().filter((event) => {
  if (event.type === 'wheel') return true;  // always allow zoom
  const target = event.target as HTMLElement;
  if (target.closest?.('[data-no-pan]')) return false;  // skip interactive elements
  return true;
})
```

Mark interactive elements with `data-no-pan="true"`:
- Node wrapper divs (prevent pan when clicking/dragging nodes)
- Connection handle source elements (prevent pan during connection drag)
- UI overlay elements (header bar, toolbars)

### Common d3-zoom Bugs

- **Pan triggers during node drag**: d3-zoom's native `mousedown` fires on the container even when clicking child elements. Fix: `.filter()` with `event.target.closest('[data-no-pan]')`.
- **Background dots only show in corner**: `<svg>` has no explicit `width`/`height` (defaults to 300x150). Fix: Add `width="100%" height="100%"`.
- **fitView computes wrong bounds**: `getBoundingClientRect()` returns zeros before layout. Fix: Delay fitView until container is measured.

## patchNodes Behavior

Located in `yjsAdapter.ts`. Key behaviors:

```typescript
patchNodes(patches, origin = 'layout') {
  ydoc.transact(() => {
    for (const { id, position, style } of patches) {
      const ynode = pageNodes.get(id);
      if (position) ynode.set('position', position);   // Plain object, NOT Y.Map
      if (style) ynode.set('style', style);             // Plain object, replaces entire style
    }
  }, origin);
}
```

- **Position**: set as plain `{ x, y }` object
- **Style**: set as plain `{ width, height }` object — **replaces entire style key**
- **Origin**: defaults to `'layout'`, can be `'drag-commit'` for drag end
- **Sync**: The Yjs observer fires synchronously at end of `transact()`, calling `adapter.getNodes()` → `setNodesState()`

## Do NOT

- Introduce guards or suppression refs in MapV2 — the two-layer architecture doesn't need them
- Write to Yjs during drag (only on drop) — in-flight drag state lives in `dragOffsets`
- Assume children need explicit drag offsets — they follow via parent offset resolution
- Use `queueMicrotask` for deferred work — timing relative to React commit phase is unpredictable
- Add a sync module / useEffect that pushes state from one store to another — that's the RF pattern
- Read React state from native event handlers without a ref — closures will be stale
- Store event handlers as useEffect dependencies without the callbacksRef pattern — causes constant re-subscription

---

## Legacy: React Flow Architecture (Map.tsx)

> **Note**: Map.tsx is being replaced by MapV2. This section is minimal — enough for transition debugging.

### Three-Layer Sync

```
Yjs Y.Doc
  → Yjs observer → useNodes (with guard: suppressUpdatesRef)
  → Enhancement pipeline (useMemo chain) → sortedNodes
  → Sync module (useEffect [sortedNodes])
    → Guards: suppressUpdates, isDraggingRef, resizingNodeIds
    → reactFlow.setNodes(updater) with Object.assign
  → React Flow renders
```

The sync module is the source of most RF bugs. During drag/resize, RF owns position internally, so the sync module must be suppressed. Guards must survive the full Yjs round-trip:

```
Interaction active → guard ON → Write-back to Yjs → guard still ON
→ Yjs observer fires → guard still ON → Sync module SKIPS
→ guard OFF (after requestAnimationFrame) → Next sync runs safely
```

### Key RF Bugs

- **Resize/drag snaps back**: Sync module pushes stale state before round-trip completes. Fix: keep guards ON through at least one animation frame.
- **"Parent node not found"**: `adapter.getNodes()` returns arbitrary order; RF requires parent-before-child. Fix: topological sort.
- **Stale reads**: `reactFlow.getNodes()` returns stale data after `setNodes()` in the same sync block. Fix: pass known positions as parameters.
