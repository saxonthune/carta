---
name: style-nag
description: Audits and fixes UI styling inconsistencies in Carta's application chrome
---

# style-nag

Audits and fixes UI styling inconsistencies in Carta's application chrome (not user content).

## Reference Documentation

Standards live in `.carta/` (source of truth):
- **Design system** (doc02.07): Depth system, spacing scale, button hierarchy, semantic colors, typography, text-halo
- **UX principles** (doc01.04): Fitts's Law, Hick's Law, Doherty Threshold, feedback latency targets

Read these before auditing:
```
.carta/02-system/07-design-system.md
.carta/01-context/04-ux-principles.md
src/index.css
```

## Scope

**Audit:** Application chrome only — headers, toolbars, sidebars, buttons, forms, modals, panels, drawers, menus, popovers.

**Ignore:** User-created content — node colors, schema styling, construct backgrounds, deployable colors.

## What to Check

**Spacing violations:**
- Non-4px values (py-2.5, px-5, gap-3)
- Margin instead of gap in flex/grid
- Inconsistent padding in similar contexts

**Button hierarchy:**
- Multiple primary buttons competing in the same view
- Missing visual distinction (primary/secondary/tertiary)
- Inconsistent sizing

**Color misuse:**
- Overuse of accent color
- Multiple saturated colors competing
- Colors not matching semantic meaning (doc02.07)

**Touch targets:**
- Icon buttons < 36x36px (w-9 h-9)
- Clickable areas too small

**Typography:**
- Inconsistent text sizes for similar content
- Wrong font weights

**UX law violations:**
- Primary actions far from interaction point (Fitts's Law)
- Too many equal-weight options (Hick's Law)
- Click feedback > 100ms (Doherty Threshold)

## Execution Pattern

You are opus. You do the analysis work:

### 1. Read Reference Docs (Parallel)
```typescript
Read('.carta/02-system/07-design-system.md');
Read('.carta/01-context/04-ux-principles.md');
Read('src/index.css');
```

### 2. Scan Components
```typescript
Glob('src/components/ui/*.tsx');
Glob('src/components/*{Modal,Editor,Header,Drawer}.tsx');
```

For each component, check spacing, button classes, color usage, touch targets against doc02.07 standards.

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
  Line 42: Replace className="px-5 py-2.5" with className="px-4 py-2"
  Line 58: Replace className="w-8 h-8" with className="w-9 h-9"
  Use Edit tool for each change.`,
  description: 'Fix Header.tsx styling'
})
```

### 5. Return Audit Report
```markdown
## Style Audit Summary

### Components Audited (8)
### Issues Fixed (12)
### Files Modified (4)
### Clean Components (4)
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
- **Specific instructions**: Give haiku exact line numbers and replacement text
- **Parallel execution**: Launch all workers in one message
