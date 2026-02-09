# MCP Constraint-Based Layout — Phase 2a: Group, Distribute, Position

> **Scope**: enhancement
> **Layers touched**: domain (3 new constraint types), server (extend MCP tool schema)
> **Summary**: Add `group`, `distribute`, and `position` constraint types to `carta_arrange`. No edge data, no new strategies, no document layer changes.

## Motivation

Phase 1 delivered align/order/spacing — enough to tidy up layouts. Agents need richer vocabulary: clustering by type, distributing evenly, and anchoring to canvas guides. These three constraints operate on node positions alone (no edge data), so they slot cleanly into the existing sequential resolver.

## Design Constraint

**All three constraints follow the same contract as Phase 1 constraints**: they receive selected nodes + current positions, mutate positions in-place, and preserve centroid afterward (handled by the outer resolver). No new data plumbing needed.

## Do NOT

- **Do NOT add edge plumbing or edge-dependent features.** No `flow` constraint, no `force` strategy. Those are Phase 2b.
- **Do NOT modify `doc-operations.ts`.** The document layer is unchanged — `arrangeLayout()` already passes constraints through to the pure function.
- **Do NOT modify `document-server-core.ts`.** The REST endpoint already passes constraints through generically.
- **Do NOT add new strategies.** Only `grid` and `preserve` exist. Phase 2b adds `force`.
- **Do NOT add npm dependencies.** All algorithms are simple geometry.
- **Do NOT modify existing constraint handlers** (`applyAlignConstraint`, `applyOrderConstraint`, `applySpacingConstraint`). Only add new ones.
- **Do NOT touch web-client code.**
- **Do NOT add a `NodeSelector` variant based on field values** (e.g., `{ field: 'status', value: 'active' }`). Stick with the existing three selector forms: `'all'`, `{ constructType }`, `{ semanticIds }`.
- **Do NOT add a string predicate parser.** NodeSelector remains structured objects only.

## Files to Modify

| File | Change |
|------|--------|
| `packages/domain/src/utils/constraintLayout.ts` | Add 3 constraint type variants to `ArrangeConstraint` union, add 3 handler functions, add 3 cases to the switch in `computeArrangeLayout` |
| `packages/server/src/mcp/tools.ts` | Add 3 entries to `ArrangeConstraintSchema` discriminated union, update `carta_arrange` tool description |

**Only 2 files are modified.** The document layer and REST endpoint are generic over constraint types — they pass the constraints array through without inspecting individual types.

## Implementation Steps

### Step 1: Add constraint types to `ArrangeConstraint` union

In `packages/domain/src/utils/constraintLayout.ts`, expand the `ArrangeConstraint` type (currently lines 13-16):

```typescript
// Current:
export type ArrangeConstraint =
  | { type: 'align'; axis: 'x' | 'y'; nodes?: NodeSelector; alignment?: 'center' | 'min' | 'max' }
  | { type: 'order'; axis: 'x' | 'y'; by: 'field' | 'alphabetical'; field?: string; nodes?: NodeSelector }
  | { type: 'spacing'; min?: number; equal?: boolean; nodes?: NodeSelector };

// Replace with:
export type ArrangeConstraint =
  | { type: 'align'; axis: 'x' | 'y'; nodes?: NodeSelector; alignment?: 'center' | 'min' | 'max' }
  | { type: 'order'; axis: 'x' | 'y'; by: 'field' | 'alphabetical'; field?: string; nodes?: NodeSelector }
  | { type: 'spacing'; min?: number; equal?: boolean; nodes?: NodeSelector }
  | { type: 'group'; by: 'constructType' | 'field'; field?: string; axis?: 'x' | 'y'; groupGap?: number; nodes?: NodeSelector }
  | { type: 'distribute'; axis: 'x' | 'y'; spacing?: 'equal' | 'packed'; nodes?: NodeSelector }
  | { type: 'position'; anchor: 'top' | 'bottom' | 'left' | 'right' | 'center'; nodes?: NodeSelector; margin?: number };
```

Also update the comment from "Phase 1" to just "Constraint types":
```typescript
// Constraint types
```

### Step 2: Implement `applyGroupConstraint`

Add after `applySpacingConstraint` (after line 330):

