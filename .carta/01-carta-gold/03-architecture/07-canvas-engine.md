---
title: Canvas Engine
status: active
summary: Cactus — composable canvas primitives: Canvas, useViewport, useNodeDrag, useConnectionDrag, ConnectionHandle, and more
tags: [canvas-engine, cactus, viewport, connections, primitives]
deps: [doc01.03.05]
---

# Canvas Engine (cactus)

Internal library of composable primitives for building interactive canvas UIs. Domain-agnostic — no knowledge of constructs, schemas, organizers, or Yjs. Consumers compose engine primitives with their own domain logic.

**Location:** `packages/web-client/src/cactus/`

## Architecture Position

Sits below feature components, above browser APIs. The sole canvas rendering layer for Carta.

```
Feature components (Map, Metamap, LayoutMap)
         ↓
   cactus
         ↓
   d3-zoom, DOM APIs
```

Dependency direction: consumers depend on the engine, never the reverse. The engine has no imports from `components/`, `hooks/`, or any domain package.

## Exports

25 exports total: 7 hooks, 6 components, context, and utilities.

### Canvas

Composite component that composes viewport, selection, connection drag, box select, and keyboard shortcuts into a single context provider. Does NOT accept node data — consumers render nodes as `children` and access shared state via `useCanvasContext`.

```typescript
interface CanvasProps {
  viewportOptions?: UseViewportOptions;
  connectionDrag?: { onConnect: Function; isValidConnection?: Function };
  boxSelect?: { getNodeRects: () => Array<{ id: string; x: number; y: number; width: number; height: number }> };
  renderEdges?: (transform: Transform) => ReactNode;
  renderConnectionPreview?: (coords: ConnectionPreviewCoords, transform: Transform) => ReactNode;
  renderBackground?: (transform: Transform, patternId?: string) => ReactNode;
  onBackgroundPointerDown?: (event: React.PointerEvent) => void;
  className?: string;
  patternId?: string;
  children: ReactNode;
}
```

Exposes imperative methods via `ref`:

```typescript
interface CanvasRef {
  fitView(rects: Array<{ x: number; y: number; width: number; height: number }>, padding?: number): void;
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number };
  getTransform(): Transform;
  zoomIn(): void;
  zoomOut(): void;
  clearSelection(): void;
}
```

### CanvasContext / useCanvasContext

Context provider for cactus composition. Provides to nested components:

```typescript
interface CanvasContextValue {
  transform: Transform;
  selectedIds: string[];
  connectionDrag: ConnectionDragState | null;
  ctrlHeld: boolean;  // tracks Ctrl/Meta key state
}
```

Used internally by Canvas. Child components call `useCanvasContext()` to read shared state. Throws if called outside a Canvas.

### useViewport

d3-zoom based pan/zoom management.

```typescript
interface UseViewportOptions {
  minZoom?: number;  // default 0.15
  maxZoom?: number;  // default 2
}

interface UseViewportResult {
  transform: Transform;
  containerRef: React.RefObject<HTMLDivElement>;
  fitView(rects: Array<{ x: number; y: number; width: number; height: number }>, padding?: number): void;
  screenToCanvas(screenX: number, screenY: number): { x: number; y: number };
  zoomIn(): void;
  zoomOut(): void;
}

interface Transform { x: number; y: number; k: number }
```

- **`data-no-pan`** — elements with this attribute opt out of pan initiation. Wheel zoom still works everywhere.

### useConnectionDrag

Connection lifecycle hook. Manages drag-from-source-to-target interaction.

```typescript
interface UseConnectionDragOptions {
  onConnect: (connection: ConnectionCandidate) => void;
  isValidConnection?: (connection: ConnectionCandidate) => boolean;
  screenToCanvas: (screenX: number, screenY: number) => { x: number; y: number };
}

interface UseConnectionDragResult {
  connectionDrag: ConnectionDragState | null;
  startConnection: (nodeId: string, handleId: string, clientX: number, clientY: number) => void;
}

interface ConnectionDragState {
  sourceNodeId: string;
  sourceHandle: string;
  startCanvasX: number;    // zoom-stable anchor point
  startCanvasY: number;
  currentScreenX: number;  // cursor screen coords
  currentScreenY: number;
}
```

