# MapV2 Parity Checklist

What the new system (MapV2 + Canvas + CanvasEngine) needs to match from the old system (Map + ReactFlow).

**Status key:** done = MapV2 has it, partial = exists but broken/incomplete, missing = not implemented

---

## 1. Construct Node Rendering

### 1.1 Shape Dispatch

The old system dispatches to different visual components based on `schema.nodeShape` + LOD band. MapV2 currently renders everything as a rectangle.

| Shape | Old Component | Visual Treatment | MapV2 Status |
|-------|--------------|-----------------|--------------|
| `default` | `ConstructNodeDefault` | Card with header bar + fields + port drawer | partial — has header+fields but wrong styling |
| `simple` | `ConstructNodeSimple` | Sticky-note style, direct textarea editing, no header | missing |
| `circle` | `ConstructNodeCircle` | Circular node, centered name, aspect-ratio locked | missing |
| `diamond` | `ConstructNodeDiamond` | Rotated square (45deg), centered name, aspect-ratio locked | missing |
| `document` | `ConstructNodeDocument` | Rectangle with wavy SVG bottom edge, centered name | missing |
| `marker` (LOD) | `ConstructNodeMarker` | Pill chip: color swatch + schema:name | partial — exists but uses wrong label |

**Design question:** How should the canvas engine support shape variants? Options:
- MapV2 does the dispatch itself (switch on `schema.nodeShape`, render different HTML/SVG per shape)
- Canvas engine accepts a `shape` prop on nodes and provides primitives (circle container, diamond container, document container) that consumers pick from

### 1.2 Display Name Resolution

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Display name via `getDisplayName(data, schema)` | Uses `displayField` from schema to resolve a human name | Uses `data.label ?? data.semanticId ?? node.id` | **broken** — shows raw semanticId like "bpmn-event-vtsa..." |
| Schema type label | `schema.displayName` shown as muted header text | `schema.displayName` shown in badge, but alongside raw label | partial |

**Fix:** MapV2 line 364 needs to call `getDisplayName(data, schema)` instead of the current fallback chain.

### 1.3 Card Styling (Default Shape)

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Left accent bar | `borderLeft: 2px solid color-mix(...)` | `border: 2px solid ${color}` (full border, not left-only) | **wrong** |
| Header background | `bg-surface-alt rounded-t-lg` | Inline style with no surface-alt | missing |
| Body background | `bg-surface` | `var(--color-surface)` | done |
| Shadow system | `var(--node-shadow)` / `var(--node-shadow-selected)` | No shadow, uses colored border outline | **missing** |
| Selection ring | `ring-2 ring-accent/30` | `outline: 2px solid var(--color-accent)` | partial — works but different visual |
| Selection dot | Absolute positioned accent dot top-right | Not present | missing |
| Typography tokens | `text-node-xs`, `text-node-lg`, `text-node-base` | Raw `fontSize: 9/12px` inline styles | **wrong** — should use design system tokens |
| Min/max width | `min-w-[180px] max-w-[280px]` | No max constraint | partial |
| Rounded corners | `rounded-lg` (8px) | `borderRadius: 6` | close enough |

### 1.4 Marker/Pill LOD Band

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Pill styling | `color-mix(in srgb, ${color} 25%, var(--color-surface))` bg, shadow, rounded-lg | `var(--color-surface)` bg, left border accent, rounded-sm | **different** |
| Text | `schema.displayName: displayValue` with opacity fade on type | `schema.displayName: label` (wrong label) | **broken** |
| Icon | `resolveNodeIcon` shown | `resolveNodeIcon` shown | done |
| Color swatch | 12px rounded-sm square | 8px rounded-sm square | close |
| Font size | 24px (large for visibility at low zoom) | 12px | **wrong** — too small |
| LOD crossfade | 120ms opacity transition on band change | No crossfade | missing |

