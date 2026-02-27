---
title: Keyboard and Clipboard
status: active
---

# Keyboard and Clipboard

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+Z | Undo |
| Ctrl+Y / Ctrl+Shift+Z | Redo |
| Ctrl+C | Copy selected nodes |
| Ctrl+V | Paste nodes |
| Delete / Backspace | Delete selected nodes |
| F2 | Rename selected node (single selection) |
| Ctrl+G | Group selected nodes (requires 2+ selected) |
| V | Toggle selection mode |

## Copy and Paste

- Copy single or multiple selected nodes
- Paste places nodes at cursor position or with relative offset from original positions
- Paste via context menu places at the right-click location
- Copied nodes get new semantic IDs (fresh identifiers)
- All field values are preserved in copies
- Connections between copied nodes are preserved if both endpoints are in the selection

## Undo and Redo

- Per-page undo history via Yjs UndoManager
- Tracks changes with 'user' origin (excludes remote collaboration changes)
- Local per-user — undo/redo is not shared in collaboration mode
- Visual indicators show enabled/disabled state
- Undo/redo buttons also available in canvas zoom controls
