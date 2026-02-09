# Computed Sequence Badges

> **Scope**: enhancement
> **Layers touched**: presentation (new `computeSequenceBadges` function), web-client (badge rendering in ConstructNode dispatch hub)
> **Summary**: Compute topological order from flow-out→flow-in edges within organizers and render ordinal badges on nodes.

## Motivation

Inside organizers, constructs connected by flow edges represent sequential steps — but the sequence is only visible by tracing edges. This adds computed ordinal badges (1, 2, 3...) to nodes that participate in flow chains within any organizer.

## Design Constraint

**Badges are purely presentation-layer.** They are computed from edges, injected via node data, and rendered in the dispatch hub. No schema changes, no stored fields, no domain model changes.

## Do NOT

- Add any new fields to `ConstructNodeData` in `packages/domain/src/types/index.ts` — use the existing `[key: string]: unknown` index signature
- Add any new fields to `ConstructSchema` or any schema-level types
- Modify `OrganizerLayout` or `OrganizerNodeData` types
- Render badges inside individual variant components (ConstructNodeDefault, ConstructNodeSimple, etc.) — the badge goes in the dispatch hub (`ConstructNode/index.tsx`)
- Import React or use hooks in the badge computation function — it must be a pure function in the presentation layer
- Gate badges on layout type — show badges for any organizer whose members have flow edges, regardless of layout strategy
- Use sub-ordinals (3a, 3b) for branches — parallel branches all get the next sequential ordinal (same layer = same ordinal)
- Modify `computePresentation()` in `presentationModel.ts` — the sequence badge computation happens in `usePresentation.ts` hook AFTER `computePresentation` returns, injecting badge data into processedNodes before returning
- Touch `flowLayout.ts` — write a new, simpler topological sort function purpose-built for badge computation

## Files to Modify

### 1. NEW: `packages/web-client/src/presentation/sequenceBadges.ts`
Pure function that computes ordinal badges for organizer members.

### 2. `packages/web-client/src/presentation/index.ts`
Export the new function.

### 3. `packages/web-client/src/hooks/usePresentation.ts`
Call `computeSequenceBadges` after `computePresentation` and inject badge data into processedNodes.

### 4. `packages/web-client/src/components/canvas/ConstructNode/index.tsx`
Read `sequenceBadge` from node data and render a badge overlay wrapping the variant.

## Implementation Steps

### Step 1: Create `sequenceBadges.ts`

Create `packages/web-client/src/presentation/sequenceBadges.ts`:

```typescript
/**
 * Compute sequence badges for nodes inside organizers.
 * Pure function — no React dependencies.
 */

import type { ProcessableNode, ProcessableEdge } from './presentationModel';

export interface SequenceBadgeResult {
  /** Map from node ID to ordinal number (1-based) */
  badges: Map<string, number>;
}

/**
 * For each organizer, find members connected by flow-out→flow-in edges,
 * compute topological layers, and assign ordinals.
 *
 * Nodes without flow edges in the organizer get no badge.
 * Disconnected nodes (no flow edges) get no badge.
 * Branches (multiple outgoing) all advance to next ordinal — no sub-labels.
 */
export function computeSequenceBadges(
  nodes: ProcessableNode[],
  edges: ProcessableEdge[]
): SequenceBadgeResult {
  const badges = new Map<string, number>();

  // Group nodes by parentId (organizer membership)
  const organizerMembers = new Map<string, string[]>();
  for (const node of nodes) {
    if (node.parentId && node.type !== 'organizer') {
      const members = organizerMembers.get(node.parentId) ?? [];
      members.push(node.id);
      organizerMembers.set(node.parentId, members);
    }
  }

  // For each organizer with 2+ members, compute sequence
  for (const [, memberIds] of organizerMembers) {
    if (memberIds.length < 2) continue;

    const memberSet = new Set(memberIds);

    // Find flow-out → flow-in edges between members of this organizer
    // Edges use sourceHandle/targetHandle for port IDs
    const flowEdges: Array<{ source: string; target: string }> = [];
    for (const edge of edges) {
      const eAny = edge as Record<string, unknown>;
      const sourceHandle = (eAny.sourceHandle ?? '') as string;
      if (
        sourceHandle === 'flow-out' &&
        memberSet.has(edge.source) &&
        memberSet.has(edge.target)
      ) {
        flowEdges.push({ source: edge.source, target: edge.target });
      }
    }

    if (flowEdges.length === 0) continue;

    // Build adjacency
    const downstream = new Map<string, string[]>();
    const upstream = new Map<string, string[]>();
    for (const id of memberIds) {
      downstream.set(id, []);
      upstream.set(id, []);
    }
    for (const e of flowEdges) {
      downstream.get(e.source)?.push(e.target);
      upstream.get(e.target)?.push(e.source);
    }

    // Find nodes that participate in any flow edge
    const participants = new Set<string>();
    for (const e of flowEdges) {
      participants.add(e.source);
      participants.add(e.target);
    }

    // Topological layer assignment (longest path from sources)
    // Sources = participants with no incoming flow edges within this organizer
    const layers = new Map<string, number>();
    const sources = [...participants].filter(id => (upstream.get(id)?.length ?? 0) === 0);

    for (const id of sources) {
      layers.set(id, 0);
    }

    // Iterative relaxation
    let changed = true;
    let iterations = 0;
    while (changed && iterations < 100) {
      changed = false;
      iterations++;
      for (const id of participants) {
        const ups = upstream.get(id) ?? [];
        if (ups.length === 0) continue;
        const upLayers = ups.map(u => layers.get(u)).filter((l): l is number => l !== undefined);
        if (upLayers.length === ups.length) {
          const newLayer = Math.max(...upLayers) + 1;
          if (layers.get(id) !== newLayer) {
            layers.set(id, newLayer);
            changed = true;
          }
        }
      }
    }

    // Convert layers to 1-based ordinals
    for (const [nodeId, layer] of layers) {
      badges.set(nodeId, layer + 1);
    }
  }

  return { badges };
}
```

