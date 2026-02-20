# Packaging: How the Canvas Engine is Organized and Consumed

## Decision: Directory, Not Package

The canvas engine lives inside `@carta/web-client`, not as a separate package. Reasons:

1. **Only web-client consumes it.** No other package needs pan/zoom/drag primitives.
2. **It depends on React and DOM APIs.** Not domain logic — it's presentation infrastructure.
3. **The monorepo's package graph already positions web-client as the leaf.** Adding a package below it just for internal consumption adds build complexity for no benefit.
4. **Iteration speed.** During migration, we'll change the canvas engine and its consumers in the same commit. Cross-package changes slow this down.

If Carta ever needs a second rendering target (e.g., a different canvas framework), the directory can be extracted into a package then.

---

## Directory Structure

```
packages/web-client/src/
├── canvas-engine/               ← NEW: all RF-replacement code lives here
│   ├── index.ts                 ← barrel export
│   ├── types.ts                 ← CanvasNode, CanvasEdge, Transform, etc.
│   ├── CanvasViewport.tsx       ← the main component (replaces <ReactFlow>)
│   ├── useViewport.ts           ← d3-zoom hook: pan, zoom, fit, coordinate transforms
│   ├── useDrag.ts               ← pointer-event drag for nodes
│   ├── useSelection.ts          ← click, shift-click, lasso selection
│   ├── useConnectionDrag.ts     ← drag-from-handle-to-handle connection creation
│   ├── useNodeMeasurement.ts    ← ResizeObserver-based node dimension tracking
│   ├── ConnectionHandle.tsx     ← replaces <Handle> — a div with connection events
│   ├── ResizeHandles.tsx        ← replaces <NodeResizer> — drag handles for resize
│   ├── SelectionBox.tsx         ← lasso selection rectangle overlay
│   ├── Background.tsx           ← dot grid SVG pattern
│   └── EdgeLayer.tsx            ← SVG container for edge rendering
│
├── components/canvas/           ← EXISTING: canvas-specific UI components
│   ├── Map.tsx                  ← consumes canvas-engine
│   ├── LayoutView.tsx           ← consumes canvas-engine
│   ├── ConstructNode/           ← unchanged (visual rendering)
│   ├── OrganizerNode.tsx        ← replaces <Handle> with <ConnectionHandle>
│   ├── DynamicAnchorEdge.tsx    ← reads from measurement store instead of useStore
│   ├── lod/                     ← reads zoom from useViewport instead of useStore
│   └── ...
│
├── components/metamap/          ← EXISTING
│   ├── Metamap.tsx              ← consumes canvas-engine
│   └── SchemaNode.tsx           ← replaces <Handle> with <ConnectionHandle>
│
├── hooks/                       ← EXISTING: document-level hooks (unchanged)
│   ├── useNodes.ts              ← still Yjs→React state
│   ├── useEdges.ts
│   ├── useLayoutActions.ts      ← stops calling reactFlow.setNodes(), just patches Yjs
│   └── ...
│
└── presentation/                ← EXISTING: data transform pipeline (unchanged)
    ├── edgeAggregation.ts
    ├── orthogonalRouter.ts
    └── ...
```

### Why `canvas-engine/` and not `components/canvas/viewport/`

The previous document proposed `components/canvas/viewport/`. After thinking about it more:

- These aren't just "viewport" things — drag, selection, connections, resize are all here too
- They aren't traditional components — mostly hooks and one compound component
- `canvas-engine/` signals "this is the rendering infrastructure layer" vs `components/canvas/` which is "these are the UI components that use it"
- Clean separation: `canvas-engine/` has zero Carta domain knowledge. It doesn't know about constructs, organizers, schemas, ports, or Yjs. It just knows about nodes, edges, positions, and interactions.

---

## Dependencies

```
d3-zoom    → useViewport.ts (pan, zoom, fitView)
d3-selection → useViewport.ts (d3.select for attaching zoom behavior)
```

That's it. Two d3 micro-packages. No d3-drag — we use pointer events for node drag (simpler, avoids d3-drag + d3-zoom event coordination complexity).

