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

- **Canvas**: Add construct (grouped by schema group), create new schema, create new group, paste
- **Node**: Delete, copy, rename, add related construct (with port/type submenu), copy to another level, group selected (multi-select), remove from group
- **Edge**: Delete

## Zoom Controls

Custom controls in bottom-left corner:
- Zoom in / zoom out buttons
- Fit view button
- Undo / redo buttons

## Visual Groups

Constructs can be organized into visual groups (formerly "deployables"). Groups display as:
- **Expanded**: Colored background with group name, containing member nodes
- **Collapsed**: Compact chip showing group name and eye icon to expand

Groups support:
- Nesting via parent group relationships
- Collapse/expand toggle (eye icon)
- Ctrl+drag to remove a node from its group
- Context menu: "Group N Nodes" (multi-select), "Remove from Group" (single node)

## Full View Window

Nodes have a "full view" button in their header that opens a draggable, pinnable window displaying comprehensive node information:

- **Draggable**: Click and drag the header to reposition
- **Pinnable**: Pin button keeps window open when clicking outside (otherwise auto-closes)
- **No backdrop**: Window floats over canvas without darkening background
- **Island UX**: Follows depth-3 ground with depth-2 island sections for Fields, Deployable, Identity, Connections, and Compile Preview
- **Read-only**: Displays all field values, deployable assignment, semantic/technical IDs, connections, and single-construct compile preview

This allows comparing detailed information while continuing to work on the canvas.
