---
title: Canvas Engine
status: active
---

# Canvas Engine

Internal library of composable primitives for building interactive canvas UIs. Domain-agnostic — no knowledge of constructs, schemas, organizers, or Yjs. Consumers compose engine primitives with their own domain logic.

**Location:** `packages/web-client/src/canvas-engine/`

## Architecture Position

Sits below feature components, above browser APIs. The sole canvas rendering layer for Carta.

```
Feature components (Map, Metamap, LayoutMap)
         ↓
   canvas-engine
         ↓
   d3-zoom, DOM APIs
```

Dependency direction: consumers depend on the engine, never the reverse. The engine has no imports from `components/`, `hooks/`, or any domain package.

## Primitives

The canvas-engine exports 11 primitives. The core primitives for most views are: `useViewport`, `useConnectionDrag`, `ConnectionHandle`, and `Canvas`. The others provide optional composition capabilities.

### Canvas

High-level canvas component that composes viewport, selection, drag, resize, and keyboard shortcuts into a single declarative API.

```typescript
interface CanvasProps {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  onNodesChange?: (nodes: typeof nodes) => void;
  renderNode: (node: typeof nodes[0]) => React.ReactNode;
  // ... additional props for edges, selection, resize, etc.
}
```

Consumers define node data and render functions; Canvas handles the interaction layer. See `LayoutMap.tsx` and `MetamapV2.tsx` for usage examples.

### CanvasContext / useCanvasContext

Context provider for canvas-engine composition. Provides viewport transform, selection state, and connection drag state to nested components. Used internally by Canvas component; consumers rarely need this directly.

### useViewport

d3-zoom based pan/zoom management.

```typescript
function useViewport(options?: UseViewportOptions): UseViewportResult

interface UseViewportOptions {
  minZoom?: number;  // default 0.15
  maxZoom?: number;  // default 2
}

interface UseViewportResult {
  transform: Transform;                    // { x, y, k } — current pan/zoom state
  containerRef: React.RefObject<HTMLDivElement>;  // attach to the panning container
  fitView(rects: Array<{ x, y, width, height }>, padding?: number): void;
  screenToCanvas(screenX: number, screenY: number): { x, y };
}

interface Transform { x: number; y: number; k: number }
```

- **`transform`** — current `{ x, y, k }` for applying CSS/SVG transforms to canvas layers
- **`containerRef`** — ref for the container div; d3-zoom attaches its event listeners here
- **`fitView(rects, padding)`** — animated transition to fit a set of bounding boxes with optional padding (default 0.1 = 10%)
- **`screenToCanvas(screenX, screenY)`** — converts screen coordinates (`clientX/clientY`) to canvas coordinates, accounting for current pan and zoom
- **`data-no-pan`** — elements with this attribute opt out of pan initiation (mouse/touch events pass through to the element instead of starting a pan). Wheel zoom still works everywhere.

### useConnectionDrag

Connection lifecycle hook. Manages the drag-from-source-to-target interaction pattern.

```typescript
function useConnectionDrag(options: UseConnectionDragOptions): UseConnectionDragResult

interface UseConnectionDragOptions {
  onConnect: (connection: ConnectionCandidate) => void;
  isValidConnection?: (connection: ConnectionCandidate) => boolean;
}

interface UseConnectionDragResult {
  connectionDrag: ConnectionDragState | null;  // null when no drag active
  startConnection: (sourceNodeId: string, sourceHandle: string, event: React.PointerEvent) => void;
}

interface ConnectionDragState {
  sourceNodeId: string;
  sourceHandle: string;
  currentX: number;   // cursor screen coords (for preview line)
  currentY: number;
}

interface ConnectionCandidate {
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
}
```

