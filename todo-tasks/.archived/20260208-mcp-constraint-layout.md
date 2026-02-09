# MCP Constraint-Based Layout — Phase 1: Core Engine

> **Scope**: new feature
> **Layers touched**: domain (constraint types + resolver), document (arrange operation), server (MCP tool + REST)
> **Summary**: Add a `carta_arrange` MCP tool with core constraint types (align, order, spacing) and structured node selectors. Phase 1 of 2.

## Motivation

`carta_flow_layout` handles hierarchical DAG layout, but agents need richer vocabulary to arrange pages. This adds a constraint-based `carta_arrange` tool inspired by SetCoLa — agents express layout intent declaratively ("align all boundaries horizontally, order by type") and the system resolves constraints to positions.

## Design Constraint

**Constraints operate on node sets defined by structured selectors, not individual node coordinates.** The resolver applies constraints sequentially — no iterative solver needed for Phase 1's constraint set.

## Do NOT

- **Do NOT implement a string predicate parser.** NodeSelector uses structured objects only: `{ constructType: string }`, `{ semanticIds: string[] }`, or `"all"`.
- **Do NOT implement "group", "distribute", "position", or "flow" constraint types.** Those are Phase 2.
- **Do NOT implement "force" strategy.** Phase 1 supports "grid" and "preserve" only.
- **Do NOT add any web-client code.** This is entirely server-side (domain + document + server).
- **Do NOT modify `carta_flow_layout`** or its supporting code. The two tools coexist independently.
- **Do NOT add npm dependencies.** The constraint resolver is a simple sequential algorithm, not a full solver.
- **Do NOT implement anything in `spreadNodes.ts`, `compactNodes.ts`, or `layoutStrategies.ts`.** Those are web-client files. The arrange algorithm lives in `@carta/domain`.

## Files to Modify

| File | Change |
|------|--------|
| `packages/domain/src/utils/constraintLayout.ts` | **NEW** — Core constraint resolver (pure function) |
| `packages/domain/src/utils/index.ts` | Export `constraintLayout.ts` |
| `packages/domain/src/index.ts` | Verify barrel export covers utils (should already) |
| `packages/document/src/doc-operations.ts` | Add `arrangeLayout()` doc operation |
| `packages/server/src/mcp/tools.ts` | Add `carta_arrange` MCP tool schema, definition, handler |
| `packages/server/src/document-server-core.ts` | Add `POST /api/documents/:id/layout/arrange` endpoint |

## Implementation Steps

### Step 1: Create `packages/domain/src/utils/constraintLayout.ts`

This file contains the pure constraint resolver. No Yjs, no side effects.

**Types to define:**

```typescript
// Node selector — structured objects only, no string predicates
export type NodeSelector =
  | 'all'
  | { constructType: string }
  | { semanticIds: string[] };

// Constraint types for Phase 1
export type ArrangeConstraint =
  | { type: 'align'; axis: 'x' | 'y'; nodes?: NodeSelector; alignment?: 'center' | 'min' | 'max' }
  | { type: 'order'; axis: 'x' | 'y'; by: 'field' | 'alphabetical'; field?: string; nodes?: NodeSelector }
  | { type: 'spacing'; min?: number; equal?: boolean; nodes?: NodeSelector };

export type ArrangeStrategy = 'grid' | 'preserve';

export interface ArrangeInput {
  id: string;
  semanticId: string;
  constructType: string;
  values: Record<string, unknown>;  // field values for ordering
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ArrangeOptions {
  strategy: ArrangeStrategy;
  constraints: ArrangeConstraint[];
  nodeGap?: number;  // default gap for spacing, default: 40
}

export interface ArrangeResult {
  positions: Map<string, { x: number; y: number }>;  // keyed by node id
  constraintsApplied: number;
}
```

**Main function:**

```typescript
export function computeArrangeLayout(
  nodes: ArrangeInput[],
  options: ArrangeOptions
): ArrangeResult
```

**Algorithm:**

1. **Apply base strategy** to set initial positions:
   - `'preserve'`: Keep current positions as-is. Constraints adjust from there.
   - `'grid'`: Arrange all nodes in a grid (same algorithm as `spreadNodes.ts` — `Math.ceil(Math.sqrt(n))` columns, place left-to-right top-to-bottom with `nodeGap` spacing).

2. **Resolve node selectors** — helper function:
   ```typescript
   function resolveSelector(
     selector: NodeSelector | undefined,
     allNodes: ArrangeInput[]
   ): ArrangeInput[]
   ```
   - `'all'` or `undefined` → all nodes
   - `{ constructType }` → filter by `node.constructType === constructType`
   - `{ semanticIds }` → filter by `semanticIds` set membership on `node.semanticId`

