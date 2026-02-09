# Selection Mode Toggle

> **Scope**: enhancement
> **Layers touched**: interaction, presentation
> **Summary**: Default canvas interaction should not select nodes on left-click; add a toolbar toggle that enables selection mode (click-select, ctrl+click multi-select, lasso).

## Motivation

Currently left-click always selects nodes and left-drag on empty canvas draws a selection lasso. This is the wrong default for an architecture editor where the primary interaction is panning, dragging nodes, and connecting ports. Accidental selections create friction. Selection should be an opt-in mode.

## Design

### Default mode (selection OFF)

- Left-drag on canvas = pan (add button 0 to `panOnDrag`)
- Left-click on node = opens instance editor (existing `onNodeClick` behavior) but does NOT apply selection styling
- Left-drag on node = drag/move node (unchanged)
- Middle/right-drag = pan (unchanged)
- `selectionOnDrag={false}`

### Selection mode (selection ON, toggled via toolbar button)

- Left-click on node = select it (single selection, clears previous)
- Ctrl+left-click on node = add/remove from selection (multi-select)
- Left-drag on canvas = lasso/marquee select (`selectionOnDrag={true}`, `SelectionMode.Full`)
- Middle/right-drag = pan (unchanged)

### Toolbar button

- Add a toggle button to the `<Controls>` panel (top-left) — a cursor/pointer icon or selection box icon
- Visual state: highlighted/active when selection mode is on
- Keyboard shortcut: consider `S` or `V` (common in design tools)
- When toggled off, clear current selection

### Implementation notes

- State: `const [selectionModeActive, setSelectionModeActive] = useState(false)`
- Conditionally set React Flow props based on mode:
  - `panOnDrag`: `[0, 1, 2]` when off, `[1, 2]` when on
  - `selectionOnDrag`: `false` when off, `true` when on
- Gate `handleSelectionChange` — when selection mode is off, don't update `selectedNodeIds` from React Flow's internal selection events
- Ctrl+click multi-select is native React Flow behavior when selection is enabled — no custom code needed
- The conditional selection toolbar (rename/copy/delete buttons at line 1267) continues to appear when `selectedNodeIds.length > 0`
- Keyboard shortcuts like Ctrl+A should still work regardless of mode (they programmatically set selection)

## Out of scope

- Changing edge click behavior (currently selects both endpoints — leave as-is)
- Selection mode persistence across page switches
- Partial selection mode (`SelectionMode.Partial`)
