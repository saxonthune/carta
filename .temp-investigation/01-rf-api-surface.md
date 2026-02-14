# React Flow API Surface Audit

Every call Carta makes into `@xyflow/react`. Organized by category.

## 1. Top-Level Component

| Usage | File(s) | What it does |
|-------|---------|-------------|
| `<ReactFlow>` | Map.tsx, Metamap.tsx, LayoutView.tsx | The canvas — renders nodes/edges, handles pan/zoom/select |
| `<ReactFlowProvider>` | CanvasContainer.tsx, PreviewTab.tsx, testProviders.tsx | Context wrapper for `useReactFlow()` |

### ReactFlow Props Used (Map.tsx)

```
defaultNodes, defaultEdges             → initial data (uncontrolled mode)
onNodesChange, onEdgesChange           → change stream
onNodeDragStart, onNodeDrag, onNodeDragStop → drag lifecycle
onEdgesDelete, onConnect               → connection management
isValidConnection                       → port polarity validation
onSelectionChange                       → selection tracking
onNodeDoubleClick, onNodeClick         → open editor
onPaneContextMenu, onNodeContextMenu   → context menus
onSelectionContextMenu, onEdgeContextMenu
onEdgeClick, onPaneClick               → deselect / inspect
onNodeMouseEnter, onNodeMouseLeave     → flow trace hover
onMoveStart, onMouseDown               → dismiss narrative
nodeTypes, edgeTypes                   → component registries
defaultEdgeOptions                      → default edge style
minZoom, nodeDragThreshold             → config
panOnDrag, selectionOnDrag, selectionMode → selection mode toggle
connectionRadius, elevateNodesOnSelect
fitView                                → initial viewport fit
```

## 2. Hooks

| Hook | File(s) | What it does |
|------|---------|-------------|
| `useReactFlow()` | Map.tsx, Metamap.tsx, useGraphOperations, useConnections, useClipboard, ZoomDebug | Get/set nodes, viewport, screen→flow coords |
| `useStore(selector)` | DynamicAnchorEdge.tsx, useLodBand.ts, ZoomDebug.tsx | Read internal RF store (node lookup, zoom level) |
| `useNodeId()` | ConstructNode, OrganizerNode | Get current node's ID inside custom node component |
| `useConnection()` | ConstructNode | Active connection drag state (for drop zone highlighting) |
| `useUpdateNodeInternals()` | useGraphOperations | Force RF to re-measure a node after port changes |

### useReactFlow() Methods Used

| Method | File(s) | Purpose |
|--------|---------|---------|
| `reactFlow.setNodes(updater)` | Map.tsx (sync module, selection, collapse), useLayoutActions, Metamap.tsx | Push state to RF renderer |
| `reactFlow.getNodes()` | Map.tsx, useLayoutActions, useConnections, Metamap.tsx | Read current RF node state |
| `reactFlow.getNode(id)` | Map.tsx (resize handler) | Read single node |
| `reactFlow.fitView()` | Map.tsx, Metamap.tsx, LayoutView.tsx | Fit viewport to content |
| `getViewport()` / `setViewport()` | Map.tsx, Metamap.tsx, ZoomDebug | Per-page viewport save/restore, zoom in/out |
| `screenToFlowPosition()` | useGraphOperations, useClipboard | Convert screen coords to canvas coords (paste, add node) |

### useStore() Selectors

| Selector | File | Purpose |
|----------|------|---------|
| `s.nodeLookup.get(id)` → position + measured dims | DynamicAnchorEdge.tsx | Read absolute node geometry for edge anchor calculation |
| `s.transform[2]` → zoom | useLodBand.ts | Determine LOD rendering band from current zoom |
| `s.transform[2]` → zoom | ZoomDebug.tsx | Display zoom level (disabled) |

## 3. Utility Components

| Component | File(s) | What it does |
|-----------|---------|-------------|
| `<Handle>` | ConstructNode (all variants), OrganizerNode, LayoutOrganizerNode, PortDrawer, IndexBasedDropZones, SchemaNode | Port attachment point for connections |
| `<NodeResizer>` | OrganizerNode, CustomNode, ConstructNode (Simple, Default, Diamond, Circle, Document) | Drag-to-resize handles |
| `<Controls>` | Map.tsx, Metamap.tsx | Toolbar container (top-left) |
| `<ControlButton>` | Map.tsx, Metamap.tsx, ToolbarLayoutFlyouts.tsx | Individual toolbar button |

## 4. Utility Functions

| Function | File(s) | What it does |
|----------|---------|-------------|
| `applyNodeChanges(changes, nodes)` | Map.tsx, Metamap.tsx, LayoutView.tsx | Apply RF change stream to node array |
| `applyEdgeChanges(changes, edges)` | Map.tsx | Apply RF change stream to edge array |
| `addEdge(edge, edges)` | useConnections.ts | Add edge to array (dedup) |
| `getSmoothStepPath()` | DynamicAnchorEdge.tsx | Edge path calculation (fallback when no waypoints) |

## 5. Types (import type only)

| Type | Count | Files |
|------|-------|-------|
| `Node` | 22 | Almost everywhere — the canonical node shape |
| `Edge` | 14 | Edge data shape |
| `NodeChange` | 4 | Change stream discriminated union |
| `EdgeChange` | 2 | Edge change stream |
| `Connection` | 2 | New connection event |
| `NodeProps` | 3 | Custom node component props |
| `EdgeProps` | 1 | DynamicAnchorEdge |
| `ReactFlowInstance` | 1 | useLayoutActions type annotation |
| `NodeMouseHandler` | 1 | useFlowTrace |
| `OnConnect` | 1 | useConnections |
| `XYPosition` | 0 | (not directly imported — uses `{ x, y }`) |
| `Position` (enum) | 10 | Handle/edge positioning (Top, Bottom, Left, Right) |
| `SelectionMode` | 1 | Map.tsx |

## 6. CSS

```css
/* index.css */
@import '@xyflow/react/dist/style.css';
```

Single import — RF's base styles for the viewport, nodes, edges, handles, minimap, controls.

## 7. Constants/Enums

| Value | File(s) | Purpose |
|-------|---------|---------|
| `Position.Top/Bottom/Left/Right` | All node components, edge component | Handle placement, edge direction |
| `SelectionMode.Full` | Map.tsx | Selection box must fully contain nodes |
| `ConnectionMode` | (not used) | — |
| `MarkerType` | (not used) | Custom SVG arrow markers used instead |

## Summary: RF API Entry Points

| Category | Count | Complexity to Replace |
|----------|-------|-----------------------|
| `<ReactFlow>` component | 3 instances | HIGH — pan/zoom/viewport/selection/drag |
| `useReactFlow()` hook | 6 call sites | MEDIUM — thin wrapper over node/viewport state |
| `useStore()` selectors | 3 selectors | LOW — direct state reads |
| `useNodeId()` / `useConnection()` | 3 call sites | LOW — context values |
| `<Handle>` component | ~15 instances | MEDIUM — connection system |
| `<NodeResizer>` | 7 instances | MEDIUM — resize interaction |
| `<Controls>` / `<ControlButton>` | 3 instances | LOW — just a toolbar div |
| Utility functions | 4 functions | LOW — pure functions |
| Types | ~50 imports | LOW — can define own types |
| CSS | 1 import | MEDIUM — need own pan/zoom styles |