Lifecycle:
1. Consumer calls `startConnection(nodeId, handleId, clientX, clientY)` — stores canvas-space anchor
2. Engine tracks pointer movement, updating `currentScreenX/Y`
3. On pointer up, hit-tests with `document.elementsFromPoint()` for `data-connection-target`
4. If valid, calls `onConnect`
5. State resets to `null`

### useNodeDrag

Low-level node drag primitive. Tracks drag deltas — consumers manage node positions externally.

```typescript
interface UseNodeDragOptions {
  zoomScale: number;
  handleSelector?: string;
  callbacks: {
    onDragStart?: (nodeId: string) => void;
    onDrag?: (nodeId: string, deltaX: number, deltaY: number) => void;
    onDragEnd?: (nodeId: string) => void;
  };
}

interface UseNodeDragResult {
  draggingNodeId: string | null;
  onPointerDown: (nodeId: string, event: React.PointerEvent) => void;
}
```

Key design: **no multi-select awareness, no snap-to-grid**. These are consumer responsibilities. Drag deltas are screen-space divided by `zoomScale`. Only responds to primary (left) button.

### useNodeResize

Interactive node resizing. Returns deltas, not absolute sizes.

```typescript
interface ResizeDirection {
  horizontal: 'left' | 'right' | 'none';
  vertical: 'top' | 'bottom' | 'none';
}

interface UseNodeResizeOptions {
  zoomScale: number;
  callbacks: {
    onResizeStart?: (nodeId: string) => void;
    onResize?: (nodeId: string, deltaWidth: number, deltaHeight: number, direction: ResizeDirection) => void;
    onResizeEnd?: (nodeId: string) => void;
  };
}

interface UseNodeResizeResult {
  resizingNodeId: string | null;
  onResizePointerDown: (nodeId: string, direction: ResizeDirection, event: React.PointerEvent) => void;
}
```

Supports 8 directions with sign compensation. Consumers apply deltas to their own size state.

### useSelection

Click-select with modifier support. Pure ID tracking — no node data required.

```typescript
interface UseSelectionOptions {
  onSelectionChange?: (ids: string[]) => void;
}

interface UseSelectionResult {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  isSelected: (id: string) => boolean;
  onNodePointerDown: (nodeId: string, event: React.PointerEvent) => void;
  clearSelection: () => void;
  mergeBoxSelection: (ids: string[]) => void;
}
```

Shift/Ctrl toggles; plain click replaces. `mergeBoxSelection()` integrates with `useBoxSelect`.

### useBoxSelect

Low-level box-select primitive. Requires consumer-provided `getNodeRects()` for hit-testing.

```typescript
interface UseBoxSelectOptions {
  transform: Transform;
  containerRef: React.RefObject<HTMLElement>;
  getNodeRects: () => Array<{ id: string; x: number; y: number; width: number; height: number }>;
  onSelectionChange?: (ids: string[]) => void;
  onBoxSelectHits?: (ids: string[]) => void;
}

interface UseBoxSelectResult {
  selectedIds: string[];
  clearSelection: () => void;
  selectionRect: { x: number; y: number; width: number; height: number } | null;
}
```

Initiated by Shift+click. If `onBoxSelectHits` is provided, delegates to that instead of managing state internally.

### useKeyboardShortcuts

Canvas-scoped keyboard shortcuts with platform-aware modifiers.

```typescript
interface KeyboardShortcut {
  key: string | string[];
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  mod?: boolean;  // Ctrl on Win/Linux, Meta on Mac
  action: () => void;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  disabled?: boolean;
}
```

Skips input/textarea/contenteditable elements. First match wins.

### useNodeLinks

Follower relationship lookups. Does NOT automatically move followers — consumers must apply deltas.

```typescript
interface NodeLink { id: string; leader: string; follower: string }
type FollowerDragDecision = 'allow' | 'block' | 'redirect-to-leader';

interface UseNodeLinksOptions {
  links: NodeLink[];
  onFollowerDragAttempt?: (link: NodeLink, followerId: string) => FollowerDragDecision;
}

interface UseNodeLinksResult {
  getFollowers: (leaderId: string) => string[];
  isFollower: (nodeId: string) => boolean;
  checkFollowerDrag: (nodeId: string) => FollowerDragDecision;
  getLeader: (followerId: string) => string | undefined;
}
```

### ConnectionHandle

Source/target handle component. Wires up data attributes and pointer events for hit-testing.

