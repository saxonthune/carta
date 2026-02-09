# MCP Flow Layout Tool

## Motivation

When an AI agent builds or rearranges a Carta page, manually setting x/y coordinates is too fine-grained and "spread into grid" ignores edge topology. The agent needs to express layout *intent* — "data flows top-to-bottom through flow ports" — and let the system compute positions. This is the first layout tool, handling the most common case: directed acyclic flow layouts.

## Files to Modify

| File | Action | What changes |
|------|--------|-------------|
| `packages/domain/src/utils/flowLayout.ts` | **CREATE** | Pure topological layout algorithm |
| `packages/domain/src/utils/index.ts` | EDIT | Add barrel export for `flowLayout.ts` |
| `packages/document/src/doc-operations.ts` | EDIT | Add `flowLayout()` doc operation |
| `packages/server/src/document-server-core.ts` | EDIT | Add REST endpoint `POST /api/documents/:id/layout/flow` |
| `packages/server/src/mcp/tools.ts` | EDIT | Add `carta_flow_layout` MCP tool |

## Implementation Steps

### Step 1: Pure layout algorithm in `@carta/domain`

Create `packages/domain/src/utils/flowLayout.ts`.

**Input interface** (follows `SpreadInput` pattern from `packages/web-client/src/utils/spreadNodes.ts`):

```typescript
export interface FlowLayoutInput {
  id: string;
  semanticId: string;
  x: number;
  y: number;
  width: number;   // caller provides (server uses defaults, client uses measured)
  height: number;
}

export interface FlowLayoutEdge {
  sourceId: string;      // node ID
  targetId: string;      // node ID
  sourcePortId: string;  // e.g. "flow-out"
  targetPortId: string;  // e.g. "flow-in"
}

export type FlowDirection = 'TB' | 'BT' | 'LR' | 'RL';

export interface FlowLayoutOptions {
  direction: FlowDirection;
  sourcePort?: string;   // port ID defining "downstream" (default: "flow-out")
  sinkPort?: string;     // port ID defining "upstream" (default: "flow-in")
  layerGap?: number;     // gap between layers (default: 250)
  nodeGap?: number;      // gap between nodes in same layer (default: 150)
}

export interface FlowLayoutResult {
  positions: Map<string, { x: number; y: number }>;
  layers: Map<string, number>;     // node ID → layer index (metadata for client tidy)
  layerOrder: Map<string, number>; // node ID → order within layer
}
```

**Algorithm** (Sugiyama-lite):

1. **Filter edges**: Only use edges where `sourcePortId === options.sourcePort` (default `"flow-out"`). This determines flow direction.
2. **Build adjacency**: `Map<nodeId, nodeId[]>` for downstream neighbors. Also build reverse adjacency for upstream.
3. **Detect and break cycles**: DFS from all source nodes (in-degree 0). Back-edges are excluded from layer assignment but the edges remain in the graph for rendering.
4. **Layer assignment**: Longest-path from sources. Nodes with no incoming flow edges are layer 0. Each other node is `max(predecessors) + 1`. Disconnected nodes (no flow edges at all) go in layer 0.
5. **Crossing minimization**: Barycenter heuristic — order nodes within each layer by average position of connected nodes in the adjacent layer. Run 2 sweeps (forward then backward).
6. **Coordinate assignment**:
   - Primary axis (direction-dependent): layers spaced by `layerGap`
   - Secondary axis: nodes within each layer distributed using actual node sizes + `nodeGap`, centered around 0
   - For TB: primary = Y (layer 0 at top), secondary = X
   - For LR: primary = X (layer 0 at left), secondary = Y
   - BT/RL: reverse the primary axis
7. **Centroid preservation**: Compute original centroid of input nodes, shift all output positions to match (same pattern as `spreadNodes`).
8. **Return**: positions map, layer assignments, and within-layer ordering (so client-side tidy can refine using measured sizes without re-running the full algorithm).

**Export** from `packages/domain/src/utils/flowLayout.ts`:
```typescript
export function computeFlowLayout(
  nodes: FlowLayoutInput[],
  edges: FlowLayoutEdge[],
  options: FlowLayoutOptions
): FlowLayoutResult
```

**Add barrel export** in `packages/domain/src/utils/index.ts`:
```typescript
export * from './flowLayout.js';
```

### Step 2: Doc operation in `@carta/document`

Add to `packages/document/src/doc-operations.ts`, after the existing `moveConstruct()` function (~line 545).

```typescript
export function flowLayout(
  ydoc: Y.Doc,
  pageId: string,
  options: {
    direction: FlowDirection;
    sourcePort?: string;
    sinkPort?: string;
    layerGap?: number;
    nodeGap?: number;
    scope?: 'all' | string[];  // semantic IDs, default "all"
  }
): { updated: number; layers: Record<string, number> }
```

**Implementation**:

