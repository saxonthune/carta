# Style Audit Command

Audit and fix UI styling issues in Carta components.

## Usage

Run this command to audit the application UI for styling inconsistencies:
- Spacing violations (non-4px-based values)
- Button hierarchy issues (too many primary buttons)
- Color misuse (semantic mismatches, competing saturated colors)
- Typography inconsistencies
- Touch target violations

## Scope

This audit covers **application UI only**:
- Headers, panels, docks
- Buttons, forms, menus
- Modals, dialogs
- Editor chrome

**Not audited:** User-created content (node colors, schema styling, etc.)

## Process

1. Read the styling guidelines from `.cursor/rules/styling-best-practices.mdc`
2. Audit components in `src/components/`
3. Report issues found
4. Fix issues with targeted edits
5. Summarize changes

## Starting the Audit

First, read the styling best practices:

```
Read .cursor/rules/styling-best-practices.mdc
Read .cursor/rules/look-and-feel.mdc
```

Then audit the main UI components:

```
src/components/Header.tsx
src/components/Dock.tsx
src/components/ui/*.tsx
src/components/*Editor.tsx
src/components/*Modal.tsx
```

Check for:

### Spacing Issues
- `py-2.5`, `px-5` (use 4px scale: py-2, py-3, px-4, px-6)
- Inconsistent padding in similar contexts
- `margin` where `gap` would be cleaner

### Button Hierarchy
- Multiple `bg-indigo-500`, `bg-emerald-500` buttons in same area
- All buttons looking equally prominent
- Primary actions not standing out

### Color Usage
- `bg-accent` or brand colors used too liberally
- Colors not matching semantic meaning (red for non-destructive, etc.)

### Touch Targets
- Icon buttons smaller than `w-9 h-9`
- Clickable list items with insufficient height

## Fix Patterns

### Demote secondary buttons:
```tsx
// Before
className="bg-indigo-500 text-white"

// After
className="bg-surface text-content border border-border hover:bg-surface-alt"
```

### Fix spacing:
```tsx
// Before
className="px-5 py-2.5"

// After
className="px-4 py-2"
```

### Add missing focus states:
```tsx
// Before
className="rounded-lg"

// After
className="rounded-lg focus:outline-none focus:ring-2 focus:ring-accent"
```

Begin the audit now.