```bash
pnpm add d3-zoom d3-selection
pnpm add -D @types/d3-zoom @types/d3-selection
```

Both are tiny (~5kb combined gzipped) and have zero transitive dependencies beyond each other.

---

## The Core Type: `CanvasNode`

The canvas engine needs a node type that's simpler than RF's `Node`. No RF-specific fields (`measured`, `internals`, `computed`). Just what the engine needs:

```typescript
// canvas-engine/types.ts

export interface CanvasNode<T = Record<string, unknown>> {
  id: string;
  type: string;
  position: { x: number; y: number };   // relative to parent
  parentId?: string;
  style?: { width?: number; height?: number; [key: string]: unknown };
  data: T;
  hidden?: boolean;
  selected?: boolean;
  draggable?: boolean;
  dragHandle?: string;                    // CSS selector for drag handle element
}

export interface CanvasEdge<T = Record<string, unknown>> {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type?: string;
  data?: T;
  label?: string;
  style?: Record<string, unknown>;
}

export interface Transform {
  x: number;
  y: number;
  k: number;    // scale
}

export interface NodeRect {
  x: number;       // absolute position
  y: number;
  width: number;
  height: number;
}
```

**Relationship to RF's `Node` type**: During migration, consumers (Map.tsx, hooks) still use RF's `Node` type internally for their data pipeline. The `CanvasNode` type is what the engine accepts. The mapping is trivial — they have the same shape for the fields that matter.