### 1.5 Field Rendering (Default Shape)

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Field list via `getFieldsForSummary` | Yes | Yes | done |
| Inline editing (click to edit) | Yes — text, number, boolean, enum, multiline | Yes — same types | done |
| Hover feedback on fields | `hover:bg-surface-alt rounded px-1 -mx-1` | No hover feedback | missing |
| Field label typography | `text-node-xs text-content-subtle` | `fontSize: 10, color: var(--color-content-subtle)` | partial |
| Value formatting | `formatValue()` helper (null → "—", array → "N items") | Raw `String(value)` | **wrong** |

---

## 2. Organizer Rendering

### 2.1 Expanded Organizer

| Feature | Old Map (`OrganizerNode.tsx`) | MapV2 | Status |
|---------|------------------------------|-------|--------|
| Background | `color-mix(in srgb, ${color} ${bgMix}%, var(--color-canvas))` — tinted, fully opaque | `transparent` | **missing** |
| Border | `1px solid color-mix(in srgb, ${color} ${borderMix}%, var(--color-canvas))` — subtle solid | `2px dashed ${color}` — thick dashed | **wrong** |
| Depth-adjusted tint | `bgMix = 18 + depth * 4` for nesting levels | No depth handling | missing |
| Header bar | Colored header area with `${color}15` bg, containing: color dot, name, child count badge, layout menu, collapse toggle | Centered label only | **missing** |
| Color dot | Clickable, opens color picker popover | Not present | missing |
| Name editing | Click-to-rename via input field | Not present | missing |
| Child count badge | Pill badge: `color-mix(in srgb, ${color} 20%, var(--color-canvas))` | Not present | missing |
| Layout menu | DotsThreeVertical → dropdown: spread, flow, grid, fit, pin, tidy | Not present | missing |
| Collapse toggle | EyeIcon button → toggles collapse | Double-click only | partial |
| Pin indicator | PushPin icon when `layoutPinned` | Not present | missing |
| Hover/drop feedback | Box-shadow glow on hover/drop-target | No visual feedback | missing |
| Shadow | `0 1px 3px rgba(0,0,0,0.04)` | None | missing |
| Corners | `rounded-xl` (12px) | `borderRadius: 8` | close |
| Resize handles | RF `NodeResizer` with accent styling | Bottom-right resize gripper | partial |

### 2.2 Collapsed Organizer (Chip)

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Chip rendering | 140px+ pill with color-mixed bg, border, shadow | Not implemented (collapse state not rendered differently) | **missing** |
| Color dot + name + count | All present in chip | N/A | missing |
| Collapse/expand toggle | EyeOffIcon in chip | N/A | missing |
| Edge remapping handles | Hidden RF Handles for edges to remap to chip | N/A | missing |

---

## 3. Port Drawer & Connections

### 3.1 Port Drawer

| Feature | Old Map (`PortDrawer.tsx`) | MapV2 | Status |
|---------|---------------------------|-------|--------|
| Collapsed strip | `bg-surface-alt` strip with colored dots, hover-to-expand | Inline dot strip at node bottom | partial |
| Expanded drawer | Overlays downward below node, shows port circles with labels, draggable connection source handles | Expands inline below node | partial |
| Handle prefix system | `drawer:` prefix prevents collision with anchor handles | Not needed (no RF) but equivalent? | N/A |
| Color picker dropper | PencilSimple icon in drawer for simple-mode color changes | Not present | missing |
| Port connection initiation | Drag from drawer handle starts RF connection | Uses `ConnectionHandle` from canvas engine | done |

### 3.2 Connection Drop Zones

| Feature | Old Map (`IndexBasedDropZones.tsx`) | MapV2 | Status |
|---------|-------------------------------------|-------|--------|
| Full-node overlay during connection drag | Splits node into colored zones per port, valid ports highlighted | Inline zones with colored bg + dotted borders | done |
| Port compatibility coloring | Valid = port color @ 40%, invalid = gray | Same approach | done |
| canConnect validation | Via `canConnect(sourcePortType, targetPortType)` | Same | done |

---

## 4. Edge Rendering

