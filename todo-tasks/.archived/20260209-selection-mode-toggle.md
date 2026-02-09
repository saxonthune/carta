# Selection Mode Toggle

## Motivation

Left-drag on empty canvas currently draws a selection lasso. This is the wrong default for an architecture editor where the primary interaction is panning, dragging nodes, and connecting ports. Accidental lasso selections create friction. Lasso/marquee selection should be an opt-in mode toggled via a toolbar button.

## Design constraint

The **only behavioral difference** between modes is whether left-drag on empty canvas pans or lassos. Left-click on a node always selects it (blue ring, updates `selectedNodeIds`) in both modes. `handleSelectionChange` is NOT gated — it always runs.

## Do NOT

- Do NOT gate `handleSelectionChange` — selection via click works in both modes
- Do NOT change edge click behavior (always selects both endpoints regardless of mode)
- Do NOT persist selection mode across page switches
- Do NOT add `SelectionMode.Partial` support
- Do NOT modify `useKeyboardShortcuts.ts` beyond adding the `V` toggle shortcut
- Do NOT change node click behavior (`onNodeClick`) — it opens the instance editor in both modes
- Do NOT add any new files — all changes are in existing files

## Files to Modify

### 1. `packages/web-client/src/components/canvas/Map.tsx`

**Add state** (near line 203, after `selectedNodeIds` state):
```typescript
const [selectionModeActive, setSelectionModeActive] = useState(false);
```

**Add toggle callback** (near other callbacks):
```typescript
const toggleSelectionMode = useCallback(() => {
  setSelectionModeActive(prev => {
    if (prev) {
      // Turning off — clear selection
      reactFlow.setNodes(nds => nds.map(n => ({ ...n, selected: false })));
      setSelectedNodeIds([]);
    }
    return !prev;
  });
}, [reactFlow]);
```

**Change ReactFlow props** (lines 1195-1197):
```typescript
// Before:
panOnDrag={[1, 2]}
selectionOnDrag
selectionMode={SelectionMode.Full}

// After:
panOnDrag={selectionModeActive ? [1, 2] : [0, 1, 2]}
selectionOnDrag={selectionModeActive}
selectionMode={SelectionMode.Full}
```

Note: `selectionMode={SelectionMode.Full}` stays — it controls how lasso inclusion works, not whether lasso is enabled.

**Add toggle button to Controls** (insert after the Hierarchical Layout button at line 1266, before the conditional selection toolbar at line 1267):
```tsx
<ControlButton
  onClick={toggleSelectionMode}
  title={selectionModeActive ? "Exit Selection Mode (V)" : "Selection Mode (V)"}
  className={selectionModeActive ? 'active' : ''}
>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="8" height="8" rx="1" strokeDasharray="3 2" />
    <path d="M14 4l3 9 2.5-2.5L23 14l-3.5-3.5L22 8z" />
  </svg>
</ControlButton>
```

The icon is a dashed selection rectangle with a cursor arrow — communicates "select mode" at a glance. Follow the existing inline SVG pattern used by all other ControlButtons.

**Style the active state.** Add a CSS class or inline style for the active toggle. Check if React Flow's `<ControlButton>` supports an `active` visual state via className. If `.active` doesn't produce a visual difference with existing styles, add a simple style: `style={selectionModeActive ? { backgroundColor: 'var(--xy-controls-button-background-color-hover, #f0f0f0)' } : undefined}`. Keep it minimal — match the hover state color to indicate "on".

**Pass `toggleSelectionMode` to useKeyboardShortcuts** (around line 285 where the hook is called):
```typescript
useKeyboardShortcuts({
  // ... existing options
  toggleSelectionMode,
});
```

### 2. `packages/web-client/src/hooks/useKeyboardShortcuts.ts`

**Add to interface** (line 16, after `selectAll`):
```typescript
toggleSelectionMode?: () => void;
```

**Add to destructuring** (line 43, after `selectAll`):
```typescript
toggleSelectionMode,
```

**Add shortcut handler** (after the Select All block ~line 101, before the `if (selectedNodeIds.length === 0) return;` guard at line 104):
```typescript
// Toggle Selection Mode: V
if (event.key === 'v' || event.key === 'V') {
  if (!event.ctrlKey && !event.metaKey && !event.shiftKey && toggleSelectionMode) {
    event.preventDefault();
    toggleSelectionMode();
  }
  return;
}
```

Important: this must be a bare `V` (no modifier keys) and must come BEFORE the `selectedNodeIds.length === 0` guard so it works even with no selection.

**Add to dependency array** (line 120):
```typescript
}, [selectedNodeIds, canPaste, undo, redo, copyNodes, pasteNodes, deleteSelectedNodes, startRename, createOrganizer, selectAll, toggleSelectionMode]);
```

**Update the doc comment** (line 19-31) to include `V: Toggle selection mode`.

## Implementation Steps

1. Add `selectionModeActive` state and `toggleSelectionMode` callback in Map.tsx
2. Change the three ReactFlow props (`panOnDrag`, `selectionOnDrag`) to be conditional on `selectionModeActive`
3. Add the toggle ControlButton after the Hierarchical Layout button
4. Style the active state of the toggle button
5. Pass `toggleSelectionMode` to `useKeyboardShortcuts`
6. Add `V` shortcut to `useKeyboardShortcuts.ts` (interface, destructuring, handler, deps)

## Constraints

- `erasableSyntaxOnly` — no `private`/`protected`/`public` constructor parameter shorthand
- Follow existing ControlButton patterns (inline SVG, title attr with shortcut hint)
- No new files — this is a 2-file change

## Verification

- `pnpm build` passes (TypeScript compilation)
- `pnpm test` passes (no regression in integration tests)
- Manual check: default left-drag on canvas should pan, pressing V should enable lasso mode, pressing V again should disable and clear selection

## Plan-specific checks

```bash
# Verify selectionOnDrag is now conditional (not a bare boolean prop)
! grep -q 'selectionOnDrag$' packages/web-client/src/components/canvas/Map.tsx
# Verify panOnDrag references selectionModeActive
grep -q 'selectionModeActive' packages/web-client/src/components/canvas/Map.tsx
# Verify V shortcut exists
grep -q "event.key === 'v'" packages/web-client/src/hooks/useKeyboardShortcuts.ts
```
