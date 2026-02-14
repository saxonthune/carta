# LayoutView Replacement: Detailed Plan

## Current State

LayoutView is a full-screen overlay (`z-50`, `absolute inset-0`) inside Map.tsx that shows organizers as draggable rectangles with 8 directional connection handles. Users drag connections between handles to create pin constraints (e.g., "Organizer A is NE of Organizer B"). It's a self-contained mini-canvas with its own ReactFlow instance wrapped in ReactFlowProvider.

### Current RF Usage (LayoutView.tsx, 255 lines)

| RF API | Usage |
|--------|-------|
| `<ReactFlow>` | Canvas with nodes, edges, fitView |
| `<ReactFlowProvider>` | Context wrapper |
| `<Background>` | Dot grid |
| `applyNodeChanges` | Apply drag position changes to local state |
| `onNodesChange` | Receive drag events |
| `onConnect` | Receive new connections |
| `isValidConnection` | Validate connection (no self-loops, correct handles) |
| `onEdgeContextMenu` | Right-click on constraint edge |
| `fitView` + `fitViewOptions` | Auto-fit on mount |
| `proOptions` | Hide attribution |
| `nodeTypes` | Register LayoutOrganizerNode |

### Current RF Usage (LayoutOrganizerNode.tsx, 122 lines)

| RF API | Usage |
|--------|-------|
| `<Handle>` (×9) | 8 directional source handles + 1 body target handle |
| `Position` enum | Handle positioning (Top, Right, Bottom, Left) |
| `type NodeProps` | Component prop type |

### Data Flow (Simple)

```
allNodes (from useNodes) → filter organizers → local state
                                                    ↓
                                              ReactFlow renders
                                                    ↓
                                         drag → applyNodeChanges → local state
                                         connect → addConstraint (Yjs)
```

No sync module. No guards. No Yjs write-back for positions (drag is local-only in layout view). Connections write directly to the pin constraints Yjs map.

---

## Features to Implement

### 1. Viewport: Pan, Zoom, Fit

**What it does**: Pan by dragging background, zoom with wheel/pinch, fit all nodes on mount.

**Implementation**:
```
useViewport(containerRef) → { transform, fitView, screenToCanvas }
```

- Attach d3-zoom to container div
- CSS transform on inner "world" div: `translate(${tx}px, ${ty}px) scale(${k})`
- `fitView(nodeRects, padding)`: compute bounding box of all nodes, set transform to center and scale
- `screenToCanvas(screenX, screenY)`: invert transform

**Acceptance criteria**:
- [ ] Wheel zoom works (smooth, centered on cursor)
- [ ] Trackpad pinch zoom works
- [ ] Pan by mouse drag (any button for LayoutView — it has no selection mode)
- [ ] Fit to view on mount (all organizers visible with padding)
- [ ] Min zoom 0.15, max zoom 2 (match current)

### 2. Node Rendering

**What it does**: Render LayoutOrganizerNode components in positioned divs.

**Implementation**:
```tsx
<div className="canvas-world" style={{ transform: `...` }}>
  {localNodes.map(node => (
    <div key={node.id} style={{ position: 'absolute', left: node.position.x, top: node.position.y, ...node.style }}>
      <LayoutOrganizerNode data={node.data} id={node.id} />
    </div>
  ))}
</div>
```

No parent-child nesting needed (all LayoutView nodes are top-level).
No measurement needed (nodes have explicit width/height from organizer style).
No hidden nodes.
No LOD.

**Acceptance criteria**:
- [ ] Organizers render at correct positions
- [ ] Organizer names display correctly (including wagon "Name → Construct" format)
- [ ] Organizer colors render correctly (background tint + border)

### 3. Node Dragging

**What it does**: Drag organizer nodes to reposition them. Local-only (no Yjs write-back).

**Implementation**: Pointer events on the drag handle (`.drag-handle` class).

```typescript
// On the node wrapper div (or specifically the drag handle)
onPointerDown → capture, track start position
onPointerMove → update node position in local state (accounting for zoom scale)
onPointerUp → release capture
```

Key detail: delta must be divided by zoom scale (`transform.k`) to convert screen pixels to canvas pixels.

Alternatively, use d3-drag which handles zoom-aware deltas automatically if configured.

**Design decision**: d3-drag vs raw pointer events.
- d3-drag: Consistent with d3-zoom, handles edge cases, but adds coupling
- Pointer events: Simpler, no dependency, full control
- **Recommendation**: Start with pointer events. LayoutView only has a drag handle (not full-node drag), so it's straightforward. If d3-drag proves necessary for Map.tsx later, can retrofit.

**Acceptance criteria**:
- [ ] Drag via drag handle bar (not entire node body — body is the connection target)
- [ ] Smooth dragging at all zoom levels
- [ ] Drag doesn't trigger pan (stopPropagation on drag handle)
- [ ] Multiple organizers can be dragged independently
- [ ] Position updates visually during drag (not just on drop)

