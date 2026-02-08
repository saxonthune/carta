---
title: Pages
status: active
---

# Pages

Pages are separate architectural views within a single document. Each page has its own nodes, edges, and deployables. Schemas, port schemas, and schema groups are shared across all pages.

## Component Structure

The page feature is the union of two distinct parts:

1. **Current Page Info** — always-visible bar showing the active page name. Click the name to rename it inline (Obsidian/Excalidraw pattern: current-item names are click-to-edit text fields). This is an operation on the current context and does not require opening the selector.
2. **Page Selector** — dropdown opened via the chevron trigger. Its purpose is *switching* between pages, plus bulk management (create, delete, duplicate, reorder). Renaming the current page should not require opening the selector — that conflates navigation with editing.

This separation reflects a UX principle: operations on the current context (rename) belong in the persistent display; operations that change which context is active (switch) belong in a transient selector.

## Operations

- **Rename (current)**: Click the page name in the toolbar bar to rename inline — no dropdown needed
- **Switch**: Click the chevron to open the page selector; click a page row to switch
- **Create**: "+ New Page" at the bottom of the selector dropdown
- **Duplicate**: Hover a page row in the selector, click the copy icon
- **Delete**: Hover a page row in the selector, click the X icon (confirmation required if page has content)
- **Reorder**: Enter edit mode (pencil button, visible when selector is open) to drag-and-drop reorder
- **Rename (other)**: In the selector's edit mode, click a page name to rename inline
- **Copy nodes to page**: From the canvas context menu, copy selected nodes to another page

## Behavior

- Switching pages swaps the visible nodes and edges on the canvas
- Undo/redo history is per-page (the Y.UndoManager is recreated on page switch)
- The page feature displays in the canvas toolbar area (top-right)
- Export includes all pages; import restores them
- Drag-and-drop reordering uses @dnd-kit/core with vertical list sorting strategy
- In edit mode, clicking a page name starts inline editing; outside edit mode, clicking switches pages
