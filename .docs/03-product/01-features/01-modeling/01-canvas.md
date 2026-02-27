---
title: Canvas
status: active
---

# Canvas

The canvas is the primary editing surface where users create and manipulate construct instances. Built on React Flow.

## Viewport

- Pan by dragging the background (middle mouse or left+right)
- Zoom with scroll wheel or custom zoom controls (1.15x step per click)
- Zoom range: 0.15x to 2.0x
- Dot-pattern background

## LOD Rendering

The canvas uses **level-of-detail (LOD) rendering** with two zoom-based bands to progressively simplify visual complexity:

| Band | Zoom Range | Visual Treatment |
|------|-----------|-----------------|
| **Pill** | < 0.5x | Colored chip with schema type + display name, minimal shadow, no port drawer |
| **Normal** | ≥ 0.5x | Full node card with header, display field, summary/details modes, port drawer, controls |

**Transitions**: LOD band changes use `opacity` cross-fade (120ms) to avoid jarring jumps. The band is determined by discrete zoom thresholds, not continuous interpolation.

**Implementation**: `packages/web-client/src/components/canvas/lod/lodPolicy.ts` defines band thresholds. The `useLodBand` hook returns the current discrete band based on viewport zoom.

## Selection

- Click to select a single node
- Box-select by dragging on empty canvas (full enclosure mode)
- Multi-select shows NodeControls toolbar (rename, delete, copy)

## Context Menu

Right-click on canvas, node, or edge opens a context menu:

- **Canvas**: Add construct (grouped by schema group), create new schema, create new organizer, paste
- **Node**: Delete, copy, rename, add related construct (with port/type submenu), copy to another level, organize selected (multi-select), remove from organizer
- **Edge**: Delete

## Zoom Controls

Custom controls in bottom-left corner:
- Zoom in / zoom out buttons
- Fit view button
- Undo / redo buttons

## Organizers

Organizers let users arrange constructs into visually organized collections. They are purely a canvas feature — never compiled, never part of the semantic model. The word "parent/child" is reserved for the port system; constructs inside an organizer are **members**. See doc02.09 for the full architectural description.

### Layout Strategies

Each organizer has a layout strategy:

| Strategy | Behavior |
|----------|----------|
| **Freeform** | Members positioned freely within resizable bounds (default) |
| **Stack** | One member visible at a time, arrow navigation between members |
| **Grid** | Members auto-arranged in a resizable grid |

### Display States

- **Expanded**: Shows the layout with its members. Appearance depends on layout strategy.
- **Collapsed**: Compact chip showing organizer name and member count. All members hidden. Edges to/from hidden members reroute to the chip.

### Operations

| Action | Method |
|--------|--------|
| Create organizer | Select 2+ nodes, press Ctrl+G or right-click → "Organize Selected" |
| Add to organizer | Ctrl+drag node into organizer bounds (narrator hint confirms action) |
| Remove from organizer | Ctrl+drag node out (narrator hint confirms detach), or right-click → "Remove from Organizer" |
| Collapse/expand | Click eye icon in organizer header |
| Change layout | (Context menu on organizer) |

**Ctrl+Drag Details:**

**Adding to organizer:**
1. Drag a construct over an organizer
2. Hold Ctrl — narrative shows "Release to add to {organizer name}"
3. Release to add construct as a member
4. The construct's position becomes relative to the organizer
5. The organizer automatically resizes to fit

**Removing from organizer:**
1. Drag a construct that's inside an organizer
2. Hold Ctrl — narrative shows "Release to detach from {organizer name}"
3. Release to detach
4. The construct's position converts to absolute canvas coordinates
5. The organizer shrinks to fit remaining members

**Validation:**
- Constructs can always be added to organizers
- Wagon organizers can only be added if their construct is already a member
- General-purpose organizers cannot nest (except via wagon attachment)

### Nesting Rules

Organizers can nest — a freeform organizer can contain other organizers. Stack and grid organizers accept only constructs, not other organizers. Business rules are enforced at the attach point.

### Organizers vs. Connections

Organizers and port connections are completely independent systems. Dropping a node into an organizer never creates a connection. Connecting two nodes via ports never puts them in the same organizer. Organizers serve the human (spatial convenience); connections serve the AI (semantic meaning). See doc02.09.

## Full View Window

Nodes have a "full view" button in their header that opens a draggable, pinnable window displaying comprehensive node information:

- **Draggable**: Click and drag the header to reposition
- **Pinnable**: Pin button keeps window open when clicking outside (otherwise auto-closes)
- **No backdrop**: Window floats over canvas without darkening background
- **Island UX**: Follows depth-3 ground with depth-2 island sections for Fields, Identity, Connections, and Compile Preview
- **Read-only**: Displays all field values, semantic/technical IDs, connections, and single-construct compile preview

This allows comparing detailed information while continuing to work on the canvas.
