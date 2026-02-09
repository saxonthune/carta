# De-Overlap Nodes Algorithm

> **Scope**: enhancement (replaces current spread-all behavior)
> **Layers touched**: web-client (pure utility function, canvas action)
> **Summary**: Replace the grid-based "spread all" with an overlap-removal algorithm that preserves original node positions — only moving nodes enough to eliminate overlaps, in the direction of their existing offset.

## Motivation

The current `spreadNodes()` rearranges nodes into a grid, destroying the user's spatial layout. Users position nodes deliberately to communicate structure (layers, clusters, flow direction). When nodes overlap after bulk creation or import, users need a "fix overlaps" action that respects their intent — not a full rearrangement.

## Design Constraint

`deOverlapNodes` is a **minimal displacement** algorithm: nodes that don't overlap MUST NOT move. Overlapping nodes push apart along the axis of least overlap. The result preserves the user's spatial intent.

## Do NOT

- Do NOT modify `OrganizerNode.tsx` — it delegates to `nodeActions.onSpreadChildren` which Map.tsx provides, so it gets the new behavior automatically.
- Do NOT remove `spreadNodes.ts` — keep it in the codebase (it's still importable if needed later).
- Do NOT add animation or transition logic.
- Do NOT add an MCP tool for this.
- Do NOT change `compactNodes.ts` or `handleCompactAll`.
- Do NOT change `handleHierarchicalLayout`.
- Do NOT use `private`/`protected`/`public` constructor parameter shorthand (erasableSyntaxOnly constraint).

## Files to Modify

### 1. CREATE `packages/web-client/src/utils/deOverlapNodes.ts`

New pure function. Import `SpreadInput` from `./spreadNodes`. Same return type as `spreadNodes` and `compactNodes`.

```typescript
import type { SpreadInput } from './spreadNodes';

/**
 * Removes overlaps between nodes by pushing them apart along the axis of least overlap.
 * Preserves original positions for non-overlapping nodes and maintains centroid.
 */
export function deOverlapNodes(
  nodes: SpreadInput[],
  padding = 20
): Map<string, { x: number; y: number }> {
  // ... implementation below
}
```

**Algorithm (pairwise iterative):**

```
1. Copy node positions into mutable array: { id, x, y, width, height }
2. Handle degenerate case: if any two nodes have identical center positions,
   add small random jitter (±3px) to break symmetry
3. Iterate up to 50 times:
   a. Set moved = false
   b. For each pair (i, j) where j > i:
      - Compute overlap on X axis: overlapX = (A.width + B.width)/2 + padding - |A.centerX - B.centerX|
      - Compute overlap on Y axis: overlapY = (A.height + B.height)/2 + padding - |A.centerY - B.centerY|
      - If overlapX > 0 AND overlapY > 0 (they overlap):
        - dx = A.centerX - B.centerX (or 1 if 0)
        - dy = A.centerY - B.centerY (or 1 if 0)
        - If overlapX < overlapY: push apart on X by overlapX/2 * sign(dx)
        - Else: push apart on Y by overlapY/2 * sign(dy)
        - Set moved = true
   c. If !moved, break (converged)
4. Compute centroid shift to preserve original centroid (same pattern as spreadNodes.ts)
5. Return Map of id → { x, y }
```

**Key details:**
- Centers are computed as `x + width/2`, `y + height/2`
- `sign(v)` returns 1 if v >= 0, -1 otherwise
- When dx=0 and dy=0 simultaneously for a pair, use dx=1, dy=1 as fallback direction
- The function returns positions for ALL input nodes (not just moved ones), shifted to preserve centroid

**Centroid preservation pattern** (copy from `spreadNodes.ts` lines 22-28 and 58-71):
```typescript
// Before: compute original centroid
let cx = 0, cy = 0;
for (const n of nodes) {
  cx += n.x + n.width / 2;
  cy += n.y + n.height / 2;
}
cx /= nodes.length;
cy /= nodes.length;

// ... run algorithm on mutable copies ...

// After: compute new centroid and shift
let ncx = 0, ncy = 0;
for (const p of positions) {
  ncx += p.x + p.w / 2;
  ncy += p.y + p.h / 2;
}
ncx /= positions.length;
ncy /= positions.length;

const dx = cx - ncx;
const dy = cy - ncy;
// Apply shift to all result positions
```

### 2. MODIFY `packages/web-client/src/components/canvas/Map.tsx`

**Step 2a: Update import** (around line 43-53)

Replace the `spreadNodes` import with `deOverlapNodes`:

```typescript
// Change:
import { spreadNodes } from '../../utils/spreadNodes';
// To:
import { deOverlapNodes } from '../../utils/deOverlapNodes';
```

Note: check if `spreadNodes` is imported anywhere else in this file. If it's ONLY used in `handleSpreadAll` and `handleSpreadChildren`, remove the import entirely. If used elsewhere, keep both imports.

**Step 2b: Update `handleSpreadAll`** (line 398-440)

Replace `spreadNodes(inputs)` call on line 420 with `deOverlapNodes(inputs)`. Everything else in the handler stays the same — the grouping-by-parentId logic, the three-layer update pattern, all identical.

**Step 2c: Update `handleSpreadChildren`** (line 512-537)

Replace `spreadNodes(inputs)` call on line 524 with `deOverlapNodes(inputs)`. Everything else stays the same.

**Step 2d: Rename toolbar button** (line 1239)

Change:
```tsx
<ControlButton onClick={handleSpreadAll} title="Spread All Nodes">
```
To:
```tsx
<ControlButton onClick={handleSpreadAll} title="Fix Overlaps">
```

**Step 2e: Replace toolbar icon** (lines 1240-1245)

Replace the current outward-arrows SVG with a new icon that suggests nodes being pushed apart. Use this icon — two overlapping rectangles with an arrow between them suggesting separation:

```tsx
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <rect x="2" y="6" width="8" height="8" rx="1" />
  <rect x="14" y="10" width="8" height="8" rx="1" />
  <path d="M10 13l4-4" />
  <polyline points="14 9 14 13 10 9" />
</svg>
```

Note: if that icon looks off, a simpler alternative — two rectangles with small outward arrows:
```tsx
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
  <rect x="3" y="5" width="7" height="6" rx="1" />
  <rect x="14" y="13" width="7" height="6" rx="1" />
  <line x1="8" y1="14" x2="4" y2="18" />
  <line x1="16" y1="10" x2="20" y2="6" />
</svg>
```

Use whichever looks more consistent with the existing toolbar icons (which use simple stroked paths, no fills). The key visual concept: two boxes moving apart.

## Implementation Steps

1. Create `packages/web-client/src/utils/deOverlapNodes.ts` with the algorithm described above
2. In `Map.tsx`, replace `import { spreadNodes }` with `import { deOverlapNodes }`
3. In `handleSpreadAll`, replace `spreadNodes(inputs)` → `deOverlapNodes(inputs)`
4. In `handleSpreadChildren`, replace `spreadNodes(inputs)` → `deOverlapNodes(inputs)`
5. Rename the toolbar button title from "Spread All Nodes" to "Fix Overlaps"
6. Replace the toolbar button SVG icon
7. Verify: `pnpm build && pnpm test`

## Constraints

- `erasableSyntaxOnly`: no `private`/`protected`/`public` constructor parameter shorthand
- Barrel exports use `.js` extensions (but this file is only imported within web-client via relative paths, so no `.js` needed)
- Follow the existing pattern: pure function in utils/, same `SpreadInput` input type, same `Map<string, {x,y}>` return

## Verification

- `pnpm build` — TypeScript compilation succeeds
- `pnpm test` — all existing tests pass (no tests directly test spreadNodes behavior, so no test changes needed)
- Manual verification: the algorithm should not move non-overlapping nodes

## Plan-specific checks

```bash
# deOverlapNodes.ts was created
test -f packages/web-client/src/utils/deOverlapNodes.ts

# Map.tsx imports deOverlapNodes, not spreadNodes
grep -q 'deOverlapNodes' packages/web-client/src/components/canvas/Map.tsx

# Map.tsx no longer imports spreadNodes (it should only import deOverlapNodes)
! grep -q "from '../../utils/spreadNodes'" packages/web-client/src/components/canvas/Map.tsx

# Button renamed
grep -q 'Fix Overlaps' packages/web-client/src/components/canvas/Map.tsx

# spreadNodes.ts still exists (not deleted)
test -f packages/web-client/src/utils/spreadNodes.ts

# OrganizerNode.tsx was NOT modified
git diff --name-only | grep -v OrganizerNode
```
