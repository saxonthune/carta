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

- **Pill** (zoomed out, below ~0.5x): Minimal rounded display showing only schema icon and color. Optimized for overview navigation.
- **Compact** (mid-zoom, ~0.5x-1.0x): Smaller nodes with title and primary fields only.
- **Normal** (zoomed in, above ~1.0x): Full detail with all visible fields, ports, and controls.

LOD thresholds are configured in `lodPolicy.ts`. Transitions are discrete (no animation between bands).

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
