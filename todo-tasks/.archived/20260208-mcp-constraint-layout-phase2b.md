# MCP Constraint-Based Layout — Phase 2b: Flow Constraint + Force Strategy

> **Scope**: enhancement
> **Layers touched**: domain (flow constraint + force strategy + edge threading), document (extend arrange to pass edges), server (extend MCP tool schema)
> **Summary**: Add `flow` constraint type and `force` base strategy to `carta_arrange`. Requires edge data plumbing from doc-operations through to the pure function.

## Motivation

Phase 2a added position-only constraints (group, distribute, position). The remaining two features — `flow` (topological ordering as a constraint) and `force` (spring-model organic layout) — both require edge data. This plan adds optional edge threading to `ArrangeOptions` and implements both features.

## Design constraint

Edges are optional in `ArrangeOptions`. Existing positional constraints continue to work without edges. The pure function (`computeArrangeLayout`) never touches Yjs — edge fetching happens in doc-operations only.

## Do NOT

- Do NOT add any npm dependencies for the force layout. Hand-roll the physics.
- Do NOT make spring constant, repulsion strength, or damping configurable via the MCP schema. These are hardcoded in the force strategy.
- Do NOT modify `computeFlowLayout()` in `flowLayout.ts`. The flow constraint wraps it as-is.
- Do NOT add `edges` as a separate parameter to `computeArrangeLayout()`. It goes inside `ArrangeOptions`.
- Do NOT pre-filter edges to flow-only before passing to the flow constraint. Pass all edges between scoped nodes; `computeFlowLayout` filters by `sourcePort` internally.
- Do NOT add a visual constraint editor, persistent layout constraints, or animation.
- Do NOT add tests (no test infrastructure exists for constraintLayout yet).
- Do NOT change `FlowLayoutInput`, `FlowLayoutEdge`, or `FlowLayoutOptions` types in `flowLayout.ts`.

## Files to Modify

### 1. `packages/domain/src/utils/constraintLayout.ts`

**Add types:**
```typescript
export interface ArrangeEdge {
  sourceId: string;      // node ID (not semanticId)
  targetId: string;      // node ID
  sourcePortId: string;  // e.g. "flow-out"
  targetPortId: string;  // e.g. "flow-in"
}
```

**Extend `ArrangeConstraint` union — add:**
```typescript
| { type: 'flow'; direction?: 'TB' | 'BT' | 'LR' | 'RL'; sourcePort?: string; layerGap?: number; nodeGap?: number; nodes?: NodeSelector }
```

**Extend `ArrangeStrategy`:**
```typescript
export type ArrangeStrategy = 'grid' | 'preserve' | 'force';
```

**Extend `ArrangeOptions`:**
```typescript
export interface ArrangeOptions {
  strategy: ArrangeStrategy;
  constraints: ArrangeConstraint[];
  nodeGap?: number;
  edges?: ArrangeEdge[];          // ← NEW: optional, needed for flow constraint and force strategy
  forceIterations?: number;       // ← NEW: iterations for force strategy (default: 50)
}
```

**Add `applyForceStrategy()` function:**
- Simple spring-model Euler integration
- Parameters: `nodes: ArrangeInput[], edges: ArrangeEdge[], iterations: number, nodeGap: number`
- Returns `PositionMap`
- Algorithm:
  1. Initialize velocities to zero for each node
  2. For each iteration:
     a. **Repulsion**: For every pair of nodes, compute repulsive force (inverse-square, e.g. `repulsion = 10000 / distSq`). Apply to both nodes.
     b. **Attraction**: For each edge, compute spring force toward target distance (e.g. `spring = 0.01 * (dist - idealDist)` where `idealDist = nodeGap * 3`). Apply to both connected nodes.
     c. **Damping**: Multiply all velocities by `0.9`
     d. **Apply**: Update positions by velocity
  3. Return positions map
- No collision detection needed. Keep it simple.

