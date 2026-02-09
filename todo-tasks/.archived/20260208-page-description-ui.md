# Page Description UI

> **Scope**: enhancement
> **Files to modify**: 1 (`packages/web-client/src/components/PageSwitcher.tsx`)
> **Summary**: Surface the existing `description` field on pages in the PageSwitcher trigger bar — visible, editable via auto-grow textarea, below the page name.

## Motivation

Pages have a `description?: string` field fully supported in the data model, Y.Doc, hooks, server, and MCP. But the PageSwitcher UI never shows or edits it. Descriptions help users understand what each page represents.

## Design Decisions (Resolved)

- **Layout**: Description renders below the page name in the trigger bar. Both name and description get a wider container (change `w-[120px]` to `w-[180px]`).
- **Display**: Muted secondary text (`text-xs text-content-muted`). When empty, show clickable placeholder "Add description...".
- **Editing**: Auto-grow `<textarea>` (not single-line input). Paragraphs are acceptable. Save on blur. Cancel on Escape. Enter inserts newline (no submit-on-Enter since it's multiline).
- **State pattern**: Follows the existing `isRenamingCurrent` / `currentEditName` pattern used for page name rename.

## File to Modify

**`packages/web-client/src/components/PageSwitcher.tsx`**

### Step 1: Add description editing state

After the existing rename state (line 173: `const [currentEditName, setCurrentEditName] = useState('');`), add:

```tsx
const [isEditingDescription, setIsEditingDescription] = useState(false);
const [currentEditDescription, setCurrentEditDescription] = useState('');
const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
```

### Step 2: Add focus effect for description textarea

After the existing `useEffect` for `isRenamingCurrent` (lines 207-212), add:

```tsx
useEffect(() => {
  if (isEditingDescription && descriptionTextareaRef.current) {
    descriptionTextareaRef.current.focus();
    // Place cursor at end
    const len = descriptionTextareaRef.current.value.length;
    descriptionTextareaRef.current.setSelectionRange(len, len);
  }
}, [isEditingDescription]);
```

### Step 3: Add description edit handlers

After `handleCancelCurrentRename` (line 258), add:

```tsx
const handleStartDescriptionEdit = useCallback(() => {
  if (!currentPage) return;
  setCurrentEditDescription(currentPage.description || '');
  setIsEditingDescription(true);
}, [currentPage]);

const handleFinishDescriptionEdit = useCallback(() => {
  if (activePage) {
    onUpdatePage(activePage, { description: currentEditDescription.trim() || undefined });
  }
  setIsEditingDescription(false);
}, [activePage, currentEditDescription, onUpdatePage]);

const handleCancelDescriptionEdit = useCallback(() => {
  setIsEditingDescription(false);
}, []);
```

Note: passing `undefined` when empty removes the description field rather than storing an empty string.

### Step 4: Widen the name/description container

Change the container width from `w-[120px]` to `w-[180px]`:

**Line 316, change:**
```tsx
<div className={`w-[120px] rounded px-1.5 py-0.5 -my-0.5 transition-colors ${isRenamingCurrent ? 'bg-surface-alt ring-1 ring-border' : ''}`}>
```
**To:**
```tsx
<div className={`w-[180px] rounded px-1.5 py-0.5 -my-0.5 transition-colors ${isRenamingCurrent ? 'bg-surface-alt ring-1 ring-border' : ''}`}>
```

### Step 5: Add description display/edit below the page name

After the closing `</div>` of the name container (line 338), and before the dropdown trigger button comment (`{/* Part 2: Trigger to open the page selector */}`), insert:

```tsx
{/* Page description — below name, in trigger bar */}
{isEditingDescription ? (
  <div className="w-[180px] rounded px-1.5 py-0.5 bg-surface-alt ring-1 ring-border">
    <textarea
      ref={descriptionTextareaRef}
      className="w-full py-0 text-xs bg-transparent border-none outline-none text-content-muted resize-none overflow-hidden"
      value={currentEditDescription}
      onChange={(e) => {
        setCurrentEditDescription(e.target.value);
        // Auto-grow
        e.target.style.height = 'auto';
        e.target.style.height = e.target.scrollHeight + 'px';
      }}
      onBlur={handleFinishDescriptionEdit}
      onKeyDown={(e) => {
        if (e.key === 'Escape') handleCancelDescriptionEdit();
      }}
      rows={1}
    />
  </div>
) : (
  <span
    className="block w-[180px] text-xs text-content-muted truncate cursor-text px-1.5"
    onClick={handleStartDescriptionEdit}
    title={currentPage?.description || 'Click to add description'}
  >
    {currentPage?.description || 'Add description...'}
  </span>
)}
```

**Important layout note:** The trigger bar's inner `div` (line 310) uses `flex items-center`. The description needs to be below, not beside the name. The agent should adjust the flex layout so the name+description stack vertically while the icon and chevron stay in the horizontal row. The simplest approach: wrap the name container and description in a `<div className="flex flex-col">` wrapper, keeping the icon and chevron as siblings in the outer flex row.

The resulting structure:
```
[icon] [flex-col: name / description] [chevron]
```

### Step 6: Close description editing when dropdown opens or rename starts

In `handleStartCurrentRename` (line 241), add `setIsEditingDescription(false);`.
When the dropdown opens (`setIsOpen(true)`), also `setIsEditingDescription(false);`.

## Constraints

- **No new files.** All changes in one file.
- **No new dependencies.**
- **Use existing design tokens:** `text-content-muted`, `bg-surface-alt`, `ring-border` — already used in the file.
- **Preserve existing rename behavior.** Don't break the name editing flow.
- **`erasableSyntaxOnly`**: No `private`/`protected`/`public` parameter shorthand.

## Verification

1. `pnpm build` — TypeScript compiles without errors
2. `pnpm test` — existing tests pass (no test changes needed — this is purely presentation)
3. Manual checks:
   - Page with no description shows "Add description..." placeholder
   - Clicking placeholder opens auto-grow textarea
   - Typing and blurring saves the description
   - Escape cancels editing
   - Description persists after page switch and back
   - Long descriptions truncate with ellipsis in display mode
   - Textarea grows vertically for multi-line input
   - Page rename still works correctly
   - Dropdown still works correctly

## Out of Scope

- Canvas-level rendering of page description
- Description in compiled output
- Description in dropdown page rows (could be a follow-up)