After RF is fully removed, we can either:
- Keep using `CanvasNode` everywhere (rename to just `Node`)
- Or keep the current RF `Node` shape as our own type (it's a fine shape)

This is a post-migration cleanup decision, not a blocker.

---

## The Core Component: `<CanvasViewport>`

One component replaces `<ReactFlow>`, `<ReactFlowProvider>`, and `<Background>`:

```tsx
// canvas-engine/CanvasViewport.tsx

interface CanvasViewportProps<N extends CanvasNode = CanvasNode, E extends CanvasEdge = CanvasEdge> {
  // Data
  nodes: N[];
  edges: E[];

  // Component registries
  nodeTypes: Record<string, React.ComponentType<NodeComponentProps<N>>>;
  edgeTypes?: Record<string, React.ComponentType<EdgeComponentProps<E>>>;

  // Viewport
  fitViewOnMount?: boolean;
  fitViewPadding?: number;
  minZoom?: number;
  maxZoom?: number;

  // Interactions
  onNodeDragStart?: (nodeId: string, event: PointerEvent) => void;
  onNodeDrag?: (nodeId: string, position: { x: number; y: number }, event: PointerEvent) => void;
  onNodeDragStop?: (nodeId: string, position: { x: number; y: number }, event: PointerEvent) => void;
  onConnect?: (connection: { source: string; sourceHandle?: string; target: string; targetHandle?: string }) => void;
  isValidConnection?: (connection: { source: string; sourceHandle?: string; target: string; targetHandle?: string }) => boolean;
  onNodeClick?: (nodeId: string, event: React.MouseEvent) => void;
  onNodeDoubleClick?: (nodeId: string, event: React.MouseEvent) => void;
  onNodeContextMenu?: (nodeId: string, event: React.MouseEvent) => void;
  onEdgeClick?: (edgeId: string, event: React.MouseEvent) => void;
  onEdgeContextMenu?: (edgeId: string, event: React.MouseEvent) => void;
  onPaneClick?: (event: React.MouseEvent) => void;
  onPaneContextMenu?: (event: React.MouseEvent) => void;
  onSelectionChange?: (selectedIds: string[]) => void;

  // Selection
  selectionOnDrag?: boolean;

  // Background
  showBackground?: boolean;

  // Resize
  onNodeResize?: (nodeId: string, dimensions: { width: number; height: number }) => void;

  // Children (toolbar overlays, etc.)
  children?: React.ReactNode;
}
```

### What it renders

```tsx
<div ref={containerRef} className="canvas-container" style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
  {/* Background layer */}
  {showBackground && <Background transform={transform} />}

  {/* Edge SVG layer */}
  <EdgeLayer transform={transform}>
    {edges.map(edge => <EdgeComponent key={edge.id} ... />)}
    {connectionDrag && <ConnectionPreviewLine ... />}
    {selectionBox && <SelectionBox ... />}
  </EdgeLayer>

  {/* Node HTML layer */}
  <div className="canvas-world" style={{ transform: `translate(${tx}px, ${ty}px) scale(${k})`, transformOrigin: '0 0' }}>
    {sortedNodes.map(node => (
      <NodeWrapper key={node.id} node={node} ... >
        <NodeComponent data={node.data} id={node.id} selected={node.selected} />
      </NodeWrapper>
    ))}
  </div>

  {/* Overlay layer (children: toolbar, etc.) */}
  {children}
</div>
```

### What it provides via context

```typescript
interface CanvasContext {
  // Viewport
  transform: Transform;
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
  canvasToScreen: (canvasX: number, canvasY: number) => { x: number; y: number };
  fitView: (padding?: number) => void;
  setViewport: (transform: Transform, options?: { duration?: number }) => void;
  getViewport: () => Transform;

  // Node measurement (for edge anchoring)
  getNodeRect: (nodeId: string) => NodeRect | null;

  // Selection
  selectedIds: Set<string>;
  setSelectedIds: (ids: string[]) => void;
}
```

Consumers access this via a `useCanvas()` hook (replaces `useReactFlow()`).

---

## How Each Consumer Uses It

### LayoutView (Phase 1)

Minimal usage. No selection, no resize, no LOD.

```tsx
import { CanvasViewport } from '../../canvas-engine';

function LayoutViewInner({ onClose }: LayoutViewProps) {
  const [localNodes, setLocalNodes] = useState<CanvasNode[]>([]);
  const [localEdges, setLocalEdges] = useState<CanvasEdge[]>([]);

  // ... same initialization logic as today ...

  return (
    <CanvasViewport
      nodes={localNodes}
      edges={localEdges}
      nodeTypes={layoutNodeTypes}
      fitViewOnMount
      fitViewPadding={0.2}
      onNodeDragStop={(nodeId, position) => {
        setLocalNodes(nds => nds.map(n => n.id === nodeId ? { ...n, position } : n));
      }}
      onConnect={handleConnect}
      isValidConnection={isValidConnection}
      onEdgeContextMenu={(edgeId, event) => setEdgeContextMenu({ x: event.clientX, y: event.clientY, edgeId })}
      showBackground
    >
      {/* Header bar overlay */}
      <div className="absolute top-0 left-0 right-0 z-10 ...">...</div>
    </CanvasViewport>
  );
}

// No ReactFlowProvider wrapper needed — context is built into CanvasViewport
export default function LayoutView(props: LayoutViewProps) {
  return <LayoutViewInner {...props} />;
}
```

**LayoutOrganizerNode**:
```tsx
import { ConnectionHandle } from '../../canvas-engine';

// Replace <Handle> with <ConnectionHandle>
<ConnectionHandle type="source" id="N" style={{ left: '50%', top: 0 }} />
<ConnectionHandle type="target" id="body" style={{ inset: 0, opacity: 0 }} />
```

### Metamap (Phase 2)

Adds selection and more event handlers.

```tsx
import { CanvasViewport, useCanvas } from '../../canvas-engine';

<CanvasViewport
  nodes={nodes}
  edges={edges}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  fitViewOnMount
  selectionOnDrag
  onNodeDragStop={(nodeId, position) => {
    // Write position to Yjs (metamap schema positions)
    updateSchemaPosition(nodeId, position);
  }}
  onNodeClick={handleNodeClick}
  onEdgeClick={handleEdgeClick}
  onConnect={handleConnect}
  onSelectionChange={handleSelectionChange}
  onPaneContextMenu={handlePaneContextMenu}
  showBackground
  minZoom={0.15}
  maxZoom={2}
>
  <Controls>...</Controls>
</CanvasViewport>
```

### Map (Phase 3)

Full usage. Adds resize, LOD, measurement store for DynamicAnchorEdge.

```tsx
import { CanvasViewport, useCanvas } from '../../canvas-engine';

<CanvasViewport
  nodes={sortedNodes}
  edges={displayEdges}
  nodeTypes={nodeTypes}
  edgeTypes={edgeTypes}
  fitViewOnMount
  selectionOnDrag={selectionModeActive}
  minZoom={0.15}
  maxZoom={2}
  onNodeDragStart={handleDragStart}
  onNodeDrag={handleDrag}
  onNodeDragStop={(nodeId, position) => {
    // Write directly to Yjs — no sync module needed
    adapter.patchNodes([{ id: nodeId, position }]);
  }}
  onNodeResize={(nodeId, dimensions) => {
    // Write directly to Yjs — no resizingNodeIds guard needed
    adapter.patchNodes([{ id: nodeId, style: dimensions }]);
  }}
  onConnect={onConnect}
  isValidConnection={isValidConnection}
  onNodeClick={handleNodeClick}
  onNodeDoubleClick={handleNodeDoubleClick}
  onNodeContextMenu={handleNodeContextMenu}
  onEdgeClick={handleEdgeClick}
  onEdgeContextMenu={handleEdgeContextMenu}
  onPaneClick={handlePaneClick}
  onPaneContextMenu={handlePaneContextMenu}
  onSelectionChange={handleSelectionChange}
  showBackground
>
  <Controls>...</Controls>
  <Narrative ... />
</CanvasViewport>
```

**The sync module disappears.** Nodes flow: Yjs observer → `useNodes` → `sortedNodes` memo chain → `CanvasViewport` props → render. Two layers. No `reactFlow.setNodes()`. No guards.

**DynamicAnchorEdge** uses `useCanvas().getNodeRect(id)` instead of `useStore(s => s.nodeLookup.get(id))`.

**useLodBand** uses `useCanvas().transform.k` instead of `useStore(s => s.transform[2])`.

**useLayoutActions** calls `adapter.patchNodes()` only — no more `reactFlow.setNodes()` or `reactFlow.getNodes()`. Layout results go to Yjs, observer fires, React re-renders, canvas updates. One path.

---

## What Happens to `useReactFlow()` Call Sites

Every `useReactFlow()` call maps to `useCanvas()`:

| RF API | Canvas Engine API |
|--------|-------------------|
| `reactFlow.setNodes(updater)` | Gone — update Yjs or local state, re-render |
| `reactFlow.getNodes()` | Read from React state (nodes prop / context) |
| `reactFlow.getNode(id)` | `nodes.find(n => n.id === id)` or Map lookup |
| `reactFlow.fitView()` | `canvas.fitView()` |
| `reactFlow.getViewport()` | `canvas.getViewport()` |
| `reactFlow.setViewport()` | `canvas.setViewport()` |
| `reactFlow.screenToFlowPosition()` | `canvas.screenToCanvas()` |
| `reactFlow.getIntersectingNodes()` | Compute from `getNodeRect()` + AABB test |
| `useStore(s => s.nodeLookup)` | `canvas.getNodeRect(id)` |
| `useStore(s => s.transform[2])` | `canvas.transform.k` |
| `useNodeId()` | `id` prop (passed directly) |
| `useConnection()` | `useCanvas().connectionDrag` |
| `useUpdateNodeInternals()` | `canvas.remeasureNode(id)` |

---

## What Does NOT Change

The canvas engine is a rendering/interaction layer. Everything above and below it stays the same:

```
Yjs Y.Doc (source of truth)              ← unchanged
    ↓
yjsAdapter (read/write)                  ← unchanged
    ↓
useNodes / useEdges (Yjs → React state)  ← unchanged
    ↓
Enhancement pipeline (Map.tsx memos)     ← unchanged
    ↓
canvas-engine (render + interactions)    ← NEW (replaces RF)
    ↓
Node/Edge components (visual rendering) ← unchanged (just swap Handle → ConnectionHandle)
```

The entire `presentation/` directory (edge aggregation, organizer processing, orthogonal routing, sequence badges, trace graph) is untouched — it produces data that flows into the canvas engine via props.

The entire `hooks/` directory is untouched except:
- `useLayoutActions` — remove `reactFlow.setNodes()` calls (simplification)
- `useConnections` — remove `useReactFlow()` import, use `useCanvas()` for coordinate transforms
- `useGraphOperations` — remove `useReactFlow()`, use `useCanvas().screenToCanvas()`
- `useClipboard` — remove `useReactFlow()`, use `useCanvas().screenToCanvas()`

---

## Import Migration

### Before (RF)
```typescript
import { ReactFlow, ReactFlowProvider, useReactFlow, useStore, Handle, NodeResizer,
         Position, Controls, ControlButton, Background, BackgroundVariant,
         applyNodeChanges, applyEdgeChanges, addEdge, getSmoothStepPath,
         type Node, type Edge, type NodeChange, type EdgeChange, type Connection,
         type NodeProps, type EdgeProps, SelectionMode } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
```

### After (canvas-engine)
```typescript
import { CanvasViewport, useCanvas, ConnectionHandle, ResizeHandles,
         Background, SelectionBox, EdgeLayer,
         type CanvasNode, type CanvasEdge, type Transform, type NodeRect } from '../../canvas-engine';
```

No CSS import — we write our own minimal styles (positioned divs, SVG, cursor classes). Most of the current `.react-flow__*` CSS rules in `index.css` get replaced with `.canvas-*` equivalents or are eliminated entirely (RF's default styles we were overriding).

---

## Barrel Export

```typescript
// canvas-engine/index.ts

// Components
export { CanvasViewport } from './CanvasViewport';
export { ConnectionHandle } from './ConnectionHandle';
export { ResizeHandles } from './ResizeHandles';
export { Background } from './Background';
export { SelectionBox } from './SelectionBox';
export { EdgeLayer } from './EdgeLayer';

// Hooks
export { useCanvas } from './CanvasViewport';  // context hook, co-located with provider
export { useViewport } from './useViewport';    // standalone, if anyone needs just viewport

// Types
export type { CanvasNode, CanvasEdge, Transform, NodeRect } from './types';
export type { NodeComponentProps, EdgeComponentProps } from './types';

// Utilities
export { getSmoothStepPath } from './paths';   // inlined or thin wrapper if needed
```

---

## d3-zoom Integration Detail

The only file that touches d3 is `useViewport.ts`:

```typescript
// canvas-engine/useViewport.ts
import { zoom as d3Zoom, type ZoomBehavior } from 'd3-zoom';
import { select } from 'd3-selection';

export function useViewport(containerRef: RefObject<HTMLDivElement>, options: ViewportOptions) {
  const [transform, setTransform] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const zoomRef = useRef<ZoomBehavior<HTMLDivElement, unknown>>();

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const zoomBehavior = d3Zoom<HTMLDivElement, unknown>()
      .scaleExtent([options.minZoom ?? 0.15, options.maxZoom ?? 2])
      .filter((event: Event) => {
        // Allow wheel zoom always
        if (event.type === 'wheel') return true;
        // Allow pan on configured buttons
        if (event.type === 'mousedown') {
          return options.panButtons?.includes((event as MouseEvent).button) ?? true;
        }
        // Allow touch
        if (event.type === 'touchstart') return true;
        return false;
      })
      .on('zoom', (event) => {
        setTransform({ x: event.transform.x, y: event.transform.y, k: event.transform.k });
      });

    select(el).call(zoomBehavior);
    zoomRef.current = zoomBehavior;

    return () => { select(el).on('.zoom', null); };
  }, []);

  // fitView, setViewport, screenToCanvas implemented via zoomRef.current
  // ...

  return { transform, fitView, setViewport, getViewport, screenToCanvas, canvasToScreen };
}
```

No other file imports d3. If d3-zoom is ever swapped out (unlikely — it's the gold standard), only this one file changes.