| Feature | Old Map (`DynamicAnchorEdge.tsx`) | MapV2 | Status |
|---------|----------------------------------|-------|--------|
| Bezier paths | Smoothstep-style via RF | `computeBezierPath` from `edgeGeometry.ts` | done |
| Waypoint routing | Orthogonal paths via `waypointsToPath` | Same utility | done |
| Dynamic anchoring | Rect boundary point calculation | `getRectBoundaryPoint` | done |
| Edge bundling | `useEdgeBundling` → count badge, thicker stroke | Bundle count badge + stroke scaling | done |
| Polarity-based arrows | Arrow markers when not bidirectional | Same logic | done |
| Edge click narrative | Shows from→to narrative with port info | Shows narrative | done |
| Edge color from theme | `useEdgeColor` hook | Hardcoded fallback color | partial |
| Dimmed edges (flow trace) | opacity 0.15 when dimmed | Same | done |

---

## 5. LOD (Level of Detail)

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| LOD bands | marker (<0.5), normal (>=0.5) | Same two bands | done |
| Band detection | `useLodBand` via RF `useStore` (no re-renders during zoom, only on crossing) | `useState` + `useEffect` on `transform.k` | done but less efficient |
| Crossfade transition | 120ms opacity fade between bands | None | missing |
| Per-node LOD props | `lodTransitionStyle` passed to variants | Not applicable (inline rendering) | N/A |

---

## 6. Interactions

### 6.1 Node Drag

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Single node drag | RF native | `useNodeDrag` engine hook | done |
| Multi-select drag | RF native (all selected move) | Manual: moves all selected + wagon followers | done |
| Wagon follower drag | Via node pipeline data injection | `useNodeLinks` + `getFollowers` | done |
| Ctrl+drag attach/detach | Ctrl+drag over organizer → attach; out → detach | Same logic via `findContainerAt` | done |
| Narrative hints during drag | Shows "Hold Ctrl to add to {name}" / "Release to..." | Same | done |
| Organizer auto-fit after drag | `fitToChildren` on parent org after member drag | Not present | **missing** |
| Waypoint clearing on drag | Clears routed waypoints for edges connected to moved nodes | Not present | **missing** |

### 6.2 Node Resize

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Construct resize | RF `NodeResizer` on selected nodes | `useNodeResize` engine hook (organizers only) | partial — constructs can't resize |
| Organizer resize | RF `NodeResizer` with styled handles | Engine resize (bottom-right gripper only) | partial |
| Aspect-ratio lock | Circle/diamond shapes: `keepAspectRatio={true}` | Not applicable (shapes not implemented) | missing |

### 6.3 Selection

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Click to select | RF native | `useSelection` engine hook | done |
| Multi-select (shift+click) | RF native | Engine selection | done |
| Box select | RF native + `SelectionMode` toggle | `useBoxSelect` engine hook | done |
| Selection mode toggle (V key) | Toggle between pan-first and select-first | Same | done |
| Select all (Cmd+A) | Selects all constructs | Same | done |
| Ctrl+G to group | Creates organizer from selection | Not implemented | **missing** |

### 6.4 Clipboard

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Copy (Cmd+C) | `useClipboard` hook | Inline clipboard | done |
| Paste (Cmd+V) | Paste with offset | Paste with offset + canvas position | done |
| Copy nodes to new page | Context menu → "Copy to new page" | Not present | missing |

### 6.5 Keyboard Shortcuts

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Undo/Redo (Cmd+Z/Y) | Yes | Yes | done |
| Delete (Del/Backspace) | Yes | Yes | done |
| F2 to rename | Triggers inline rename on selected node | Not present | missing |
| Copy/Paste (Cmd+C/V) | Yes | Yes | done |

---

## 7. Context Menus

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Pane context menu | Right-click canvas → add node, paste | Right-click canvas → same | done |
| Node context menu | Right-click node → edit, delete, copy, debug, group, detach, etc. | Right-click node → same menu | done |
| Edge context menu | Right-click edge → delete | Not present | missing |
| Selection context menu | Right-click selection → group, delete, copy | Not present | missing |
| "Add related construct" | Context menu shows related types via schema relationships | Not present | **missing** |

---

