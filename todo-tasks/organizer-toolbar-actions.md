# Organizer toolbar actions: reorganize members and fit-to-children

> **Scope**: enhancement
> **Layers touched**: presentation (OrganizerNode), interaction (Map.tsx, useOrganizerOperations)
> **Summary**: Add toolbar buttons to the organizer header row (next to the eye/collapse and spread-children buttons) for reorganizing member constructs and auto-resizing the organizer to fit its contents.

## Motivation

Organizers currently have only two buttons in the header row: toggle collapse (eye icon) and spread children (only visible with 2+ children). When working with organizers — especially via MCP where constructs land at arbitrary positions — users frequently need to:

1. **Reorganize members** into a sensible layout (grid, rows, columns) without manually dragging each one
2. **Resize the organizer** to snugly fit its current children, eliminating wasted whitespace or expanding to show clipped members

These are common enough operations that they belong in the always-visible toolbar rather than requiring right-click menus or manual resizing.

## Current state

- **OrganizerNode.tsx** renders the header row with buttons at lines 220-243
- **Spread children** button already exists (calls `deOverlapNodes()`) but only de-overlaps — it doesn't impose a layout
- **NodeResizer** provides manual drag-to-resize but no auto-fit
- **nodeActions** in Map.tsx (line 717) is the callback bag passed to all nodes
- **useOrganizerOperations.ts** handles organizer state mutations

## Proposed buttons

### 1. Fit to children (resize organizer to content bounds)
- Calculate bounding box of all member constructs (with padding)
- Resize the organizer to fit, preserving its top-left position
- Icon suggestion: a "compress/shrink" icon (opposite of expand)
- Should account for node dimensions, not just positions

### 2. Grid layout
- Arrange members in a grid (rows × columns based on count)
- Respect a configurable gap/padding
- Then auto-fit the organizer to the result
- Icon suggestion: grid/dots icon

### 3. Horizontal row layout
- Arrange members in a single horizontal row
- Auto-fit organizer width
- Icon suggestion: horizontal bars

These could also be a single button with a dropdown/popover showing layout options, to avoid overcrowding the header row. Design decision for the implementor.

## Implementation notes

- All layout logic should work on the React Flow node positions (relative to organizer origin since children use `parentId`)
- After any layout operation, call the existing `setNodes` → Yjs sync path
- The "fit to children" calculation needs to know child node dimensions — these are available from the React Flow node store (`node.measured.width/height`)
- Consider whether these should also be available in the right-click context menu for organizers

## Out of scope

- Persistent layout mode (e.g., "this organizer always uses grid") — that's a larger feature involving the organizer's `layout` property
- Nested organizer handling