### 4. Connection System

**What it does**: Drag from a directional handle (N, NE, E, SE, S, SW, W, NW) on one organizer to the body of another organizer. Creates a pin constraint.

This is the most complex feature in LayoutView and the most valuable to prototype.

**Implementation**:

```
State: connectionDrag = { sourceNodeId, sourceHandle, currentX, currentY } | null

On handle pointerdown:
  → set connectionDrag = { sourceNodeId, sourceHandle, screenX, screenY }
  → add pointermove/pointerup listeners to window

On pointermove:
  → update connectionDrag.currentX/Y
  → render preview SVG line from handle position to cursor

On pointerup:
  → hit-test: is cursor over another organizer's body?
  → if yes + valid connection → call addConstraint
  → clear connectionDrag state
```

**Handle rendering** (replaces `<Handle>`):
```tsx
// Directional source handles — small circles at 8 compass positions
{DIRECTION_HANDLES.map(({ id, style, Icon }) => (
  <div
    key={id}
    className="connection-handle"
    style={{ position: 'absolute', ...style, width: 14, height: 14, ... }}
    onPointerDown={(e) => startConnection(nodeId, id, e)}
  >
    <Icon size={8} weight="bold" />
  </div>
))}

// Body target — invisible div covering entire node
<div
  className="connection-target"
  data-node-id={nodeId}
  style={{ position: 'absolute', inset: 0 }}
/>
```

**Hit testing on drop**: Find the `.connection-target` element under the cursor using `document.elementFromPoint()`, read `data-node-id`.

**Connection preview line**: SVG line in an overlay layer.
```tsx
{connectionDrag && (
  <svg className="connection-preview" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
    <line
      x1={handleScreenX} y1={handleScreenY}
      x2={connectionDrag.currentX} y2={connectionDrag.currentY}
      stroke="var(--color-accent)" strokeWidth={2} strokeDasharray="5,5"
    />
  </svg>
)}
```

**Validation** (same logic as current):
- No self-loops (source !== target)
- Source handle must be a valid direction (N, NE, E, etc.)
- Target must be a body handle

**Acceptance criteria**:
- [ ] Can drag from any directional handle
- [ ] Preview line renders during drag
- [ ] Dropping on another organizer's body creates a constraint
- [ ] Dropping on empty space does nothing
- [ ] Self-loops rejected
- [ ] New constraint appears as edge immediately
- [ ] Constraint is written to Yjs (persists)

### 5. Edge Rendering

**What it does**: Render pin constraint edges as lines between organizers. Show labels ("A NE of B").

**Implementation**: SVG layer behind (or in front of) nodes.

```tsx
<svg className="edge-layer" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
  {localEdges.map(edge => {
    const sourceNode = nodesById.get(edge.source);
    const targetNode = nodesById.get(edge.target);
    if (!sourceNode || !targetNode) return null;

    // Compute handle position from source node + handle id
    const sourcePos = getHandlePosition(sourceNode, edge.sourceHandle);
    // Target is center of target node (body handle)
    const targetPos = getNodeCenter(targetNode);

    return (
      <g key={edge.id} style={{ pointerEvents: 'auto' }} onContextMenu={(e) => onEdgeContextMenu(e, edge)}>
        <line x1={sourcePos.x} y1={sourcePos.y} x2={targetPos.x} y2={targetPos.y}
              stroke="var(--color-accent)" strokeWidth={1.5} />
        {edge.label && (
          <text x={(sourcePos.x + targetPos.x) / 2} y={(sourcePos.y + targetPos.y) / 2}
                textAnchor="middle" fontSize={11} fill="var(--color-content-muted)">
            {edge.label}
          </text>
        )}
      </g>
    );
  })}
</svg>
```

`getHandlePosition`: Compute absolute position of a directional handle from node position + size + handle compass direction.

**Acceptance criteria**:
- [ ] Constraint edges render as lines from handle to target node center
- [ ] Edge labels display correctly
- [ ] Right-click on edge opens context menu
- [ ] Delete constraint from context menu removes edge

### 6. Background

**What it does**: Dot grid pattern.

**Implementation**: SVG pattern in the edge layer or a separate background SVG.

```tsx
<svg className="background" style={{ position: 'absolute', inset: 0 }}>
  <defs>
    <pattern id="dots" width={16} height={16} patternUnits="userSpaceOnUse"
             patternTransform={`translate(${tx}, ${ty}) scale(${k})`}>
      <circle cx={1} cy={1} r={1} fill="var(--color-dot-grid)" />
    </pattern>
  </defs>
  <rect width="100%" height="100%" fill="url(#dots)" />
</svg>
```

**Acceptance criteria**:
- [ ] Dot grid renders
- [ ] Dots move with pan and scale with zoom

### 7. Edge Context Menu

Already custom (uses `ContextMenuPrimitive`). No RF dependency. Just wire up the right-click handler on SVG edge elements.