```typescript
/**
 * Apply 'group' constraint: cluster nodes by constructType or field value.
 * Groups are arranged along the specified axis with groupGap between clusters.
 * Within each cluster, relative positions are preserved.
 */
function applyGroupConstraint(
  constraint: Extract<ArrangeConstraint, { type: 'group' }>,
  _nodes: ArrangeInput[],
  allNodes: ArrangeInput[],
  positions: PositionMap,
  nodeGap: number
): void {
  const selectedNodes = resolveSelector(constraint.nodes, allNodes);
  if (selectedNodes.length === 0) return;

  const { by, field, axis = 'x', groupGap } = constraint;
  const gap = groupGap ?? nodeGap * 2; // default: 2x normal gap

  // 1. Partition nodes into groups
  const groups = new Map<string, ArrangeInput[]>();
  for (const node of selectedNodes) {
    let key: string;
    if (by === 'constructType') {
      key = node.constructType;
    } else if (by === 'field' && field) {
      key = String(node.values[field] ?? '__undefined__');
    } else {
      key = node.constructType; // fallback
    }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(node);
  }

  // 2. Sort group keys alphabetically for deterministic output
  const sortedKeys = [...groups.keys()].sort();

  // 3. For each group, compute its bounding box in current positions
  const groupBounds: Array<{ key: string; nodes: ArrangeInput[]; minA: number; maxA: number; width: number }> = [];
  for (const key of sortedKeys) {
    const nodes = groups.get(key)!;
    const axisValues = nodes.map(n => positions[n.id]![axis]);
    const sizes = nodes.map(n => axis === 'x' ? n.width : n.height);
    const minA = Math.min(...axisValues);
    const maxA = Math.max(...axisValues.map((v, i) => v + sizes[i]!));
    groupBounds.push({ key, nodes, minA, maxA, width: maxA - minA });
  }

  // 4. Calculate original centroid of all selected nodes on this axis
  const allAxisValues = selectedNodes.map(n => positions[n.id]![axis]);
  const allSizes = selectedNodes.map(n => axis === 'x' ? n.width : n.height);
  const originalCenter = (Math.min(...allAxisValues) + Math.max(...allAxisValues.map((v, i) => v + allSizes[i]!))) / 2;

  // 5. Lay out groups sequentially along axis with groupGap
  const totalWidth = groupBounds.reduce((sum, g) => sum + g.width, 0) + (groupBounds.length - 1) * gap;
  let cursor = originalCenter - totalWidth / 2;

  for (const group of groupBounds) {
    // Shift all nodes in this group so group's min aligns with cursor
    const shift = cursor - group.minA;
    for (const node of group.nodes) {
      positions[node.id]![axis] += shift;
    }
    cursor += group.width + gap;
  }
}
```

### Step 3: Implement `applyDistributeConstraint`

Add after the group constraint:

```typescript
/**
 * Apply 'distribute' constraint: evenly distribute nodes along an axis.
 * 'equal' mode: equal center-to-center spacing (anchors first and last).
 * 'packed' mode: equal edge-to-edge gaps (anchors first and last).
 */
function applyDistributeConstraint(
  constraint: Extract<ArrangeConstraint, { type: 'distribute' }>,
  _nodes: ArrangeInput[],
  allNodes: ArrangeInput[],
  positions: PositionMap
): void {
  const selectedNodes = resolveSelector(constraint.nodes, allNodes);
  if (selectedNodes.length < 3) return; // need at least 3 to distribute

  const { axis, spacing = 'equal' } = constraint;

  // Sort nodes by current position on axis
  const sorted = [...selectedNodes].sort(
    (a, b) => positions[a.id]![axis] - positions[b.id]![axis]
  );

  const first = sorted[0]!;
  const last = sorted[sorted.length - 1]!;
  const firstPos = positions[first.id]![axis];
  const lastPos = positions[last.id]![axis];

  if (spacing === 'equal') {
    // Equal center-to-center spacing
    const totalSpan = lastPos - firstPos;
    const step = totalSpan / (sorted.length - 1);

    for (let i = 1; i < sorted.length - 1; i++) {
      positions[sorted[i]!.id]![axis] = firstPos + i * step;
    }
  } else {
    // Packed: equal edge-to-edge gaps
    const nodeSizes = sorted.map(n => axis === 'x' ? n.width : n.height);
    const totalNodeSize = nodeSizes.reduce((sum, s) => sum + s, 0);
    const lastSize = axis === 'x' ? last.width : last.height;
    const availableSpace = (lastPos + lastSize) - firstPos - totalNodeSize;
    const gapSize = availableSpace / (sorted.length - 1);

    let cursor = firstPos + nodeSizes[0]! + gapSize;
    for (let i = 1; i < sorted.length - 1; i++) {
      positions[sorted[i]!.id]![axis] = cursor;
      cursor += nodeSizes[i]! + gapSize;
    }
  }
}
```

### Step 4: Implement `applyPositionConstraint`

Add after the distribute constraint:

```typescript
/**
 * Apply 'position' constraint: anchor node set to a bounding box edge/center.
 * The bounding box is computed from ALL nodes (not just selected), giving a canvas reference frame.
 * 'margin' offsets from the edge inward.
 */
function applyPositionConstraint(
  constraint: Extract<ArrangeConstraint, { type: 'position' }>,
  _nodes: ArrangeInput[],
  allNodes: ArrangeInput[],
  positions: PositionMap
): void {
  const selectedNodes = resolveSelector(constraint.nodes, allNodes);
  if (selectedNodes.length === 0) return;

  const { anchor, margin = 0 } = constraint;

  // Compute bounding box of ALL nodes (full canvas extent)
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const node of allNodes) {
    const pos = positions[node.id];
    if (!pos) continue;
    minX = Math.min(minX, pos.x);
    maxX = Math.max(maxX, pos.x + node.width);
    minY = Math.min(minY, pos.y);
    maxY = Math.max(maxY, pos.y + node.height);
  }

  // Apply anchor
  for (const node of selectedNodes) {
    const pos = positions[node.id]!;
    switch (anchor) {
      case 'top':
        pos.y = minY + margin;
        break;
      case 'bottom':
        pos.y = maxY - node.height - margin;
        break;
      case 'left':
        pos.x = minX + margin;
        break;
      case 'right':
        pos.x = maxX - node.width - margin;
        break;
      case 'center': {
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        pos.x = centerX - node.width / 2;
        pos.y = centerY - node.height / 2;
        break;
      }
    }
  }
}
```

