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

## Level of Detail

The canvas renders nodes in three LOD bands based on zoom level:

- **Pill** (zoomed out, below ~0.5x): Colored bar showing schema name and pill-tier field value. Hover shows full title tooltip. Optimized for overview navigation.
- **Compact** (mid-zoom, ~0.5x-1.0x): Header bar with schema name, pill-tier value prominently displayed, and minimal-tier fields below.
- **Normal** (zoomed in, above ~1.0x): Full detail with pill-tier field at top, minimal-tier fields in summary view, all fields in details view. Includes ports and controls.

LOD levels respect field display tiers (pill, minimal, details, full). The pill field (typically a title or name) appears at all LOD levels for consistent identification. LOD thresholds are configured in `lodPolicy.ts`. Transitions are discrete (no animation between bands).

## Selection

- Click to select a single node
- Box-select by dragging on empty canvas (full enclosure mode)
- Multi-select shows NodeControls toolbar (rename, delete, copy)

## Context Menu

Right-click on canvas, node, or edge opens a context menu:

- **Canvas**: Add construct (grouped by schema group), create new schema, create new group, paste
- **Node**: Delete, copy, rename, add related construct (with port/type submenu), copy to another level
- **Edge**: Delete

## Zoom Controls

Custom controls in bottom-left corner:
- Zoom in / zoom out buttons
- Fit view button
- Undo / redo buttons

## Deployable Backgrounds

When constructs are assigned to deployables, subtle colored backgrounds appear behind grouped constructs to visually indicate deployment boundaries.

## Full View Window

Nodes have a "full view" button in their header that opens a draggable, pinnable window displaying comprehensive node information:

- **Draggable**: Click and drag the header to reposition
- **Pinnable**: Pin button keeps window open when clicking outside (otherwise auto-closes)
- **No backdrop**: Window floats over canvas without darkening background
- **Island UX**: Follows depth-3 ground with depth-2 island sections for Fields, Deployable, Identity, Connections, and Compile Preview
- **Read-only**: Displays all field values, deployable assignment, semantic/technical IDs, connections, and single-construct compile preview

This allows comparing detailed information while continuing to work on the canvas.
