# Organizer toolbar: flow layout, grid layout, fit-to-children

> **Scope**: enhancement
> **Layers touched**: presentation (OrganizerNode), interaction (Map.tsx), utils

## Motivation

Organizers need toolbar buttons for reorganizing member constructs and auto-resizing. When working with organizers — especially via MCP where constructs land at arbitrary positions — users need to impose structure without manual dragging.

## Design constraint

Three separate buttons in the organizer header row. No dropdowns or popovers. Buttons appear alongside existing spread and collapse buttons when the organizer has 2+ children (same condition as spread).

## Do NOT

- Do NOT create a dropdown/popover for layout options — use separate buttons
- Do NOT modify existing `deOverlapNodes.ts` or `compactNodes.ts`
- Do NOT add persistent layout mode to organizers (no changes to organizer `layout` property)
- Do NOT handle nested organizers — filter them out like `handleSpreadChildren` does
- Do NOT modify centroid-preservation in layout functions — for organizer children, positions should start from (padding, headerHeight) not preserve centroid
- Do NOT change the `hierarchicalLayout` function signature or behavior — create a thin wrapper instead
- Do NOT add these buttons to the metamap — only canvas (guard with `nodeActions &&` like existing buttons)

## Files to Modify

### 1. `packages/web-client/src/components/canvas/nodeActions.ts`
Add three new actions to the `NodeActions` interface:
```typescript
onFlowLayoutChildren: (nodeId: string) => void;
onGridLayoutChildren: (nodeId: string) => void;
onFitToChildren: (nodeId: string) => void;
```

### 2. `packages/web-client/src/components/canvas/Map.tsx`

**Add three handler functions** following the `handleSpreadChildren` pattern (lines 512-537):

#### `handleFlowLayoutChildren(organizerId: string)`
1. Get all RF nodes: `reactFlow.getNodes()`
2. Filter children: `n.parentId === organizerId && n.type !== 'organizer'`
3. If `children.length < 2`, return
4. Build `SpreadInput[]` from children (same as handleSpreadChildren)
5. Get edges: `reactFlow.getEdges()`
6. Filter edges to only those between children: `edges.filter(e => childIds.has(e.source) && childIds.has(e.target))`
7. Call `hierarchicalLayout(inputs, scopedEdges, { gap: 30, layerGap: 60 })` — smaller gaps for organizer context
8. The function preserves centroid by default. After getting positions, normalize them: find the min x and min y across all positions, then shift all positions so min is at `(padding, padding)` where `padding = 20`. This places children neatly from the organizer's top-left.
9. Apply positions using the 3-layer pattern: `reactFlow.setNodes()`, `setNodesLocal()`, `adapter.patchNodes()`
10. After applying positions, call `handleFitToChildren(organizerId)` to auto-resize

#### `handleGridLayoutChildren(organizerId: string)`
1. Same child filtering as above
2. Build `SpreadInput[]`
3. Compute grid: `cols = Math.ceil(Math.sqrt(children.length))`
4. `colWidth = Math.max(...inputs.map(n => n.width)) + 30` (gap)
5. `rowHeight = Math.max(...inputs.map(n => n.height)) + 30`
6. Assign positions: `x = (idx % cols) * colWidth + padding`, `y = Math.floor(idx / cols) * rowHeight + padding` where `padding = 20`
7. Apply via 3-layer pattern
8. Call `handleFitToChildren(organizerId)` after

#### `handleFitToChildren(organizerId: string)`
1. Get all RF nodes
2. Filter children (same as above)
3. If no children, return
4. For each child, compute bounding box: `right = child.position.x + (child.measured?.width ?? child.width ?? 200)`, `bottom = child.position.y + (child.measured?.height ?? child.height ?? 100)`
5. Find `maxRight = Math.max(...rights)`, `maxBottom = Math.max(...bottoms)`
6. Add padding: `newWidth = maxRight + 40`, `newHeight = maxBottom + 60` (extra bottom padding for visual balance + header height)
7. Enforce minimums: `Math.max(newWidth, 200)`, `Math.max(newHeight, 120)` (matches NodeResizer minWidth/minHeight)
8. Update organizer node's style: `reactFlow.setNodes(nds => nds.map(n => n.id === organizerId ? { ...n, style: { ...n.style, width: newWidth, height: newHeight } } : n))`
9. Also apply to local state and Yjs: `setNodesLocal(same)`, `adapter.patchNodes([{ id: organizerId, style: { width: newWidth, height: newHeight } }])`

**Wire up refs** (follow pattern at lines 710-714):
```typescript
const handleFlowLayoutChildrenRef = useRef(handleFlowLayoutChildren);
handleFlowLayoutChildrenRef.current = handleFlowLayoutChildren;
const handleGridLayoutChildrenRef = useRef(handleGridLayoutChildren);
handleGridLayoutChildrenRef.current = handleGridLayoutChildren;
const handleFitToChildrenRef = useRef(handleFitToChildren);
handleFitToChildrenRef.current = handleFitToChildren;
```

**Add to nodeActions** (lines 717-726):
```typescript
onFlowLayoutChildren: (nodeId: string) => handleFlowLayoutChildrenRef.current(nodeId),
onGridLayoutChildren: (nodeId: string) => handleGridLayoutChildrenRef.current(nodeId),
onFitToChildren: (nodeId: string) => handleFitToChildrenRef.current(nodeId),
```