**Acceptance criteria**:
- [ ] Right-click constraint edge → "Delete Constraint" menu
- [ ] Delete removes constraint from Yjs

---

## Files to Create / Modify

### New Files

| File | Purpose | Est. Lines |
|------|---------|-----------|
| `src/components/canvas/viewport/useViewport.ts` | d3-zoom hook | 80-100 |
| `src/components/canvas/viewport/CanvasViewport.tsx` | Container + world + SVG layers | 60-80 |
| `src/components/canvas/viewport/useNodeDrag.ts` | Pointer-event drag hook | 60-80 |
| `src/components/canvas/viewport/useConnectionDrag.ts` | Connection drag state + hit testing | 100-140 |
| `src/components/canvas/viewport/ConnectionHandle.tsx` | Handle replacement component | 30-40 |
| `src/components/canvas/viewport/index.ts` | Barrel export | 10 |

### Modified Files

| File | Change |
|------|--------|
| `LayoutView.tsx` | Replace RF with CanvasViewport + hooks |
| `LayoutOrganizerNode.tsx` | Replace `<Handle>` with `<ConnectionHandle>`, remove RF imports |

### Unchanged Files

| File | Why |
|------|-----|
| `ContextMenuPrimitive.tsx` | Already custom |
| `usePinConstraints.ts` | No RF dependency |

---

## Verification Plan

### Automated

No existing tests for LayoutView (it's a visual overlay). After replacement:

1. **Build passes**: `pnpm build` — no TypeScript errors, no RF imports in new files
2. **Existing tests pass**: `pnpm test` — nothing should break (LayoutView isn't tested)
3. **Import check**: `grep -r '@xyflow/react' src/components/canvas/LayoutView.tsx src/components/canvas/LayoutOrganizerNode.tsx` → 0 results

### Manual Testing Checklist

Open Layout View (toolbar button in Map.tsx):

**Viewport**:
- [ ] Canvas renders with dot grid background
- [ ] All organizers visible on open (fitView)
- [ ] Wheel zoom (centered on cursor)
- [ ] Trackpad pinch zoom
- [ ] Pan by dragging empty space
- [ ] Pan by dragging with middle mouse button
- [ ] Zoom limits work (can't zoom below 0.15 or above 2)

**Nodes**:
- [ ] Each top-level organizer appears as a colored rectangle
- [ ] Wagon organizers appear with "Name → Construct" label
- [ ] 8 directional handles visible on each organizer
- [ ] Drag handle bar visible at top of each organizer

**Dragging**:
- [ ] Drag organizer via drag handle — smooth, no jank
- [ ] Drag at zoomed-in level — moves correct distance
- [ ] Drag at zoomed-out level — moves correct distance
- [ ] Dragging one organizer doesn't move others
- [ ] Clicking (not dragging) on handle doesn't start drag

**Connections**:
- [ ] Drag from N handle — preview line appears
- [ ] Drag to another organizer body — constraint created
- [ ] Drag to empty space — nothing happens (no error)
- [ ] Drag to same organizer — rejected (no self-loop)
- [ ] All 8 handle directions work (N, NE, E, SE, S, SW, W, NW)
- [ ] New constraint edge appears immediately with label

**Edges**:
- [ ] Existing pin constraints render as labeled lines
- [ ] Right-click on edge → context menu appears
- [ ] "Delete Constraint" removes the edge
- [ ] Edge label reads correctly (e.g., "Hooks NE of State")

**Test Layout button**:
- [ ] Click "Test Layout" → organizers reposition according to constraints
- [ ] Positions update smoothly

**Close**:
- [ ] "Close" button returns to main canvas
- [ ] Main canvas is unaffected

### Comparison Test

With the old RF version available on another branch:
1. Open Layout View on both
2. Compare visual appearance (should be identical)
3. Compare interaction feel (pan, zoom, drag, connect)
4. Note any differences in connection snap behavior (RF snaps to handles within radius — our version uses hit-test which may feel different)

---

## Open Questions

1. **Connection snapping**: RF has `connectionRadius={50}` — the connection snaps to nearby handles during drag. Our hit-test approach (`elementFromPoint`) only works on drop. Do we need hover-based snap highlighting? For LayoutView, probably not — the target is the entire organizer body, not a small handle. But for Map.tsx later, we will.

2. **d3-zoom as dependency**: Should we add `d3-zoom` as a direct dependency, or vendor/inline the subset we need? It's small (~5kb) and stable. Recommendation: add as dependency.

3. **Edge rendering layer order**: Should edges render above or below nodes? RF renders edges below. For LayoutView's simple case, below is fine. For Map.tsx later, we'll want edges below nodes but labels above (current behavior via SVG layer ordering).

4. **Viewport directory**: `src/components/canvas/viewport/` — good location? Or `src/canvas-engine/`? Using `viewport/` keeps it colocated with canvas components. Can move later if it grows.
