---
title: Canvas Engine
status: active
---

# Canvas Engine

Internal library of composable primitives for building interactive canvas UIs. Domain-agnostic — no knowledge of constructs, schemas, organizers, or Yjs. Consumers compose engine primitives with their own domain logic.

**Location:** `packages/web-client/src/canvas-engine/`

## Architecture Position

Sits below feature components, above browser APIs. Peer to React Flow — eventually replaces it for views that need tighter control over rendering and interaction.

```
Feature components (LayoutMap, future Metamap, ...)
         ↓
   canvas-engine          React Flow
         ↓                    ↓
   d3-zoom, DOM APIs     @xyflow/react
```

Dependency direction: consumers depend on the engine, never the reverse. The engine has no imports from `components/`, `hooks/`, or any domain package.

## Primitives

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