**Key design choices:**
- Uses `sourceHandle === 'flow-out'` to identify flow edges (matches how `flowLayout.ts` filters by `sourcePortId`)
- Edges in React Flow have `sourceHandle`/`targetHandle` properties (see `Map.tsx:585`)
- Layer 0 → ordinal 1 (1-based for display)
- Branches naturally get the correct ordinal — all targets of a node get parent's layer + 1

### Step 2: Export from `presentation/index.ts`

Add to `packages/web-client/src/presentation/index.ts`:

```typescript
export { computeSequenceBadges } from './sequenceBadges.js';
export type { SequenceBadgeResult } from './sequenceBadges.js';
```

### Step 3: Wire into `usePresentation.ts`

Update `packages/web-client/src/hooks/usePresentation.ts` to compute badges and inject into node data:

```typescript
import { useMemo } from 'react';
import type { Node, Edge } from '@xyflow/react';
import { computePresentation, type PresentationOutput, computeSequenceBadges } from '../presentation';

export function usePresentation(nodes: Node[], edges: Edge[]): PresentationOutput {
  return useMemo(() => {
    const result = computePresentation({ nodes: nodes as any, edges: edges as any });

    // Compute sequence badges for organizer members
    const { badges } = computeSequenceBadges(result.processedNodes as any, edges as any);

    // Inject badge data into node data
    if (badges.size > 0) {
      result.processedNodes = result.processedNodes.map(node => {
        const badge = badges.get(node.id);
        if (badge !== undefined) {
          return { ...node, data: { ...node.data, sequenceBadge: badge } };
        }
        return node;
      });
    }

    return result;
  }, [nodes, edges]);
}
```

### Step 4: Render badge in dispatch hub

In `packages/web-client/src/components/canvas/ConstructNode/index.tsx`, after the variant dispatch block and before the dimmed check, wrap the variant in a badge overlay:

After line ~106 (where `dimmed` is read) and the variant dispatch block (~108-120), modify the return to include the badge. The badge should render as a small circular overlay in the top-left corner.

Add a `SequenceBadge` component at the top of the file (or inline):

```tsx
function SequenceBadge({ ordinal }: { ordinal: number }) {
  return (
    <div
      className="absolute -top-2 -left-2 z-10 flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-semibold leading-none pointer-events-none"
      style={{
        backgroundColor: 'var(--color-surface-alt)',
        color: 'var(--color-content)',
        boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
        border: '1px solid var(--color-border)',
      }}
    >
      {ordinal}
    </div>
  );
}
```

Then wrap the variant output:

```tsx
const sequenceBadge = (data as Record<string, unknown>).sequenceBadge as number | undefined;

// ... existing variant dispatch ...

const content = (
  <div className="relative">
    {sequenceBadge != null && lod.band !== 'pill' && (
      <SequenceBadge ordinal={sequenceBadge} />
    )}
    {variant}
  </div>
);

if (dimmed) {
  return (
    <div style={{ opacity: 0.2, pointerEvents: 'none', transition: 'opacity 150ms ease' }}>
      {content}
    </div>
  );
}

return content;
```

**Important**: Badge is hidden in pill LOD (too small to read). The wrapper div must have `className="relative"` so the absolute badge positions correctly.

### Step 5: Verify

Run:
```bash
pnpm build && pnpm test
```

### Plan-specific checks

```bash
# Ensure no new fields added to ConstructNodeData type definition
! grep -q 'sequenceBadge' packages/domain/src/types/index.ts

# Ensure badge is NOT rendered in individual variant files
! grep -q 'sequenceBadge' packages/web-client/src/components/canvas/ConstructNode/ConstructNodeDefault.tsx
! grep -q 'sequenceBadge' packages/web-client/src/components/canvas/ConstructNode/ConstructNodeSimple.tsx
! grep -q 'sequenceBadge' packages/web-client/src/components/canvas/ConstructNode/ConstructNodePill.tsx

# Ensure badge computation is a pure function (no React imports)
! grep -q 'from.*react' packages/web-client/src/presentation/sequenceBadges.ts

# Ensure the new file exists
test -f packages/web-client/src/presentation/sequenceBadges.ts
```

## Constraints

- **`erasableSyntaxOnly`**: No `private`/`protected`/`public` constructor parameter shorthand (CLAUDE.md)
- **Barrel exports**: Use `.js` extensions in export statements
- **No hooks in presentation functions**: `computeSequenceBadges` must be pure
- **Node identity**: Badge uses node ID, not semantic ID, for the map key (matches React Flow node.id used throughout the presentation layer)
