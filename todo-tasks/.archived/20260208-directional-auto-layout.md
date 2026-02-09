# Directional Auto-Layout

> **Scope**: new feature
> **Files**: 1 new, 1 modified
> **Summary**: Add a hierarchical top-to-bottom layout algorithm that arranges nodes by edge-flow direction.

## Motivation

The existing layout algorithms (spreadNodes, compactNodes) arrange nodes in a grid without edge awareness. For data flow, dependency chains, or architectural layers, users need a layout that positions sources at top, sinks at bottom, and minimizes edge crossings.

## Resolved Decisions

- **Scope**: Top-level nodes only. Organizers are treated as single nodes in the layout. No per-organizer grouping.
- **Direction**: TB (top-to-bottom) only. LR can be added later.
- **Cycles**: DFS-based back-edge breaking (standard Sugiyama approach).

## Files to Modify

### 1. NEW: `packages/web-client/src/utils/hierarchicalLayout.ts`

Pure layout function. Follow the exact pattern from `spreadNodes.ts`:

**Input type** — reuse `SpreadInput` from `spreadNodes.ts`:
```typescript
import type { SpreadInput } from './spreadNodes';
```

**Function signature:**
```typescript
export function hierarchicalLayout(
  nodes: SpreadInput[],
  edges: Array<{ source: string; target: string }>,
  options?: { gap?: number; layerGap?: number }
): Map<string, { x: number; y: number }>
```

**Default options:** `gap = 40` (horizontal between nodes in same layer), `layerGap = 80` (vertical between layers).

**Algorithm steps:**

1. **Build adjacency.** Create `Map<string, string[]>` for outgoing edges (source→targets). Only include edges where both source and target are in the `nodes` array.

2. **Break cycles.** DFS from each unvisited node. Track visiting (gray) vs visited (black) nodes. When a back-edge is detected (target is gray), remove it from the adjacency map. Collect removed edges to restore later (not needed for layout, but good for correctness checking).

3. **Assign layers (longest-path).** For the DAG, compute longest path from any source (in-degree 0) to each node. This is the node's layer. Nodes with no incoming edges get layer 0. Use BFS/topological sort:
   ```
   for each node in topological order:
     layer[node] = max(layer[pred] + 1 for pred in predecessors) or 0 if no predecessors
   ```
   Disconnected nodes (no edges at all) get layer 0.

4. **Order within layers (barycenter heuristic).** For each layer (top to bottom), compute each node's barycenter = average position index of connected nodes in the previous layer. Sort the layer by barycenter. Nodes with no connections to previous layer keep their relative order. Run 2 passes (down then up) for better results.

5. **Assign coordinates.**
   - Each layer is a horizontal row. Layers go top-to-bottom, spaced by `layerGap`.
   - Within each layer, nodes are spaced left-to-right by `gap`, using actual measured widths.
   - Center each layer horizontally (align layer centers).

6. **Preserve centroid.** Exactly like `spreadNodes.ts` lines 22-28 and 58-73:
   - Compute original centroid from input positions.
   - Compute new centroid from computed positions.
   - Shift all positions by the delta.

7. **Return** `Map<string, { x: number; y: number }>`.

**Early returns** (match `spreadNodes` pattern):
- Empty nodes → return empty map
- Single node → return its current position unchanged

### 2. MODIFY: `packages/web-client/src/components/canvas/Map.tsx`

**2a. Add import** (around line 16 where `spreadNodes` and `compactNodes` are imported):
```typescript
import { hierarchicalLayout } from '../../utils/hierarchicalLayout';
```

**2b. Add `handleHierarchicalLayout` callback** (after `handleCompactAll` at ~line 469). Follow the `handleCompactAll` pattern exactly:

```typescript
const handleHierarchicalLayout = useCallback(() => {
  const rfNodes = reactFlow.getNodes();
  const rfEdges = reactFlow.getEdges();

  // Top-level non-organizer nodes only
  const topLevel = rfNodes.filter(n => !n.parentId && n.type !== 'organizer');
  if (topLevel.length < 2) return;

  const inputs = topLevel.map(n => ({
    id: n.id,
    x: n.position.x,
    y: n.position.y,
    width: n.measured?.width ?? n.width ?? 200,
    height: n.measured?.height ?? n.height ?? 100,
  }));

  // Filter edges to only those between top-level nodes
  const topLevelIds = new Set(topLevel.map(n => n.id));
  const edges = rfEdges
    .filter(e => topLevelIds.has(e.source) && topLevelIds.has(e.target))
    .map(e => ({ source: e.source, target: e.target }));

  const newPositions = hierarchicalLayout(inputs, edges);
  if (newPositions.size === 0) return;

  const applyPositions = (nds: Node[]) => nds.map(n => {
    const pos = newPositions.get(n.id);
    return pos ? { ...n, position: pos } : n;
  });

  reactFlow.setNodes(applyPositions);
  setNodesLocal(applyPositions);
  const patches = [...newPositions].map(([id, position]) => ({ id, position }));
  if (patches.length > 0) {
    adapter.patchNodes?.(patches);
  }
}, [reactFlow, adapter, setNodesLocal]);
```

**2c. Add toolbar button** (after the Compact Layout `</ControlButton>` at ~line 1214, before the `{selectedNodeIds.length > 0 &&` conditional):

```tsx
<ControlButton onClick={handleHierarchicalLayout} title="Hierarchical Layout">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="3" r="2" />
    <circle cx="6" cy="12" r="2" />
    <circle cx="18" cy="12" r="2" />
    <circle cx="12" cy="21" r="2" />
    <line x1="12" y1="5" x2="6" y2="10" />
    <line x1="12" y1="5" x2="18" y2="10" />
    <line x1="6" y1="14" x2="12" y2="19" />
    <line x1="18" y1="14" x2="12" y2="19" />
  </svg>
</ControlButton>
```

This icon shows a tree/hierarchy shape (one node at top, two in middle, one at bottom with connecting lines).

## Constraints

- **`erasableSyntaxOnly`**: No `private`/`protected`/`public` constructor parameter shorthand.
- **No barrel export needed**: The util is imported directly by Map.tsx, not through a barrel.
- **Centroid preservation is required**: Camera must not jump after layout.
- **Pure function**: No React dependencies in `hierarchicalLayout.ts`.

## Verification

1. `pnpm build` — must pass (TypeScript compilation)
2. `pnpm test` — must pass (no regressions)
3. Manual: Open a document with flow-connected nodes, click the hierarchical layout button. Sources should be at top, sinks at bottom.
