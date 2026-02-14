# Look & Feel: What RF Provides vs What Carta Does Itself

## RF Provides (and Carta uses)

### Pan & Zoom Viewport
- **Mouse wheel zoom** with configurable min/max zoom
- **Pan via mouse drag** (configurable which buttons: `panOnDrag={[0, 1, 2]}`)
- **Pinch-to-zoom** on trackpads
- **fitView** — auto-fit all content into viewport
- **Viewport state** — `getViewport()` / `setViewport()` for save/restore per page
- **Coordinate transform** — `screenToFlowPosition()` for paste/add-node at cursor
- **Smooth animated transitions** — `setViewport({...}, { duration: 200 })`

**Carta extends**: Per-page viewport save/restore (Map.tsx), custom zoom in/out buttons with clamped range.

### Node Rendering
- **SVG/HTML hybrid canvas** — nodes are HTML divs positioned via CSS transforms inside an SVG-like coordinate system
- **Node type dispatch** — `nodeTypes` registry maps type strings to React components
- **Parent-child nesting** — `parentId` on nodes positions children relative to parent
- **Automatic measurement** — RF measures node DOM dimensions, stores in `node.measured`
- **Selection visual** — adds `.selected` class, manages multi-select with shift/meta
- **z-ordering** — `elevateNodesOnSelect` (Carta disables this)

**Carta overrides**: Custom node components (ConstructNode, OrganizerNode, etc.) handle ALL visual rendering. RF just positions and measures.

### Drag & Drop
- **Node dragging** — built-in with drag threshold (`nodeDragThreshold={5}`)
- **Drag lifecycle** — `onNodeDragStart` → `onNodeDrag` → `onNodeDragStop`
- **Multi-node drag** — selected nodes move together
- **Parent containment** — children dragged within parent bounds (partially — Carta overrides)

**Carta extends**: Drag-commit to Yjs on `onNodeDragStop`, multi-parent drag via `ctrl-drag`, organizer-child containment logic.

### Selection
- **Click-to-select** with shift/meta for multi-select
- **Selection box** — `selectionOnDrag` for lasso selection
- **Selection mode** — `SelectionMode.Full` (must fully contain)
- **Selection change** callback
- **Delete key** for selected nodes (Carta overrides behavior)

**Carta extends**: Selection mode toggle via toolbar button, custom selection change handler.

### Connection System
- **Connection dragging** — drag from Handle to Handle creates edges
- **Connection validation** — `isValidConnection` callback (Carta uses for port polarity)
- **Connection radius** — snap to nearby handle (`connectionRadius={50}`)
- **Connection state** — `useConnection()` hook for drop zone highlighting during drag
- **addEdge()** — utility to add edge with dedup

**Carta extends**: PortDrawer (expandable port list), IndexBasedDropZones, port polarity validation, connection data enrichment in `onConnect`.

### Edge Rendering
- **Edge type dispatch** — `edgeTypes` registry
- **Edge path utilities** — `getSmoothStepPath()`, `getBezierPath()`, etc.
- **Edge click/context menu** — `onEdgeClick`, `onEdgeContextMenu`
- **Edge deletion** — `onEdgesDelete`
- **Edge z-ordering** — edges rendered in SVG layer below nodes

**Carta overrides almost completely**: `DynamicAnchorEdge` does its own anchor calculation from node geometry (not from Handle positions). Uses `getSmoothStepPath` only as fallback when no waypoints. Custom waypoint path rendering with rounded corners.

### Resize
- **`<NodeResizer>`** — drag handles on node corners/edges
- **Resize detection** — dimension changes in `onNodesChange` with `resizing` flag

**Source of major bugs**: Resize → sync module interaction is the #1 source of snap-back bugs. The resize handler writes to Yjs, but the sync module races to push stale style.

### Controls Toolbar
- **`<Controls>`** — positioned container
- **`<ControlButton>`** — individual buttons

**Carta extends**: Adds undo/redo, zoom, fit, layout actions, selection mode toggle. The Controls component is basically just a positioned `<div>`.

### Background
- **`<Background>`** — dot grid pattern

**Trivial to replace**: One SVG pattern element.

### Internal Store Access
- **`useStore(selector)`** — direct access to RF internals
  - `nodeLookup` for absolute node positions (DynamicAnchorEdge)
  - `transform[2]` for zoom level (LOD bands)

---

## Carta Does Itself (RF not involved)