3. **Apply constraints sequentially** (order matters — later constraints override earlier ones):

   **`align`**: Set all selected nodes' position on the given axis to the alignment value:
   - `'center'` (default): average of current positions on that axis
   - `'min'`: minimum position on that axis
   - `'max'`: maximum position on that axis

   **`order`**: Sort selected nodes along the given axis while preserving their cross-axis positions:
   - `'alphabetical'`: sort by `node.semanticId`
   - `'field'`: sort by `node.values[field]` (string comparison, undefined sorts last)
   - After sorting, distribute along the axis with `nodeGap` spacing, centered on original centroid

   **`spacing`**: Adjust gaps between selected nodes along both axes:
   - `min`: ensure at least `min` pixels between adjacent node edges. Push apart any that are closer.
   - `equal`: redistribute to equalize spacing along the primary axis (detect primary axis from position spread — use the axis with more variance)

4. **Preserve centroid**: After all constraints, shift all positions so the group centroid matches the original centroid. This prevents camera jumps. (Same pattern as `computeFlowLayout`.)

5. **Return** `{ positions, constraintsApplied }`.

### Step 2: Export from domain package

In `packages/domain/src/utils/index.ts`, add:
```typescript
export * from './constraintLayout.js';
```

Check that `packages/domain/src/index.ts` already re-exports `./utils/index.js`. If not, add it.

### Step 3: Add `arrangeLayout()` to doc-operations

In `packages/document/src/doc-operations.ts`, add a function following the exact pattern of `flowLayout()` (lines 555-639):

```typescript
export function arrangeLayout(
  ydoc: Y.Doc,
  pageId: string,
  options: {
    strategy?: ArrangeStrategy;
    constraints: ArrangeConstraint[];
    scope?: 'all' | string[];  // semantic IDs
    nodeGap?: number;
  }
): { updated: number; constraintsApplied: number }
```

**Implementation mirrors `flowLayout()`:**

1. Get page nodes via `getPageMap(ydoc, 'nodes', pageId)`
2. Call `listConstructs(ydoc, pageId)` to get all constructs
3. Filter to top-level constructs (`!n.parentId && n.type === 'construct'`)
4. Apply scope filter (same as flowLayout lines 574-579)
5. Build `ArrangeInput[]` from constructs:
   ```typescript
   const arrangeInputs: ArrangeInput[] = nodesToLayout.map(n => ({
     id: n.id,
     semanticId: n.data.semanticId,
     constructType: n.data.constructType,
     values: n.data.values ?? {},
     x: n.position.x,
     y: n.position.y,
     width: 200,
     height: 100,
   }));
   ```
6. Call `computeArrangeLayout(arrangeInputs, { strategy: options.strategy ?? 'preserve', constraints: options.constraints, nodeGap: options.nodeGap })`
7. Write positions to Y.Doc in a transaction with `MCP_ORIGIN` (same pattern as flowLayout lines 625-632)
8. Return `{ updated: result.positions.size, constraintsApplied: result.constraintsApplied }`

Import from `@carta/domain`:
```typescript
import { computeArrangeLayout } from '@carta/domain';
import type { ArrangeStrategy, ArrangeConstraint, NodeSelector } from '@carta/domain';
```

### Step 4: Add MCP tool in `packages/server/src/mcp/tools.ts`

**Zod schema** (place after `FlowLayoutSchema`, around line 228):

```typescript
const NodeSelectorSchema = z.union([
  z.literal('all'),
  z.object({ constructType: z.string().describe('Filter by construct type') }),
  z.object({ semanticIds: z.array(z.string()).describe('Explicit list of semantic IDs') }),
]);

const ArrangeConstraintSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('align'),
    axis: z.enum(['x', 'y']).describe('Axis to align on'),
    nodes: NodeSelectorSchema.optional().describe('Which nodes to align (default: all in scope)'),
    alignment: z.enum(['center', 'min', 'max']).optional().describe('Alignment target (default: center)'),
  }),
  z.object({
    type: z.literal('order'),
    axis: z.enum(['x', 'y']).describe('Axis to order along'),
    by: z.enum(['field', 'alphabetical']).describe('Sort criterion'),
    field: z.string().optional().describe('Field name for "field" sort'),
    nodes: NodeSelectorSchema.optional(),
  }),
  z.object({
    type: z.literal('spacing'),
    min: z.number().optional().describe('Minimum gap between node edges in px'),
    equal: z.boolean().optional().describe('Equalize spacing along primary axis'),
    nodes: NodeSelectorSchema.optional(),
  }),
]);

const ArrangeLayoutSchema = z.object({
  documentId: z.string().describe('The document ID'),
  strategy: z.enum(['grid', 'preserve']).optional().describe('Base layout strategy (default: "preserve")'),
  constraints: z.array(ArrangeConstraintSchema).describe('Declarative layout constraints applied sequentially'),
  scope: z.union([z.literal('all'), z.array(z.string())]).optional().describe('"all" or array of semanticIds (default: "all")'),
  nodeGap: z.number().optional().describe('Default gap between nodes in px (default: 40)'),
});
```