1. Call `listConstructs(ydoc, pageId)` to get all nodes
2. Filter to top-level only (`!node.parentId`) — skip organizer children
3. If `scope` is an array, filter to only those semanticIds
4. Read edges from `getPageMap(ydoc, 'edges', pageId)` — iterate and build `FlowLayoutEdge[]` from `{source, target, sourceHandle, targetHandle}`
5. Map edges' `source`/`target` (nodeIds) to match construct nodeIds
6. Build `FlowLayoutInput[]` from constructs, using **default sizes**: `width: 200, height: 100`
7. Call `computeFlowLayout(inputs, edges, options)` from `@carta/domain`
8. Apply positions in a single `ydoc.transact(() => { ... }, MCP_ORIGIN)`:
   - For each node in the result, find it in `pageNodes` by nodeId and update its `position` Y.Map
   - Use `deepPlainToY({ x, y })` for the position value
9. Return `{ updated: positions.size, layers: Object.fromEntries(layers) }`

**Import** `computeFlowLayout` and types from `@carta/domain`.

### Step 3: REST endpoint

Add to `packages/server/src/document-server-core.ts`, near the batch endpoint (~line 1124).

**Route**: `POST /api/documents/:id/layout/flow`

Pattern — match existing endpoint style:
```typescript
const flowLayoutMatch = path.match(/^\/api\/documents\/([^/]+)\/layout\/flow$/);
if (flowLayoutMatch && method === 'POST') {
  const roomId = flowLayoutMatch[1]!;
  const docState = await config.getDoc(roomId);
  if (!docState) { sendJson(res, 404, { error: 'Document not found' }); return; }

  const body = await parseJsonBody<{
    direction: string;
    sourcePort?: string;
    sinkPort?: string;
    layerGap?: number;
    nodeGap?: number;
    scope?: 'all' | string[];
  }>(req);

  if (!body.direction || !['TB', 'BT', 'LR', 'RL'].includes(body.direction)) {
    sendJson(res, 400, { error: 'direction must be TB, BT, LR, or RL' });
    return;
  }

  const pageId = docState.doc.getMap<unknown>('meta').get('activePage') as string;
  const result = flowLayout(docState.doc, pageId, {
    direction: body.direction as FlowDirection,
    sourcePort: body.sourcePort,
    sinkPort: body.sinkPort,
    layerGap: body.layerGap,
    nodeGap: body.nodeGap,
    scope: body.scope,
  });

  sendJson(res, 200, result);
  return;
}
```

### Step 4: MCP tool

Add to `packages/server/src/mcp/tools.ts`.

**Schema** (add near other schemas, ~line 180):
```typescript
const FlowLayoutSchema = z.object({
  documentId: z.string().describe('The document ID'),
  direction: z.enum(['TB', 'BT', 'LR', 'RL']).describe('Layout direction: TB (top-to-bottom), BT, LR, RL'),
  sourcePort: z.string().optional().describe('Port ID defining downstream flow (default: "flow-out")'),
  sinkPort: z.string().optional().describe('Port ID defining upstream flow (default: "flow-in")'),
  layerGap: z.number().optional().describe('Gap between layers in pixels (default: 250)'),
  nodeGap: z.number().optional().describe('Gap between nodes in same layer (default: 150)'),
  scope: z.union([z.literal('all'), z.array(z.string())]).optional().describe('"all" or array of semanticIds to layout (default: "all")'),
});
```

**Tool definition** (add to `getToolDefinitions()` array, after `carta_batch_mutate`):
```typescript
{
  name: 'carta_flow_layout',
  description: 'Arrange nodes in topological order along a flow direction. Uses port connections to determine hierarchy — nodes with no incoming flow edges become sources (layer 0). Supports TB/BT/LR/RL directions. Only affects top-level nodes (not inside organizers).',
  inputSchema: FlowLayoutSchema.shape,
},
```

**Handler** (add to `createToolHandlers()` return object):
```typescript
carta_flow_layout: async (args) => {
  const { documentId, direction, sourcePort, sinkPort, layerGap, nodeGap, scope } = FlowLayoutSchema.parse(args);
  const result = await apiRequest<{ updated: number; layers: Record<string, number> }>(
    'POST',
    `/api/documents/${encodeURIComponent(documentId)}/layout/flow`,
    { direction, sourcePort, sinkPort, layerGap, nodeGap, scope }
  );
  if (result.error) return { error: result.error };
  return result.data;
},
```

**Add to `ToolHandlers` interface**:
```typescript
carta_flow_layout: ToolHandler;
```

## Constraints

- **`erasableSyntaxOnly`**: No `private`/`protected`/`public` constructor parameter shorthand. Declare fields explicitly.
- **Barrel exports**: Use `.js` extensions in export paths (e.g., `export * from './flowLayout.js'`)
- **Transaction origin**: Use `MCP_ORIGIN` for all Y.Doc mutations (enables undo)
- **No organizer children**: Skip nodes with `parentId` set
- **Edge source/target are nodeIds**, not semanticIds. The `sourceHandle`/`targetHandle` fields are portIds.
- **Default sizes**: Server uses `width: 200, height: 100` for node dimensions. These generous defaults with `layerGap: 250, nodeGap: 150` prevent overlaps.
- **Centroid preservation**: Match the pattern in `spreadNodes.ts` — compute original centroid, shift output to match.

## Verification

1. `pnpm build` — must pass (TypeScript compilation across all packages)
2. `pnpm test` — must pass (no regressions to existing tests)
3. Manual verification: the new export `computeFlowLayout` should be importable from `@carta/domain`
4. The MCP tool should appear in tool listings (verified by existing MCP tool tests if present)
