---
title: Canvas Data Pipelines
status: active
---

# Canvas Data Pipelines

Memo cascades and data flow in Map.tsx. Use this doc to trace how domain state becomes React Flow nodes/edges, and where state writes (layout actions, drag handlers) feed back into the pipeline.

## Node Pipeline

```
Yjs Y.Doc
  │
  ▼
useNodes()                          → nodes: Node[]           (Yjs observer → setState)
  │
  ▼
usePresentation(nodes, edges)       → nodesWithHiddenFlags    (visibility, organizer collapse, edge remap)
                                      edgeRemap: Map          (collapsed-organizer edge remapping)
  │
  ▼
nodesWithCallbacks (useMemo)        → Node[] with data callbacks injected
  │                                   (nodeActions, childCount, rename handlers, trace data)
  │                                   Deps: [nodesWithHiddenFlags, childCountMap, organizerIds,
  │                                          renamingNodeId, nodeActions, traceResult, ...]
  ▼
sortedNodes (useMemo)               → Node[] sorted for React Flow render order
  │                                   (search-hidden nodes filtered, z-order: organizer children
  │                                    after parents, selected nodes last)
  │                                   Deps: [nodesWithCallbacks, searchText, getSchema]
  ▼
Sync effect (useEffect)             → reactFlow.setNodes(sortedNodes)
                                      Preserves RF-managed selection state via functional update.
                                      Deps: [sortedNodes, reactFlow]
```

**Trigger chain:** Any Yjs node change OR local state change (dimension, search text, selection, rename mode, trace) causes `sortedNodes` to recompute, which triggers the sync effect to push to React Flow.

## Edge Pipeline

```
Yjs Y.Doc
  │
  ▼
useEdges()                          → edges: Edge[]           (Yjs observer → setState)
  │                                   Top-level properties include `waypoints` (if routed)
  ▼
filteredEdges (useMemo)             → Edge[] after aggregation, filtering, synthetic edges
  │                                   Steps:
  │                                   1. computeEdgeAggregation(edges, sortedNodes, edgeRemap, selectedNodeIdsSet)
  │                                      - Individual edges: same organizer or both free → keep original ID
  │                                      - Cross-organizer edges: aggregate → synthetic `agg-{source}-{target}` ID
  │                                   2. Filter hidden: remove edges where source or target is hidden
  │                                   3. filterInvalidEdges: remove edges with stale port references
  │                                   4. Inject wagon attachment edges: synthetic `wagon-{nodeId}` IDs
  │                                   5. Augment with flow trace data (if active)
  │                                   Deps: [edges, edgeRemap, sortedNodes, selectedNodeIdsSet,
  │                                          isTraceActive, traceResult, getSchema]
  ▼
polarityEdges (useMemo)             → Edge[] with data enrichment
  │                                   - Translates top-level `waypoints` → `data.waypoints`
  │                                   - Adds `data.polarity` from source port schema
  │                                   - Strips top-level `waypoints` key (clean edge objects)
  │                                   Deps: [filteredEdges, nodeConstructTypeMap, polarityLookup]
  ▼
useEdgeBundling(polarityEdges)      → displayEdges: Edge[]    (collapse parallel edges between same pair)
                                      bundleMap: Map           (representative ID → bundled edge IDs)
                                      Representative edge keeps original ID.
  │
  ▼
routedEdges = displayEdges          → Currently a passthrough (orthogonal routing disabled in pipeline)
  │
  ▼
Sync effect (useEffect)             → reactFlow.setEdges(routedEdges)
                                      Deps: [routedEdges, reactFlow]
```

**Trigger chain:** Any Yjs edge change OR `sortedNodes` identity change (from node pipeline) causes `filteredEdges` to recompute, which cascades through `polarityEdges` → `displayEdges` → sync effect.

## Edge ID Spaces

The pipeline transforms edge IDs. This matters for any code that writes back to Yjs.

| Stage | ID Format | Exists in Yjs? |
|-------|-----------|----------------|
| `useEdges()` | Original Yjs edge ID (e.g., `abc123`) | Yes |
| After aggregation | `agg-{source}-{target}` for cross-organizer | No |
| After wagon injection | `wagon-{nodeId}` for attachment edges | No |
| After bundling | Original ID of representative edge | Yes |

**Rule:** Any code that patches Yjs (`adapter.patchEdgeData`) must use original Yjs edge IDs. Display-layer IDs (`agg-*`, `wagon-*`) will silently no-op because `patchEdgeData` skips IDs not found in the Y.Map.

## Waypoint Data Flow

Waypoints are persisted as a **top-level key** on the edge Y.Map (`yedge.set('waypoints', [...])`), not inside `data`. The `polarityEdges` memo translates this to `data.waypoints` for the React Flow edge renderer (`DynamicAnchorEdge`).

```
routeEdges() action
  │
  ├─→ adapter.patchEdgeData([{ id, data: { waypoints: [...] } }])
  │     Writes top-level `waypoints` on edge Y.Map
  │     (must use original Yjs edge IDs, not display-layer IDs)
  │
  ▼
Yjs observer fires → useEdges() → edges with top-level `waypoints`
  │
  ▼
polarityEdges memo: (edge as any).waypoints → data.waypoints
  │
  ▼
DynamicAnchorEdge reads data.waypoints → renders orthogonal path
```

**Clearing waypoints on drag:** `onNodesChange` drag-end handler (Map.tsx) clears waypoints for edges connected to moved nodes by patching Yjs with `{ waypoints: null }`, which deletes the key.

## Write-Back Points

Code that writes node/edge state back to Yjs or React Flow. These are the mutation points — where bugs involving state sync typically originate.

| Location | What it writes | Target |
|----------|---------------|--------|
| `onNodesChange` drag-end (Map.tsx) | Final position | `setNodesLocal` + `adapter.patchNodes` |
| `onNodesChange` dimension (Map.tsx) | Measured dimensions | `setNodesLocal` (local only, not persisted) |
| `onNodesChange` expandParent (Map.tsx) | Organizer expanded dimensions | `adapter.patchNodes` |
| `onNodesChange` resize-end (Map.tsx) | Style width/height | `adapter.patchNodes` |
| `onNodesChange` drag-end (Map.tsx) | Clear waypoints for moved nodes | `adapter.patchEdgeData` |
| `routeEdges()` (useLayoutActions) | Waypoints | `adapter.patchEdgeData` |
| `clearRoutes()` (useLayoutActions) | Clear waypoints | `adapter.patchEdgeData` |
| Layout actions (useLayoutActions) | Node positions | `applyPositionPatches` → `setNodesLocal` + `adapter.patchNodes` |
| Attach/detach (useLayoutActions) | Node parentId, position | `attachNodeToOrganizer` / `detachNodeFromOrganizer` → `setNodesLocal` + `adapter.patchNodes` |
| Node sync effect (Map.tsx) | Merged nodes | `reactFlow.setNodes()` |
| Edge sync effect (Map.tsx) | Pipeline edges | `reactFlow.setEdges()` |

## Key Invariant

**Yjs is the single source of truth.** All persistent state changes write to Yjs first. The pipeline reads from Yjs (via hooks) and pushes derived state to React Flow via sync effects. Direct writes to React Flow (`reactFlow.setEdges()`, `reactFlow.setNodes()`) are only valid in the sync effects — never for persistent data.

Temporary RF-only state (drag-in-progress positions, dimension measurements) is allowed because it's transient and reconciled on commit.