**Add `applyFlowConstraint()` function:**
- Signature: `(constraint, nodes, allNodes, positions, edges)` — follows existing pattern but with extra `edges` param
- Implementation:
  1. Resolve selected nodes via `resolveSelector(constraint.nodes, allNodes)`
  2. Build `FlowLayoutInput[]` from selected nodes using their current positions from `positions` map
  3. Filter `edges` to only those where BOTH sourceId AND targetId are in the selected node set
  4. Map `ArrangeEdge[]` to `FlowLayoutEdge[]` (same shape, just type alignment)
  5. Call `computeFlowLayout(inputs, filteredEdges, { direction, sourcePort, layerGap, nodeGap })`
  6. Write result positions back into `positions` map (overwrite selected nodes' positions)
- Import `computeFlowLayout`, `FlowLayoutInput`, `FlowLayoutEdge` from `'./flowLayout.js'`

**Update `computeArrangeLayout()` main function:**
- In the strategy switch, add `force` case:
  ```typescript
  } else if (options.strategy === 'force') {
    positions = applyForceStrategy(nodes, options.edges ?? [], options.forceIterations ?? 50, nodeGap);
  }
  ```
- In the constraint loop switch, add `flow` case:
  ```typescript
  case 'flow':
    applyFlowConstraint(constraint, nodes, nodes, positions, options.edges ?? []);
    break;
  ```

### 2. `packages/document/src/doc-operations.ts`

**In `arrangeLayout()` function (line ~649):**

After building `arrangeInputs` (line ~686) and before calling `computeArrangeLayout` (line ~689), add edge fetching. Follow the exact pattern from `flowLayout` (lines 599-617):

```typescript
// 3b. Build ArrangeEdge[] from page edges (needed for flow constraint and force strategy)
const pageEdges = getPageMap(ydoc, 'edges', pageId);
const arrangeEdges: ArrangeEdge[] = [];
const nodeIdSet = new Set(arrangeInputs.map(n => n.id));
pageEdges.forEach((yedge) => {
  const source = yedge.get('source') as string;
  const target = yedge.get('target') as string;
  const sourceHandle = yedge.get('sourceHandle') as string | undefined;
  const targetHandle = yedge.get('targetHandle') as string | undefined;
  if (nodeIdSet.has(source) && nodeIdSet.has(target)) {
    arrangeEdges.push({
      sourceId: source,
      targetId: target,
      sourcePortId: sourceHandle ?? '',
      targetPortId: targetHandle ?? '',
    });
  }
});
```

Then pass edges through in the `computeArrangeLayout` call:
```typescript
const result = computeArrangeLayout(arrangeInputs, {
  strategy: options.strategy ?? 'preserve',
  constraints: options.constraints,
  nodeGap: options.nodeGap,
  edges: arrangeEdges,              // ← NEW
  forceIterations: options.forceIterations,  // ← NEW (pass through from caller)
});
```

**Update the `options` parameter type** to include `forceIterations?: number`.

**Update the import** from `@carta/domain` to include `ArrangeEdge`.

### 3. `packages/server/src/mcp/tools.ts`

**Add flow constraint to `ArrangeConstraintSchema` (after the `position` entry, line ~275):**
```typescript
z.object({
  type: z.literal('flow'),
  direction: z.enum(['TB', 'BT', 'LR', 'RL']).optional().describe('Flow direction (default: "TB")'),
  sourcePort: z.string().optional().describe('Port ID defining downstream direction (default: "flow-out")'),
  layerGap: z.number().optional().describe('Gap between layers in px (default: 250)'),
  nodeGap: z.number().optional().describe('Gap between nodes in same layer in px (default: 150)'),
  nodes: NodeSelectorSchema.optional(),
}),
```

**Extend `ArrangeLayoutSchema` (line ~278):**
- Change strategy enum: `z.enum(['grid', 'preserve'])` → `z.enum(['grid', 'preserve', 'force'])`
- Add `forceIterations` field:
  ```typescript
  forceIterations: z.number().optional().describe('Iteration count for force strategy (default: 50)'),
  ```

**Update tool description** (line ~518) to mention flow and force:
> "Arrange nodes using declarative constraints. Strategies: 'grid' (initial), 'preserve' (adjust), 'force' (organic spring layout). Constraints: align, order, spacing, group, distribute, position, flow (topological DAG layout). Constraints apply sequentially."

**Update handler** (line ~1021) to pass `forceIterations`:
```typescript
const { documentId, strategy, constraints, scope, nodeGap, forceIterations } = ArrangeLayoutSchema.parse(args);
// ... apiRequest body includes forceIterations
```

**Update HTTP route in `document-server-core.ts`** to pass `forceIterations` through to `arrangeLayout()`.

### 4. `packages/server/src/document-server-core.ts`

**In the arrange layout route handler** (~line 1183):
- Extract `forceIterations` from request body
- Pass it through to `arrangeLayout()` options

## Implementation Steps

1. **Add types and force strategy to `constraintLayout.ts`**
   - Add `ArrangeEdge` interface
   - Add `'force'` to `ArrangeStrategy`
   - Add `edges?` and `forceIterations?` to `ArrangeOptions`
   - Add `'flow'` variant to `ArrangeConstraint` union
   - Implement `applyForceStrategy()` — hand-rolled spring model
   - Implement `applyFlowConstraint()` — wraps `computeFlowLayout()`
   - Wire both into `computeArrangeLayout()` main function

2. **Thread edges through doc-operations**
   - In `arrangeLayout()`, fetch edges from `pageEdges` after building `arrangeInputs`
   - Pass edges and forceIterations to `computeArrangeLayout()`
   - Update function parameter type

3. **Extend MCP schema**
   - Add `flow` to `ArrangeConstraintSchema`
   - Add `force` to strategy enum
   - Add `forceIterations` to `ArrangeLayoutSchema`
   - Update tool description

4. **Thread forceIterations through HTTP route**
   - Extract from request body in `document-server-core.ts`
   - Pass to `arrangeLayout()` call

5. **Run `pnpm build && pnpm test`** to verify

## Constraints

- `erasableSyntaxOnly`: No `private`/`protected`/`public` parameter shorthand
- Barrel exports use `.js` extensions (e.g., `import from './flowLayout.js'`)
- Pure function: `computeArrangeLayout` must stay pure (no Yjs, no side effects)
- Edge fetching only in doc-operations layer
- All existing constraint layout tests must still pass (there are none yet, but build must succeed)

## Verification

- `pnpm build` succeeds (TypeScript compiles across all packages)
- `pnpm test` passes (no regressions)
- The `ArrangeConstraint` union includes 7 types: align, order, spacing, group, distribute, position, flow
- The `ArrangeStrategy` type includes 3 values: grid, preserve, force
- `ArrangeOptions` has optional `edges` and `forceIterations` fields
- `arrangeLayout()` in doc-operations fetches edges from Y.Doc

## Plan-specific checks

```bash
# flow constraint type exists
grep -q "type: 'flow'" packages/domain/src/utils/constraintLayout.ts

# force strategy exists
grep -q "'force'" packages/domain/src/utils/constraintLayout.ts

# ArrangeEdge type exists
grep -q "ArrangeEdge" packages/domain/src/utils/constraintLayout.ts

# edges field on ArrangeOptions
grep -q "edges?" packages/domain/src/utils/constraintLayout.ts

# doc-operations fetches edges for arrange
grep -q "arrangeEdges" packages/document/src/doc-operations.ts

# MCP schema includes flow constraint
grep -q "'flow'" packages/server/src/mcp/tools.ts

# MCP schema includes force strategy
grep -q "'force'" packages/server/src/mcp/tools.ts

# flowLayout.ts is NOT modified
git diff --name-only | grep -v flowLayout.ts || true
```