```typescript
interface ConnectionHandleProps {
  type: 'source' | 'target';
  id: string;
  nodeId: string;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  onStartConnection?: (nodeId: string, handleId: string, clientX: number, clientY: number) => void;
}
```

- **`type="source"`** — calls `onStartConnection` on pointer down, sets `data-no-pan`
- **`type="target"`** — renders with `data-connection-target`, `data-node-id`, `data-handle-id` for hit-testing

### EdgeLabel

SVG foreignObject-based label pill for edge annotations.

```typescript
interface EdgeLabelProps {
  x: number;
  y: number;  // canvas coords
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  onContextMenu?: (event: React.MouseEvent) => void;
}
```

Renders inside SVG `<g transform>` layer. Centers content with flexbox.

### ConnectionPreview

Renders the connection drag preview line. Used by Canvas; consumers rarely need directly.

### DotGrid / CrossGrid

Visual grid overlays for canvas backgrounds. Both accept `transform`, `spacing`, color props, and render in SVG via `patternTransform`. Purely visual.

### Utilities

```typescript
// Re-exported from @carta/geometry
computeBounds(nodes, options?): Rect;
isPointInRect(x, y, rect): boolean;

// Cactus-specific
findContainerAt(screenX, screenY): string | null;  // hit-tests data-container-id
resolveAbsolutePosition(nodeId, nodes): { x: number; y: number };
computeAttach(nodeId, containerId, nodes): { x: number; y: number };
computeDetach(nodeId, nodes): { x: number; y: number };
computeContainerFit(childGeometries, config?): OrganizerFitResult;
```

## Design Principles

The engine is **lower-level than you might expect**. It provides primitives, not policies:

- **No node data management** — Canvas doesn't know about node positions or dimensions. Consumers own their node state.
- **No multi-select drag** — useNodeDrag drags one node. Consumers check selection and apply deltas to all selected nodes.
- **No snap-to-grid** — Consumers apply grid snapping to deltas if desired.
- **No edge rendering** — Consumers render edges via `renderEdges` callback or SVG layers.
- **No follower movement** — useNodeLinks provides lookups; consumers move followers.

This makes the engine reusable across fundamentally different canvas views (architecture map, metamap, layout view, and future product design canvases).

## Composition Pattern

Consumers typically use the Canvas component and access shared state via useCanvasContext in children:

```
Canvas (provides context: transform, selectedIds, connectionDrag, ctrlHeld)
  ├─ Child components call useCanvasContext()
  ├─ Manually use useNodeDrag, useNodeResize, useNodeLinks
  └─ Render nodes as positioned divs, edges as SVG paths
```

Key structural rules:
- **Container div** gets viewport ref — d3-zoom attaches here
- **Node layer** is a transformed div; interactive nodes use `data-no-pan`
- **Edge layer** is an SVG with the same transform applied to a `<g>` group
- **Connection preview** is a separate SVG in screen coordinates (outside the transform group)
- **Hit-testing** works via `data-*` attributes — no refs or registration needed

## Coordinate Spaces

| Space | Units | Used by |
|-------|-------|---------|
| **Screen** | `clientX/clientY` pixels | d3-zoom events, pointer events, connection drag cursor, connection preview SVG |
| **Canvas** | Logical position units | Node positions, edge paths, the transformed `<div>` and `<g>` layers |

Conversion: `screenToCanvas(clientX, clientY)` handles the math. Connection preview operates in screen coords; everything else uses canvas coords.

## Consumers

| Consumer | Location | Uses |
|----------|----------|------|
| MapV2 | `components/canvas/MapV2.tsx` | Canvas, useNodeDrag, useNodeResize, useCanvasContext, useKeyboardShortcuts, useNodeLinks, findContainerAt |
| LayoutMap | `components/canvas/LayoutMap.tsx` | Canvas, useCanvasContext, useNodeDrag, useKeyboardShortcuts, ConnectionPreview, EdgeLabel |
| MetamapV2 | `components/metamap-v2/MetamapV2.tsx` | Canvas, useCanvasContext, useNodeDrag, findContainerAt, ConnectionPreview, useKeyboardShortcuts, CrossGrid |
| Node components | `MapV2ConstructNode`, `MapV2OrganizerNode`, `LayoutMapOrganizerNode`, `MetamapSchemaNode` | ConnectionHandle |
| Operation hooks | `useOrganizerOperations`, `useLayoutActions` | computeAttach, computeDetach, computeContainerFit |
