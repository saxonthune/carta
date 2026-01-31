# style-nag

Audits and fixes UI styling inconsistencies in Carta's application chrome (not user content).

## When to Use

Invoke after UI changes or periodically to maintain styling consistency:
- New components added
- Buttons, forms, or modals modified
- Spacing or color changes made
- Before releasing features

## What This Does

1. **Reads styling reference docs** (ux-principles, styling-best-practices, look-and-feel)
2. **Scans application UI components** for inconsistencies
3. **Identifies issues** (spacing violations, button hierarchy, color misuse)
4. **Generates fix instructions** for each component
5. **Launches parallel haiku workers** to apply fixes
6. **Returns audit report** with changes made

## Scope

**Audit:** Application chrome only
- Headers, toolbars, sidebars
- Buttons, forms, inputs
- Modals, panels, drawers
- Menus, dropdowns, popovers

**Ignore:** User-created content
- Node colors and styling
- Schema definitions
- Construct backgrounds
- Deployable colors

## Common Issues to Find

**Spacing violations:**
- Non-4px values (py-2.5, px-5, gap-3)
- Margin instead of gap in flex/grid
- Inconsistent padding in similar contexts

**Button hierarchy:**
- Multiple primary buttons competing
- Missing visual distinction (primary/secondary/tertiary)
- Inconsistent sizing

**Color misuse:**
- Overuse of accent color
- Multiple saturated colors competing
- Colors not matching semantic meaning

**Touch targets:**
- Icon buttons < 36x36px
- Clickable areas too small

**Typography:**
- Inconsistent text sizes for similar content
- Wrong font weights

## Execution Pattern

You are opus. You do the analysis work:

### 1. Read Reference Docs (Parallel)
```typescript
const refs = [
  '.claude/skills/ux-principles/SKILL.md',
  '.cursor/rules/styling-best-practices.mdc',
  '.cursor/rules/look-and-feel.mdc',
  'src/index.css'
];
```

### 2. Scan Components
```typescript
Glob('src/components/ui/*.tsx');
Glob('src/components/*{Modal,Editor,Header,Drawer}.tsx');
```

For each component, check:
- Spacing values (should be multiples of 4px: p-1=4px, p-2=8px, p-3=12px, p-4=16px)
- Button classes (primary should be accent, secondary neutral)
- Color usage (semantic meaning matches visual)
- Touch targets (w-9 h-9 minimum for icon buttons = 36px)

### 3. Generate Fix Instructions
For each issue:
```markdown
## Header.tsx:42
**Issue:** Non-standard spacing
**Current:** className="px-5 py-2.5"
**Fix:** className="px-4 py-2"
```

### 4. Launch Parallel Workers
```typescript
Task({
  subagent_type: 'general-purpose',
  model: 'haiku',
  prompt: `Fix styling in src/components/Header.tsx:

  Line 42:
  - Replace: className="px-5 py-2.5 bg-accent"
  - With:    className="px-4 py-2 bg-accent"

  Line 58:
  - Replace: className="w-8 h-8"
  - With:    className="w-9 h-9"

  Use Edit tool for each change.`,
  description: 'Fix Header.tsx styling'
})
```

### 5. Return Audit Report
```markdown
## Style Audit Summary

### Components Audited (8)
- Header.tsx
- Drawer.tsx
- ProjectInfoModal.tsx
- ...

### Issues Fixed (12)
- 5 spacing violations (non-4px values → standard spacing)
- 4 button hierarchy issues (multiple primary → primary + secondary)
- 2 touch target violations (< 36px → 36px minimum)
- 1 color usage issue (accent overuse → neutral secondary)

### Files Modified (4)
- Header.tsx - Fixed spacing (px-5 → px-4)
- Drawer.tsx - Button hierarchy (2 primary → 1 primary, 1 secondary)
- ProjectInfoModal.tsx - Touch targets (w-8 → w-9)
- ConstructDetailsEditor.tsx - Spacing consistency

### Clean Components (4)
- Map.tsx
- ConstructNode.tsx
- SchemaNode.tsx
- BundledEdge.tsx
```

## Standard Patterns

**Primary button:**
```tsx
className="px-4 py-2 bg-accent text-white rounded-lg font-medium hover:bg-accent-hover"
```

**Secondary button:**
```tsx
className="px-4 py-2 bg-surface text-content border border-border rounded-lg hover:bg-surface-alt"
```

**Icon button:**
```tsx
className="w-9 h-9 flex items-center justify-center rounded-lg text-content-muted hover:bg-surface-alt"
```

**Form input:**
```tsx
className="w-full px-3 py-2 rounded-md border border-subtle bg-surface text-content focus:border-accent focus:ring-1 focus:ring-accent"
```

## Important Notes

- **Read components first**: Always read actual component code before suggesting fixes
- **Preserve functionality**: Only change styling classes, not logic
- **Match existing patterns**: Use Button component if it exists, don't create new variants
- **Specific instructions**: Give haiku exact line numbers and replacement text
- **Parallel execution**: Launch all workers in one message

## Example Usage

```
User: "/style-nag" or "audit ui styling"
You: [Read reference docs]
     [Scan UI components]
     [Identify 12 issues across 4 files]
     [Generate fix instructions]
     [Launch 4 haiku agents in parallel]
     [Return audit summary]
```
