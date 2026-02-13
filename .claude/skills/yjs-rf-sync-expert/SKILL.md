---
name: yjs-rf-sync-expert
description: Expert on Yjs ↔ React Flow synchronization, resize/drag persistence, dimension handling, and state ownership. Invoke when debugging sync bugs (snap-back, lost dimensions, hitchy interactions) or designing new write-back paths.
---

# yjs-rf-sync-expert

Diagnoses and resolves synchronization bugs between Yjs (source of truth), React state (pipeline), and React Flow (renderer). Understands the Yjs-authoritative architecture, the sync module, resize/drag ownership rules, and common timing pitfalls.

## When This Triggers

- Resize doesn't persist / snaps back to old size
- Drag is hitchy or positions snap back
- "Parent node not found" errors
- Layout actions don't visually update
- Style changes lost after interaction
- Dimension/position state ownership questions
- Designing new write-back paths (e.g., new interactions that modify node state)

## Related Skills

- `/react-flow-expert` — broader RF performance, edge rendering, presentation layer
- `.docs/02-system/04-decisions/06-yjs-authoritative-layout.md` — ADR for the architecture
- `.docs/02-system/10-canvas-data-pipelines.md` — pipeline documentation

## Investigation Protocol

### Step 1: Read the current sync code

Always read these files before diagnosing — they change frequently:

```
packages/web-client/src/components/canvas/Map.tsx        # Sync module, onNodesChange, enhancement pipeline
packages/web-client/src/hooks/useNodes.ts                # Yjs observer → React state
packages/web-client/src/stores/adapters/yjsAdapter.ts    # patchNodes, getNodes, Yjs transact
```

### Step 2: Check React Flow API reference

For any RF-specific behavior, **always check the official docs**:

```
https://reactflow.dev/api-reference/components/node-resizer     # NodeResizer, onResizeEnd
https://reactflow.dev/api-reference/types/node-change            # NodeChange types, dimensions
https://reactflow.dev/api-reference/types/resize-params           # ResizeParams (x, y, width, height)
https://reactflow.dev/api-reference/react-flow                    # ReactFlow props, onNodesChange
https://reactflow.dev/api-reference/hooks/use-react-flow          # setNodes, getNodes, updateNode
```

Use `WebFetch` to read these pages when the issue involves RF internal behavior. RF's behavior has changed across versions and documentation is the authoritative source.

### Step 3: Check known xyflow issues

Search GitHub issues for related bugs:

```
https://github.com/xyflow/xyflow/issues
```

Key known issues:
- **#5508**: dimension changes fire even when resize is rejected (shouldResize=false). Fixed in 12.8.5.
- **#3946**: setNodes in uncontrolled mode loses computed dimensions. Fixed.
- **#5523**: setNodes has no effect (regression).
- **#4739**: NodeResizer height issue with programmatic changes.

### Step 4: Trace the data flow

For any bug, trace the complete path:

```
User interaction
  → RF internal state change
    → onNodesChange fires (what change types? what values?)
      → Map.tsx handler processes changes
        → Writes to Yjs via adapter.patchNodes
          → Yjs observer fires
            → useNodes setNodesState(adapter.getNodes())
              → Enhancement pipeline (Map.tsx useMemo chain)
                → sortedNodes changes
                  → Sync module useEffect fires
                    → reactFlow.setNodes(updater)
                      → RF renders with new state
```

At each step, ask: "Is the data correct here? Is anything stale?"

## Architecture: Yjs-Authoritative Layout

```
┌──────────────────────────────────────────────────────────┐
│                    Yjs Y.Doc                              │
│  Source of truth for: positions, dimensions, field values │
│  Write via: adapter.patchNodes(), adapter.setNodes()      │
│  Read via: adapter.getNodes()                             │
└──────────────────┬───────────────────────────────────────┘
                   │ Yjs observer
                   ▼
┌──────────────────────────────────────────────────────────┐
│              useNodes React State                         │
│  setNodesState(adapter.getNodes())                        │
│  Guard: suppressUpdatesRef (skip during drag)             │
└──────────────────┬───────────────────────────────────────┘
                   │ props/memo chain
                   ▼
┌──────────────────────────────────────────────────────────┐
│         Map.tsx Enhancement Pipeline                      │
│  nodes → nodesWithHiddenFlags → nodesWithCallbacks        │
│  → sortedNodes (parent-before-child, search filter)       │
└──────────────────┬───────────────────────────────────────┘
                   │ useEffect [sortedNodes]
                   ▼
┌──────────────────────────────────────────────────────────┐
│           Sync Module (useEffect in Map.tsx)              │
│  Guards: suppressUpdates, isDraggingRef, resizingNodeIds  │
│  Pushes: position, style, data, hidden, parentId, type    │
│  Preserves: RF internals (measured, width, height, etc.)  │
│  Method: reactFlow.setNodes(updater) with Object.assign   │
└──────────────────────────────────────────────────────────┘
```

## State Ownership Rules

| Interaction | Owner During | Write-Back Point | Guard |
|-------------|-------------|-------------------|-------|
| **Drag** | RF owns position | `onNodeDragStop` → patchNodes (origin: 'drag-commit') | `suppressUpdates`, `isDraggingRef` |
| **Resize** | RF owns style.width/height | `onNodesChange` dimension with `resizing: false` → patchNodes | `resizingNodeIds` |
| **Layout action** | Yjs owns everything | `adapter.patchNodes()` → observer → sync module | None needed (sync module pushes) |
| **Collapse/expand** | Yjs owns visibility | `adapter.updateNode()` → observer → sync module | None needed |
| **Fit-to-children** | Yjs owns organizer size | `adapter.patchNodes()` → observer → sync module | None needed |

