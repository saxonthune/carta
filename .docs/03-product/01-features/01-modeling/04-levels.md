---
title: Levels
status: active
---

# Levels

Levels are separate architectural views within a single document. Each level has its own nodes, edges, and deployables. Schemas, port schemas, and schema groups are shared across all levels.

## Operations

- **Create**: Add a new empty level
- **Switch**: Select active level from a dropdown; canvas shows only that level's content
- **Rename**: Inline editing in the level dropdown (double-click name or single-click in edit mode)
- **Duplicate**: Create a copy of a level with all its content (nodes, edges, deployables)
- **Delete**: Remove a level (confirmation required if it has content)
- **Reorder**: Drag-and-drop levels in the dropdown to change their order (requires entering "Edit" mode via the edit button)
- **Copy nodes to level**: From the context menu, copy selected nodes to another level

## Behavior

- Switching levels swaps the visible nodes and edges on the canvas
- Undo/redo history is per-level (the Y.UndoManager is recreated on level switch)
- The level switcher displays in the canvas toolbar area
- Export includes all levels; import restores them
- Drag-and-drop reordering uses @dnd-kit/core with vertical list sorting strategy
- In edit mode, clicking a level name starts inline editing; outside edit mode, clicking switches levels