### Data Pipeline
- **Yjs ↔ React state sync** — useNodes/useEdges observers
- **Enhancement pipeline** — hidden flags, callbacks, sorting (parent-before-child)
- **Edge bundling** — parallel edge aggregation
- **Edge validation** — filter edges with invalid port references
- **Waypoint routing** — edge path computation through organizer boundaries
- **Presentation model** — `computePresentation()` for organizer edge aggregation

### Visual Design
- **LOD rendering** — nodes render differently based on zoom band (detail/compact/dot)
- **Color system** — schema-based background colors, polarity-colored ports
- **Port visualization** — PortDrawer expansion, port type indicators
- **Organizer appearance** — headers, layout menus, collapse/expand, nested rendering
- **Flow trace** — hover highlighting of connected paths
- **Theming** — light/dark/warm themes

### Layout System
- **All layout algorithms** — grid, column, row, flow, recursive layout, pin constraints
- **Organizer fit-to-children** — auto-resize organizer to content
- **Wagon placement** — attachment-based positioning

### State Management
- **Yjs Y.Doc** — single source of truth
- **Sync module** — Map.tsx useEffect that pushes enhanced nodes to RF
- **Guard machinery** — suppressUpdates, isDraggingRef, resizingNodeIds
- **Undo/redo** — Yjs UndoManager

### Interaction Logic
- **Context menus** — pane/node/edge/selection context menus (all custom)
- **Double-click to edit** — opens inspector/editor panel
- **Keyboard shortcuts** — copy/paste, delete, undo/redo
- **Clipboard** — custom node serialization/deserialization
- **Port connection logic** — polarity validation, connection data, dropdown port management

### AI Integration
- **AI tools** — addConstruct, getNode, queryNodes, etc.
- **MCP server** — document operations

---

## Assessment Matrix

| Feature | RF provides | Carta overrides | Replace difficulty |
|---------|-------------|-----------------|-------------------|
| Pan/zoom viewport | Full | Extends only | **HARD** — wheel/pinch/pan gesture handling, coordinate transforms |
| Node positioning | Full | None | **HARD** — CSS transform, parent-relative positioning |
| Node measurement | Full | None | **MEDIUM** — ResizeObserver on node divs |
| Drag interaction | Full | Extends | **HARD** — multi-node, threshold, containment |
| Selection system | Full | Extends | **HARD** — click/lasso/shift/meta, visual feedback |
| Connection drag | Full | Extends heavily | **HARD** — drag preview, snapping, validation |
| Edge SVG rendering | Partial | Mostly overridden | **MEDIUM** — already doing own path calc |
| Resize handles | Full | None | **MEDIUM** — div-based drag handles |
| Controls toolbar | Full | Mostly overridden | **EASY** — just positioned divs |
| Background dots | Full | None | **EASY** — one SVG pattern |
| Node type dispatch | Full | None | **EASY** — component map lookup |
| Edge type dispatch | Full | None | **EASY** — component map lookup |
| Internal store (nodeLookup) | Full | None | **MEDIUM** — need own node position store |

## What Doesn't RF Do That Might Surprise You

Things you might expect RF to handle but Carta does itself:

1. **Parent-child layout** — RF positions children relative to parent origin, but Carta does all the actual layout math
2. **Edge routing** — DynamicAnchorEdge ignores RF's handle positions, computes from node geometry
3. **Edge path calculation** — waypoints + rounded corners are all custom; `getSmoothStepPath` is just a fallback
4. **Node appearance** — RF renders a positioned div; everything inside is Carta's custom components
5. **State persistence** — RF has no persistence; Carta's entire Yjs layer handles this
6. **Undo/redo** — Yjs UndoManager, not RF
7. **Multi-page** — RF has no concept of pages
8. **Collapse/expand** — All Carta logic
9. **LOD rendering** — Carta reads zoom from RF store but does all LOD logic itself

## The Sync Tax

The three-layer sync (Yjs → React → RF) exists **only because RF is not state-aware**. RF maintains its own internal copy of nodes/edges. Every interaction that modifies state must:

1. Detect the change via RF callbacks
2. Write to Yjs (source of truth)
3. Wait for Yjs observer to update React state
4. Push React state back to RF via sync module
5. Guard against the sync module pushing stale data during the round-trip

This sync machinery is ~200 lines of Map.tsx and is the source of:
- Resize snap-back bugs
- Drag hitching
- Layout actions not visually updating
- Parent-not-found errors
- State ownership confusion

**Without RF**, the data flow would be:
1. Detect user interaction (our own event handlers)
2. Write to Yjs
3. Yjs observer updates React state
4. React re-renders

Two layers instead of three. No sync module. No guards. No snap-back.