**Tool definition** (add to the array in `getToolDefinitions()`, before the closing `]`):

```typescript
{
  name: 'carta_arrange',
  description: 'Arrange nodes using declarative constraints. Supports align (snap to axis), order (sort along axis), and spacing (adjust gaps). Constraints apply sequentially to node sets selected by constructType or semanticId. Use strategy "grid" for initial arrangement or "preserve" to adjust existing positions.',
  inputSchema: ArrangeLayoutSchema.shape,
},
```

**Handler** in `ToolHandlers` interface: add `carta_arrange: ToolHandler;` alongside `carta_flow_layout`.

**Handler implementation** (add in `createToolHandlers()` return object, before the closing `}`):

```typescript
carta_arrange: async (args) => {
  const { documentId, strategy, constraints, scope, nodeGap } = ArrangeLayoutSchema.parse(args);
  const result = await apiRequest<{ updated: number; constraintsApplied: number }>(
    'POST',
    `/api/documents/${encodeURIComponent(documentId)}/layout/arrange`,
    { strategy, constraints, scope, nodeGap }
  );
  if (result.error) return { error: result.error };
  return result.data;
},
```

### Step 5: Add REST endpoint in `packages/server/src/document-server-core.ts`

**Add import** at the top (alongside `flowLayout`):
```typescript
import { ..., arrangeLayout } from '@carta/document';
import type { ArrangeStrategy, ArrangeConstraint } from '@carta/domain';
```

**Add route handler** right after the `flowLayout` endpoint block (after its `return;`):

```typescript
const arrangeMatch = path.match(/^\/api\/documents\/([^/]+)\/layout\/arrange$/);
if (arrangeMatch && method === 'POST') {
  const roomId = arrangeMatch[1]!;
  const docState = await config.getDoc(roomId);
  if (!docState) {
    sendError(res, 404, 'Document not found', 'NOT_FOUND');
    return;
  }

  const body = await parseJsonBody<{
    strategy?: string;
    constraints?: unknown[];
    scope?: string | string[];
    nodeGap?: number;
  }>(req);

  if (!body.constraints || !Array.isArray(body.constraints)) {
    sendError(res, 400, 'constraints array is required', 'MISSING_CONSTRAINTS');
    return;
  }

  const pageId = getActivePageId(docState.doc);
  const result = arrangeLayout(docState.doc, pageId, {
    strategy: (body.strategy as ArrangeStrategy) ?? 'preserve',
    constraints: body.constraints as ArrangeConstraint[],
    scope: body.scope as 'all' | string[] | undefined,
    nodeGap: body.nodeGap,
  });

  sendJson(res, 200, result);
  return;
}
```

### Step 6: Verify

Run `pnpm build && pnpm test` — should pass with no regressions.

## Constraints

- **`erasableSyntaxOnly`**: No `private`/`protected`/`public` constructor parameter shorthand. Declare fields explicitly.
- **Barrel exports**: Use `.js` extensions in exports (e.g., `export * from './constraintLayout.js'`).
- **No singleton registries**: The resolver is a pure function.
- **MCP_ORIGIN**: All Y.Doc writes use `MCP_ORIGIN` transaction origin.
- **Centroid preservation**: Layout output must preserve the original centroid of the node group.

## Verification

1. `pnpm build` passes — TypeScript compiles across all packages.
2. `pnpm test` passes — no regressions.
3. The new MCP tool `carta_arrange` appears in the tool definitions.
4. The REST endpoint `POST /api/documents/:id/layout/arrange` is reachable.

## Plan-specific checks

```bash
# constraintLayout.ts exists in domain
test -f packages/domain/src/utils/constraintLayout.ts

# Exported from domain barrel
grep -q 'constraintLayout' packages/domain/src/utils/index.ts

# arrangeLayout exists in doc-operations
grep -q 'export function arrangeLayout' packages/document/src/doc-operations.ts

# MCP tool registered
grep -q 'carta_arrange' packages/server/src/mcp/tools.ts

# REST endpoint registered
grep -q 'layout/arrange' packages/server/src/document-server-core.ts

# No web-client changes
! git diff --name-only | grep -q 'web-client'

# No string predicate parser
! grep -q 'where:' packages/domain/src/utils/constraintLayout.ts
```