## 8. Organizer Operations

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Create organizer from selection | Cmd+G or context menu | Not available | **missing** |
| Create attached organizer (wagon) | Context menu on construct | Not available | missing |
| Detach from organizer | Context menu or Ctrl+drag out | Ctrl+drag out only | partial |
| Toggle collapse | Double-click or eye button | Double-click only | partial |
| Rename organizer | Click name → inline edit | Not available | **missing** |
| Color picker | Click color dot → popover palette | Not available | missing |
| Layout: spread children | Header menu | Not available | missing |
| Layout: flow children | Header menu | Not available | missing |
| Layout: grid children | Header menu (1-4 cols, auto) | Not available | missing |
| Layout: fit to children | Header menu | Not available | missing |
| Layout: recursive tidy | Header menu | Not available | missing |
| Layout: pin/unpin | Header menu | Not available | missing |

---

## 9. Layout & Toolbar

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Zoom in/out | Custom 1.15x step | Engine zoomIn/zoomOut | done |
| Fit view | RF `fitView` | Engine `fitView` | done |
| Spread all | Toolbar | Toolbar | done |
| Compact all | Toolbar | Toolbar | done |
| Flow layout | Toolbar | Toolbar | done |
| Align nodes | Toolbar | Toolbar | done |
| Distribute nodes | Toolbar | Toolbar | done |
| Route edges | Toolbar | Toolbar | done |
| Clear routes | Toolbar | Toolbar | done |
| Apply pin layout | Toolbar | Toolbar | done |
| Layout View panel | Side panel showing layout stats | Not present | missing |
| Layout Map (mini-map) | Separate component showing overview | Not present | missing |
| Undo/redo buttons | Toolbar | Toolbar | done |
| Selection mode toggle | Toolbar | Toolbar | done |

---

## 10. Data Pipeline

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Node pipeline (`useMapNodePipeline`) | Shared hook | Same hook | done |
| Edge pipeline (`useMapEdgePipeline`) | Shared hook | Same hook | done |
| Presentation model (`usePresentation`) | Via pipeline | Via pipeline | done |
| Sequence badges | Computed + rendered | Computed + rendered | done |
| Flow trace (Alt+hover) | `useFlowTrace` hook | Same hook | done |
| Covered node detection | `useCoveredNodes` hook | Inline implementation | done |
| Edge cleanup on schema change | `useEdgeCleanup` | Not present | missing |
| Search filtering | Via pipeline | Via pipeline | done |

---

## 11. Miscellaneous

| Feature | Old Map | MapV2 | Status |
|---------|---------|-------|--------|
| Page viewport save/restore | Saves viewport per page, restores on switch | Not present | missing |
| Guide content integration | `guideContent` referenced | Not present | low priority |
| Construct editor (schema wizard) | Double-click → open | Double-click → open | done |
| Debug modal | Context menu → debug info | Context menu → debug info | done |
| Narrative pill | Edge click + drag hints | Same | done |
| DynamicAnchorEdge component | Full RF edge component with interactivity | Inline SVG rendering | equivalent |
| `data-no-pan` on nodes | Prevents pan when clicking nodes | Same attribute | done |
| Node `parentId` for organizer membership | RF native parentId → relative positioning | Manual absolute position calculation with parentId walk | done |

---

## Priority Tiers

### Tier 1 — Visual Parity (looks right)
1. Display name resolution (`getDisplayName`)
2. Card styling: left accent bar, surface-alt header, shadow system, typography tokens
3. Organizer chrome: tinted background, solid border, header bar with controls
4. Shape variants: circle, diamond, document, simple
5. Marker LOD: correct font size (24px), color-mix bg, proper label

### Tier 2 — Interaction Parity (works right)
6. Organizer header controls: collapse toggle, layout menu, color picker, rename
7. Create organizer from selection (Cmd+G)
8. Organizer auto-fit after member drag
9. Waypoint clearing on node drag
10. F2 rename shortcut
11. Construct node resize

### Tier 3 — Polish
12. LOD crossfade transitions
13. Edge context menu, selection context menu
14. "Add related construct" from context menu
15. Copy nodes to new page
16. Page viewport save/restore
17. Layout View panel, Layout Map
18. Edge cleanup on schema change