### Step 5: Wire new constraints into `computeArrangeLayout`

In the switch statement inside `computeArrangeLayout` (currently lines 356-367), add three cases:

```typescript
// Add after the 'spacing' case:
      case 'group':
        applyGroupConstraint(constraint, nodes, nodes, positions, nodeGap);
        break;
      case 'distribute':
        applyDistributeConstraint(constraint, nodes, nodes, positions);
        break;
      case 'position':
        applyPositionConstraint(constraint, nodes, nodes, positions);
        break;
```

### Step 6: Extend MCP schema in `packages/server/src/mcp/tools.ts`

In the `ArrangeConstraintSchema` discriminated union (currently lines 236-256), add three entries before the closing `]`:

```typescript
  // Add after the spacing entry:
  z.object({
    type: z.literal('group'),
    by: z.enum(['constructType', 'field']).describe('Group criterion'),
    field: z.string().optional().describe('Field name when by="field"'),
    axis: z.enum(['x', 'y']).optional().describe('Axis to arrange groups along (default: "x")'),
    groupGap: z.number().optional().describe('Gap between groups in px (default: 2x nodeGap)'),
    nodes: NodeSelectorSchema.optional(),
  }),
  z.object({
    type: z.literal('distribute'),
    axis: z.enum(['x', 'y']).describe('Axis to distribute along'),
    spacing: z.enum(['equal', 'packed']).optional().describe('"equal" for equal center-to-center, "packed" for equal edge-to-edge gaps (default: "equal")'),
    nodes: NodeSelectorSchema.optional(),
  }),
  z.object({
    type: z.literal('position'),
    anchor: z.enum(['top', 'bottom', 'left', 'right', 'center']).describe('Canvas edge or center to anchor to'),
    nodes: NodeSelectorSchema.optional(),
    margin: z.number().optional().describe('Offset from edge in px (default: 0)'),
  }),
```

### Step 7: Update tool description

Update the `carta_arrange` tool description (line 498) to mention the new constraints:

```typescript
description: 'Arrange nodes using declarative constraints. Supports align, order, spacing, group (cluster by type/field), distribute (even spacing along axis), and position (anchor to canvas edge). Constraints apply sequentially to node sets selected by constructType or semanticId. Use strategy "grid" for initial arrangement or "preserve" to adjust existing positions.',
```

### Step 8: Verify

Run `pnpm build && pnpm test`.

## Constraints

- **`erasableSyntaxOnly`**: No `private`/`protected`/`public` constructor parameter shorthand.
- **Barrel exports**: Use `.js` extensions in exports. (No new exports needed — types are already exported from `constraintLayout.ts`.)
- **No singleton registries**: All handlers are pure functions.
- **Centroid preservation**: Already handled by the outer `computeArrangeLayout` — individual constraint handlers don't need to worry about it.
- **Phase 1 patterns**: Follow the exact same function signature pattern as `applyAlignConstraint` etc.: `(constraint, _nodes, allNodes, positions, ...) → void`.

## Verification

1. `pnpm build` passes — TypeScript compiles across all packages.
2. `pnpm test` passes — no regressions.
3. The `ArrangeConstraint` type has 6 variants (3 old + 3 new).
4. The MCP schema `ArrangeConstraintSchema` has 6 entries.
5. The switch statement in `computeArrangeLayout` has 6 cases.

## Plan-specific checks

```bash
# New constraint types exist in domain
grep -q "type: 'group'" packages/domain/src/utils/constraintLayout.ts
grep -q "type: 'distribute'" packages/domain/src/utils/constraintLayout.ts
grep -q "type: 'position'" packages/domain/src/utils/constraintLayout.ts

# Handler functions exist
grep -q 'function applyGroupConstraint' packages/domain/src/utils/constraintLayout.ts
grep -q 'function applyDistributeConstraint' packages/domain/src/utils/constraintLayout.ts
grep -q 'function applyPositionConstraint' packages/domain/src/utils/constraintLayout.ts

# Switch cases wired
grep -c "case '" packages/domain/src/utils/constraintLayout.ts | grep -q '6'

# MCP schema includes new types
grep -q "'group'" packages/server/src/mcp/tools.ts
grep -q "'distribute'" packages/server/src/mcp/tools.ts
grep -q "'position'" packages/server/src/mcp/tools.ts

# No doc-operations changes
! git diff --name-only | grep -q 'doc-operations'

# No web-client changes
! git diff --name-only | grep -q 'web-client'

# No document-server-core changes
! git diff --name-only | grep -q 'document-server-core'
```
