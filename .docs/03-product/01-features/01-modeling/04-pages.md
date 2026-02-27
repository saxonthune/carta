---
title: Pages
status: active
---

# Pages

Pages are separate architectural views within a single document. Each page has its own nodes, edges, and deployables. Schemas, port schemas, and schema groups are shared across all pages.

## Component Structure

Page navigation lives in the **Navigator panel** (`Navigator.tsx`) — a persistent left-side panel (VS Code / Obsidian style) that also lists resources and provides access to the metamap. The Navigator is opened/closed via a toggle in the shell layout.

The Navigator has a **Pages section** with:
- A list of all pages, with the active page highlighted by an accent bar
- Per-page **PopoverMenu** (three-dot button, hover to reveal) for rename, duplicate, delete
- A **reorder mode** toggle (drag handle icon) that enables drag-and-drop sorting via `@dnd-kit/core`
- A **+ button** to create a new page

A **Metamap toggle button** at the top of the Navigator switches to the schema view.

A **Resources section** below Pages lists all document resources, each clickable to open its `ResourceView`.

## Operations

- **Switch**: Click a page row in the Navigator panel
- **Create**: Click the + button in the Navigator's Pages section header
- **Duplicate**: Hover a page row, click three-dot menu → Duplicate
- **Delete**: Hover a page row, click three-dot menu → Delete (confirmation required if page has content)
- **Reorder**: Click the reorder mode button to enter drag mode; drag page rows to reposition
- **Rename**: Hover a page row, click three-dot menu → Rename; or enter reorder mode and click the page name
- **Copy nodes to page**: From the canvas context menu, copy selected nodes to another page

## Behavior

- Switching pages swaps the visible nodes and edges on the canvas
- Undo/redo history is per-page (the Y.UndoManager is recreated on page switch)
- The Navigator panel displays in the left shell area
- Export includes all pages; import restores them
- Drag-and-drop reordering uses `@dnd-kit/core` with vertical list sorting strategy
- In reorder mode, clicking a page name starts inline editing; outside reorder mode, clicking switches pages
