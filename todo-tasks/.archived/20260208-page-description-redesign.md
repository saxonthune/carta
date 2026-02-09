# Page Description UI Redesign

## Motivation

The page-description-ui agent placed description editing inside the page selector dropdown. This doesn't make natural sense — the selector is for switching pages, not editing metadata. The description should live directly below the trigger bar as its own expandable panel, visible while working on the canvas, and should hide when the page selector opens.

## Files to Modify

- `packages/web-client/src/components/PageSwitcher.tsx` — all changes are here

## Implementation Steps

### Step 1: Remove description editing from SortablePageRow

Remove from `SortablePageRowProps`:
- `editDescription`, `isEditingDescription`, `editDescriptionRef` props
- `onToggleDescriptionEdit`, `onEditDescriptionChange`, `onFinishDescriptionEdit` callbacks

Remove from `SortablePageRow` body:
- The description edit button (lines 144-153, the `<button>` with the doc-edit SVG icon)
- The description editing section (lines 182-196, the `{isEditingDescription && (...)}` block)
- The `isEditingDescription` check in `handleClick` (line 79) — restore to just `if (!editMode)`

Remove the corresponding props passed to `<SortablePageRow>` at both call sites (lines 447-469 for edit-mode, lines 475-497 for non-edit-mode):
- `editDescription={editDescription}`
- `isEditingDescription={editingDescriptionPageId === page.id}`
- `editDescriptionRef={editDescriptionRef}`
- `onToggleDescriptionEdit={handleToggleDescriptionEdit}`
- `onEditDescriptionChange={setEditDescription}`
- `onFinishDescriptionEdit={handleFinishDescriptionEdit}`

### Step 2: Remove description tooltip from trigger bar

Line 405 — remove the `title` attribute that shows `currentPage.name\ncurrentPage.description`. Replace with just `title="Click to rename"`.

### Step 3: Add description panel below the trigger bar

Below the trigger bar `<div>` (the one with `flex items-center gap-0.5`, around line 380) and above the page selector dropdown, add a new expandable description panel. This panel:

- Shows when `isDescriptionOpen` is true AND `isOpen` (selector) is false
- Is a `<div>` positioned below the trigger bar, same width or wider
- Contains a `<textarea>` that is:
  - Clearly editable (placeholder text like "Add a page description...")
  - Resizable vertically (`resize-y`)
  - Styled consistently: `bg-surface border border-border rounded-lg text-sm text-content`
  - Saves on blur via `onUpdatePage(activePage, { description: value.trim() || undefined })`
- Has a small toggle button in the trigger bar area (or at the end of the trigger bar) to show/hide. A small text/document icon works.

### Step 4: Add state for description panel

Add to the component state:
- `isDescriptionOpen` — boolean, controls panel visibility
- Initialize the textarea value from `currentPage?.description || ''`
- When `isOpen` (selector) becomes true, the description panel should hide (but `isDescriptionOpen` stays true so it reappears when selector closes)

### Step 5: Close description panel when selector opens

The rendering logic should be: show description panel when `isDescriptionOpen && !isOpen`. This means opening the chevron dropdown naturally hides the description, and closing the dropdown naturally shows it again.

### Step 6: Clean up unused state

Remove state and refs that are no longer needed:
- `editingDescriptionPageId` state
- `editDescription` state
- `editDescriptionRef` ref
- `handleToggleDescriptionEdit` callback
- `handleFinishDescriptionEdit` callback
- The `useEffect` that focuses the description textarea (lines 261-265)

## Constraints

- `erasableSyntaxOnly` — no constructor parameter shorthand
- All styling uses existing design system tokens (`bg-surface`, `text-content`, `border-border`, etc.)
- No new dependencies
- Description saves on blur, not on every keystroke (debounce not needed — just save the final value)

## Verification

- `pnpm build` passes
- `pnpm test` passes
- Manual: clicking the page name still triggers inline rename
- Manual: chevron still opens page selector dropdown
- Manual: description panel appears below trigger bar, is editable and resizable
- Manual: opening the selector hides the description panel
- Manual: no description editing UI remains in the selector dropdown rows