### Critical Rule: Guards Must Survive the Full Cycle

When RF owns state (drag, resize), the sync module must NOT push during the interaction AND for the full Yjs round-trip after write-back:

```
Interaction active   → guard ON
Write-back to Yjs    → guard still ON
Yjs observer fires   → guard still ON
React re-renders     → guard still ON
Sync module runs     → guard ON, so SKIPS
                     → guard OFF (after requestAnimationFrame)
Next sync module run → has correct Yjs data, pushes safely
```

If the guard clears too early, the sync module pushes stale data from the previous render cycle, undoing the interaction.

## Common Bugs and Fixes

### Bug: Resize doesn't persist / snaps back

**Symptoms**: Organizer resize visually works during drag, but snaps back to old size on release.

**Root cause**: The sync module pushes stale `style` from `sortedNodes` before the Yjs round-trip completes with the new dimensions.

**Diagnosis**:
1. Check `resizingNodeIds` clearing — is it cleared before or after the sync module processes the new data?
2. Check `patchNodes` — does it write `style` as expected?
3. Check `adapter.getNodes()` — does it read back the correct style?

**Fix pattern**: Keep `resizingNodeIds` populated through at least one animation frame after resize ends:
```typescript
requestAnimationFrame(() => { resizingNodeIds.current.delete(id); });
```

**Alternative (more robust)**: Use `onResizeEnd` callback on NodeResizer instead of detecting resize end from `onNodesChange` dimension changes. `onResizeEnd` provides `{ x, y, width, height }` directly.

### Bug: Drag is hitchy

**Symptoms**: Nodes stutter during drag, jumping between positions.

**Root cause**: The sync module is running during drag, pushing Yjs positions (which lag behind RF's in-flight position) back to RF.

**Diagnosis**:
1. Check `isDraggingRef` guard in the sync module
2. Check `suppressUpdates` guard in useNodes observer

**Fix**: Both guards must be ON during drag:
```typescript
// Sync module guard
if (suppressUpdates.current || isDraggingRef.current || resizingNodeIds.current.size > 0) return;
```

### Bug: "Parent node not found"

**Symptoms**: Console error from RF about missing parent node.

**Root cause**: `adapter.getNodes()` returns nodes in arbitrary order. RF requires parent nodes before children in the array.

**Diagnosis**: Check if `sortedNodes` includes topological sort (parent-before-child).

**Fix**: The enhancement pipeline must sort nodes so parents appear before children.

### Bug: patchNodes replaces entire style object

**Symptoms**: Writing `{ width, height }` via patchNodes loses other style properties (e.g., color-related styles).

**Root cause**: `ynode.set('style', style)` replaces the entire style key. It doesn't merge.

**Diagnosis**: Check yjsAdapter.ts `patchNodes` — does it do `ynode.set('style', style)` or merge?

**Fix**: Merge styles instead of replacing:
```typescript
if (style) {
  const existing = ynode.get('style') as Record<string, unknown> | undefined;
  ynode.set('style', existing ? { ...yToPlain(existing), ...style } : style);
}
```

### Bug: Layout action doesn't visually update

**Symptoms**: Layout action writes to Yjs but RF doesn't reflect the change.

**Root cause**: Sync module skipped (guard was ON), or the enhancement pipeline didn't create new objects (memo cache hit).

**Diagnosis**:
1. Add `console.log` in the sync module to check if it fires
2. Check if `sortedNodes` reference actually changed
3. Check if guards are incorrectly active

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

## React Flow API Quick Reference

For detailed API, always fetch from reactflow.dev. Key types:

```typescript
// NodeChange types relevant to sync
type NodeDimensionChange = {
  type: 'dimensions';
  id: string;
  dimensions?: { width: number; height: number };
  resizing?: boolean;  // true during resize, false/undefined otherwise
};

type NodePositionChange = {
  type: 'position';
  id: string;
  position?: { x: number; y: number };
  dragging?: boolean;  // true during drag
};

// NodeResizer callbacks
interface NodeResizerProps {
  onResizeStart?: (event: D3DragEvent, params: ResizeParams & { direction: ResizeControlVariant }) => void;
  onResize?: (event: D3DragEvent, params: ResizeParams & { direction: ResizeControlVariant }) => void;
  onResizeEnd?: (event: D3DragEvent, params: ResizeParams & { direction: ResizeControlVariant }) => void;
  shouldResize?: (event: D3DragEvent, params: ResizeParams & { direction: ResizeControlVariant }) => boolean;
}

// ResizeParams
type ResizeParams = { x: number; y: number; width: number; height: number };
```

## Do NOT

- Clear interaction guards (resizingNodeIds, isDraggingRef) synchronously — always delay via requestAnimationFrame or later
- Read `reactFlow.getNodes()` immediately after `reactFlow.setNodes()` — returns stale data (doc05.03)
- Write to RF and Yjs but skip React local state — causes snap-back on next sync cycle
- Use `queueMicrotask` for guard clearing — may fire before React commit phase completes
- Assume RF's `onNodesChange` fires in a predictable order relative to React state updates