**Add import**: `import { hierarchicalLayout } from '../../utils/hierarchicalLayout';`

### 3. `packages/web-client/src/components/canvas/OrganizerNode.tsx`

**Add three click handlers** following the `handleSpread`/`handleToggle` pattern:

```typescript
const handleFlowLayout = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  if (nodeId && nodeActions) nodeActions.onFlowLayoutChildren(nodeId);
}, [nodeActions, nodeId]);

const handleGridLayout = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  if (nodeId && nodeActions) nodeActions.onGridLayoutChildren(nodeId);
}, [nodeActions, nodeId]);

const handleFitToChildren = useCallback((e: React.MouseEvent) => {
  e.stopPropagation();
  if (nodeId && nodeActions) nodeActions.onFitToChildren(nodeId);
}, [nodeActions, nodeId]);
```

**Add three buttons** in the header row, between the spread button and the eye toggle button (after line 232, before line 234). Same condition as spread: `nodeActions && childCount > 1`. Use inline SVGs at 14x14, same button class.

Button order (left to right): spread | flow layout | grid layout | fit-to-children | collapse eye

**Icons** (inline SVG, 14px, viewBox="0 0 24 24", stroke="currentColor", strokeWidth={2}, fill="none"):

1. **Flow layout** — horizontal lines with arrow suggesting flow direction:
```tsx
<svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
  <line x1="3" y1="6" x2="15" y2="6" />
  <polyline points="12 3 15 6 12 9" />
  <line x1="3" y1="12" x2="15" y2="12" />
  <polyline points="12 9 15 12 12 15" />
  <line x1="3" y1="18" x2="15" y2="18" />
  <polyline points="12 15 15 18 12 21" />
</svg>
```
Title: "Flow layout"

2. **Grid layout** — 2x2 grid of squares:
```tsx
<svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
  <rect x="3" y="3" width="7" height="7" rx="1" />
  <rect x="14" y="3" width="7" height="7" rx="1" />
  <rect x="3" y="14" width="7" height="7" rx="1" />
  <rect x="14" y="14" width="7" height="7" rx="1" />
</svg>
```
Title: "Grid layout"

3. **Fit to children** — compress/shrink inward arrows:
```tsx
<svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
  <polyline points="4 14 4 20 10 20" />
  <polyline points="20 10 20 4 14 4" />
  <line x1="14" y1="10" x2="20" y2="4" />
  <line x1="4" y1="20" x2="10" y2="14" />
</svg>
```
Title: "Fit to children"

## Implementation Steps

1. Add 3 methods to `NodeActions` interface in `nodeActions.ts`
2. Implement `handleFitToChildren` in Map.tsx (needed by the other two)
3. Implement `handleGridLayoutChildren` in Map.tsx
4. Implement `handleFlowLayoutChildren` in Map.tsx (import `hierarchicalLayout`)
5. Wire up refs and add to `nodeActions` object in Map.tsx
6. Add click handlers and buttons to `OrganizerNode.tsx`
7. Run `pnpm build && pnpm test`

## Constraints

- `erasableSyntaxOnly` — no `private`/`protected`/`public` parameter shorthand
- All layout utilities use the `SpreadInput` type from `./spreadNodes`
- Organizer dimensions stored in `node.style.width` / `node.style.height`
- `patchNodes` accepts `{ id, position?, style? }` — use `style` for organizer resize
- `hierarchicalLayout` already scopes edges internally (line 43: `if (nodeIds.has(e.source) && nodeIds.has(e.target))`) — so passing all edges is fine, but pre-filtering is cleaner and makes intent explicit
- Button styling must exactly match existing: `className="w-5 h-5 flex items-center justify-center rounded text-content-muted hover:text-content transition-colors shrink-0"`

## Verification

- `pnpm build` — no TypeScript errors
- `pnpm test` — all 222+ tests pass
- Manual: create organizer with 3+ connected constructs → flow layout arranges them left-to-right following connections → organizer auto-resizes to fit
- Manual: grid layout arranges in square grid → organizer auto-resizes
- Manual: after manually spreading children wide, fit-to-children shrinks organizer back
- Buttons only appear when `childCount > 1` and only on canvas (not metamap)

## Plan-specific checks

```bash
# NodeActions interface has all 3 new methods
grep -q 'onFlowLayoutChildren' packages/web-client/src/components/canvas/nodeActions.ts
grep -q 'onGridLayoutChildren' packages/web-client/src/components/canvas/nodeActions.ts
grep -q 'onFitToChildren' packages/web-client/src/components/canvas/nodeActions.ts

# Map.tsx imports hierarchicalLayout
grep -q 'hierarchicalLayout' packages/web-client/src/components/canvas/Map.tsx

# OrganizerNode has all 3 buttons
grep -q 'Flow layout' packages/web-client/src/components/canvas/OrganizerNode.tsx
grep -q 'Grid layout' packages/web-client/src/components/canvas/OrganizerNode.tsx
grep -q 'Fit to children' packages/web-client/src/components/canvas/OrganizerNode.tsx
```
