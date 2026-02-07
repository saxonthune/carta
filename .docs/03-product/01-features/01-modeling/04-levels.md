---
title: Levels
status: active
---

# Levels

Levels are separate architectural views within a single document. Each level has its own nodes, edges, and deployables. Schemas, port schemas, and schema groups are shared across all levels.

## Component Structure

The level feature is the union of two distinct parts:

1. **Current Level Info** — always-visible bar showing the active level name. Click the name to rename it inline (Obsidian/Excalidraw pattern: current-item names are click-to-edit text fields). This is an operation on the current context and does not require opening the selector.
2. **Level Selector** — dropdown opened via the chevron trigger. Its purpose is *switching* between levels, plus bulk management (create, delete, duplicate, reorder). Renaming the current level should not require opening the selector — that conflates navigation with editing.

This separation reflects a UX principle: operations on the current context (rename) belong in the persistent display; operations that change which context is active (switch) belong in a transient selector.

## Operations

- **Rename (current)**: Click the level name in the toolbar bar to rename inline — no dropdown needed
- **Switch**: Click the chevron to open the level selector; click a level row to switch
- **Create**: "+ New Level" at the bottom of the selector dropdown
- **Duplicate**: Hover a level row in the selector, click the copy icon
- **Delete**: Hover a level row in the selector, click the X icon (confirmation required if level has content)
- **Reorder**: Enter edit mode (pencil button, visible when selector is open) to drag-and-drop reorder
- **Rename (other)**: In the selector's edit mode, click a level name to rename inline
- **Copy nodes to level**: From the canvas context menu, copy selected nodes to another level

## Behavior

- Switching levels swaps the visible nodes and edges on the canvas
- Undo/redo history is per-level (the Y.UndoManager is recreated on level switch)
- The level feature displays in the canvas toolbar area (top-right)
- Export includes all levels; import restores them
- Drag-and-drop reordering uses @dnd-kit/core with vertical list sorting strategy
- In edit mode, clicking a level name starts inline editing; outside edit mode, clicking switches levels