Lifecycle:
1. Consumer calls `startConnection(nodeId, handleId, event)` on pointer down (typically from a source handle)
2. Engine tracks pointer movement, updating `connectionDrag.currentX/currentY` in screen coords
3. On pointer up, engine hit-tests with `document.elementsFromPoint()` for elements with `data-connection-target` attribute
4. If a target is found AND `isValidConnection` returns true (or isn't provided), calls `onConnect`
5. `connectionDrag` resets to `null`

The engine has no opinion on what constitutes a valid connection — consumers define that entirely via the `isValidConnection` callback.

### useNodeDrag

Node dragging with multi-select support, snap-to-grid, and containment awareness.

```typescript
interface UseNodeDragOptions {
  nodes: Array<{ id: string; x: number; y: number }>;
  onDragEnd: (deltas: Array<{ id: string; x: number; y: number }>) => void;
  selectedNodeIds?: Set<string>;
  snapToGrid?: number;  // Grid size in canvas units
}
```

Dragging a selected node moves all selected nodes together. Consumers receive final positions on drag end.

### useNodeResize

Interactive node resizing with direction handles and min/max constraints.

```typescript
interface UseNodeResizeOptions {
  onResize: (nodeId: string, width: number, height: number) => void;
  minWidth?: number;
  minHeight?: number;
}

interface UseNodeResizeResult {
  startResize: (nodeId: string, direction: ResizeDirection, event: React.PointerEvent) => void;
  resizeState: { nodeId: string; direction: ResizeDirection; width: number; height: number } | null;
}
```

Supports 8 resize directions (N, NE, E, SE, S, SW, W, NW). Consumers apply resize handles and call `startResize` on pointer down.

### useSelection

Box-select and click-select with multi-select modifier support.

```typescript
interface UseSelectionOptions {
  nodes: Array<{ id: string; x: number; y: number; width: number; height: number }>;
  onSelectionChange: (selectedIds: Set<string>) => void;
  modifierKey?: 'ctrl' | 'shift';  // For additive selection
}
```

Box-select initiated by dragging in empty space. Click-select supports modifier keys for adding/removing from selection.

### useNodeLinks

Follower relationships between nodes — when a node moves, its followers move with it. Used for wagon attachment (organizer following its owning construct).

```typescript
interface UseNodeLinksOptions {
  links: Array<{ followerId: string; leaderId: string }>;
  onFollowerDragDecision?: (decision: FollowerDragDecision) => void;
}

interface FollowerDragDecision {
  followerId: string;
  leaderId: string;
  action: 'follow' | 'detach';
}
```

When a leader is dragged, followers move to maintain relative position. Consumers can intercept and choose to detach instead.

### useKeyboardShortcuts

Canvas-scoped keyboard shortcuts with modifier support.

```typescript
interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
}

function useKeyboardShortcuts(bindings: KeyBinding[]): void
```

Only fires when canvas container is focused. Consumers define bindings declaratively.

### useBoxSelect

Low-level box-select primitive. `useSelection` wraps this with node hit-testing; use `useBoxSelect` directly when you need custom selection logic.

```typescript
interface UseBoxSelectResult {
  boxSelectState: { startX: number; startY: number; currentX: number; currentY: number } | null;
}
```

Returns screen-space coordinates. Consumers convert to canvas space and apply their own hit-testing.

### DotGrid / CrossGrid

Visual grid overlays for canvas backgrounds. `DotGrid` renders a dot pattern; `CrossGrid` renders crosses.

```typescript
interface CrossGridProps {
  spacing?: number;  // Grid spacing in canvas units (default: 20)
  color?: string;    // Grid color (default: theme-aware)
}
```

Both respect the viewport transform and render in SVG. Purely visual — no interaction.

### ConnectionPreview

Renders the connection drag preview line. Used by `Canvas` component; consumers rarely need this directly.

```typescript
interface ConnectionPreviewProps {
  connectionDrag: { sourceNodeId: string; currentX: number; currentY: number } | null;
  sourcePosition: { x: number; y: number };  // Screen coords
}
```

### ConnectionHandle

Source/target handle component that wires up the data attributes and pointer events the engine relies on.

```typescript
interface ConnectionHandleProps {
  type: 'source' | 'target';
  id: string;
  nodeId: string;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  onStartConnection?: (nodeId: string, handleId: string, event: React.PointerEvent) => void;
}
```

Behavior by type:
- **`type="source"`** — calls `onStartConnection` on pointer down, sets `data-no-pan` to prevent pan interference
- **`type="target"`** — renders with `data-connection-target`, `data-node-id`, `data-handle-id` attributes for hit-testing

Styling is entirely the consumer's responsibility via `style`, `className`, and `children` props.

## Composition Pattern

A canvas view composes the three primitives into a layered structure:

```tsx
function MyCanvasView({ nodes, edges }) {
  const { transform, containerRef, fitView, screenToCanvas } = useViewport();
  const { connectionDrag, startConnection } = useConnectionDrag({
    onConnect: (conn) => { /* create edge in your data model */ },
    isValidConnection: (conn) => { /* your domain rules */ },
  });

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
      {/* Node layer — transformed div */}
      <div style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`, transformOrigin: '0 0' }}>
        {nodes.map(node => (
          <div key={node.id} style={{ position: 'absolute', left: node.x, top: node.y }} data-no-pan>
            <ConnectionHandle type="source" id="out" nodeId={node.id} onStartConnection={startConnection}>
              {/* source handle UI */}
            </ConnectionHandle>
            <ConnectionHandle type="target" id="in" nodeId={node.id}>
              {/* target handle UI */}
            </ConnectionHandle>
          </div>
        ))}
      </div>

      {/* Edge layer — SVG with same transform */}
      <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
        <g transform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}>
          {edges.map(edge => <path key={edge.id} d={/* compute path */} />)}
        </g>
      </svg>

      {/* Connection preview — screen coords, outside transform */}
      {connectionDrag && (
        <svg style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <line x1={/* source screen pos */} y1={...} x2={connectionDrag.currentX} y2={connectionDrag.currentY} />
        </svg>
      )}
    </div>
  );
}
```

Key structural rules:
- **Container div** gets `containerRef` — d3-zoom attaches here
- **Node layer** is a transformed div; nodes use `data-no-pan` to allow interaction without triggering pan
- **Edge layer** is an SVG with the same transform applied to a `<g>` group
- **Connection preview** is a separate SVG in screen coordinates (outside the transform group), since `connectionDrag` reports cursor position in screen coords
- **Hit-testing** works via `data-*` attributes on handle elements — no refs or registration needed

## Recommended Consumer Pattern: Declarative Validation

The engine's `isValidConnection` callback is a single predicate. Consumers are encouraged to decompose validation into a **rule array** pattern for composability:

```typescript
interface ConnectionRule {
  id: string;
  message: string;
  test: (candidate: ConnectionCandidate, context: YourDomainContext) => boolean;
}

function validateConnection(rules: ConnectionRule[], candidate, context): { valid: boolean; message?: string } {
  for (const rule of rules) {
    if (!rule.test(candidate, context)) {
      return { valid: false, message: rule.message };
    }
  }
  return { valid: true };
}
```

This pattern lets the same rules drive both drop validation and UI feedback (e.g., narrator messages, handle highlighting). Rules are data, not control flow — easily extended, tested, and serialized. Each consumer defines its own rule set appropriate to its domain.

## Coordinate Spaces

Two coordinate spaces are in play:

| Space | Units | Used by |
|-------|-------|---------|
| **Screen** | `clientX/clientY` pixels | d3-zoom events, pointer events, `connectionDrag.currentX/Y`, connection preview SVG |
| **Canvas** | Logical position units | Node positions, edge paths, the transformed `<div>` and `<g>` layers |

Conversion: `screenToCanvas(clientX, clientY)` handles the math, accounting for the container's position on screen, current pan offset, and zoom scale.

The connection preview line operates in screen coords because the drag cursor position is naturally in screen space. Everything else (nodes, edges, positions stored in your data model) uses canvas coords.
