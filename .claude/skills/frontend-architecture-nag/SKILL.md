# frontend-architecture-nag

Audits Carta components for layering violations, state misplacement, and refactoring opportunities.

## When to Use

Invoke after architectural changes or periodically to maintain clean separation:
- New components added
- Hook patterns change
- State management refactored
- Before major features

## What This Does

1. **Reads architecture reference docs** (frontend-architecture skill, look-and-feel, CLAUDE.md)
2. **Scans all components** and classifies by layer (base/domain/container/layout)
3. **Identifies violations** (layer mixing, state misplacement, nested containers)
4. **Generates refactoring guidance** (easy fixes get specific edits, medium get approach)
5. **Launches parallel haiku workers** for easy fixes
6. **Returns audit report** with layer violations and refactoring recommendations

## Four-Layer Model

**Base** (`src/components/ui/`):
- No business logic, no domain imports
- Generic props (variant, size, children)
- Example: Button, Input, Modal

**Domain** (feature components):
- Receives data via props
- No direct adapter access
- Local state is UI-only (hover, expanded)
- Example: ConstructNode, SchemaNode

**Container** (orchestration):
- Calls hooks (useDocument, useGraphOperations)
- Passes data down to domain components
- Example: Map, Metamap, App

**Layout** (structural):
- Purely arranges children
- No conditional logic based on user data
- Example: Grid, Stack, Panel

## Issues to Find

**Layer violations:**
- Raw HTML (`<button>`, `<input>`) in domain components → use base components
- Business logic in layout components → move to container
- Service coupling in domain components (useDocumentContext) → receive via props

**Nested containers:**
- Smart components inside smart components
- Component calls useDocument() inside Map.tsx which also calls useDocument()

**State misplacement:**
- Document data in useState (should be in Yjs adapter)
- Derived state stored instead of computed on-the-fly
- Prop drilling (props passed through 3+ components)

**Missing abstractions:**
- Repeated UI patterns (3+ places) → extract base component
- Repeated hook patterns → extract custom hook

**Premature abstractions:**
- Single-use components in ui/ → inline them

## Execution Pattern

You are opus. You do the analysis work:

### 1. Read Reference Docs
```typescript
const refs = [
  '.claude/skills/frontend-architecture/SKILL.md',
  '.cursor/rules/look-and-feel.mdc',
  'CLAUDE.md'
];
```

### 2. Scan Components
```typescript
Glob('src/components/**/*.tsx');
```

For each component, determine:
- **Layer classification** (base/domain/container/layout)
- **Hook usage** (useDocument, useState, useEffect)
- **Prop types** (generic vs domain-specific)
- **Direct adapter access** (useDocumentContext)

### 3. Classify Violations

**Easy refactorings** (give exact edits):
- Replace `<button>` with `<Button>`
- Extract 3-line JSX pattern to base component
- Remove useState duplicating adapter state

**Medium refactorings** (give guidance):
- Extract container logic to custom hook
- Split component mixing container + domain
- Introduce new base component for pattern
- Restructure props to eliminate drilling

### 4. Launch Parallel Workers (Easy Fixes Only)
```typescript
Task({
  subagent_type: 'general-purpose',
  model: 'haiku',
  prompt: `Fix layering violation in ConstructNode.tsx:

  Line 145:
  - Replace: <button className="...">Close</button>
  - With:    <Button variant="secondary" size="sm">Close</Button>

  Add import:
  - import { Button } from './ui/Button';

  Use Edit tool.`,
  description: 'Fix ConstructNode button'
})
```

### 5. Return Audit Report
```markdown
## Frontend Architecture Audit

### Layer Classification (15 components)

| Component | Layer | Issues |
|-----------|-------|--------|
| ConstructNode | Domain | 2 raw HTML buttons |
| SchemaNode | Domain | Clean |
| Button | Base | Clean |
| Map | Container | Clean |
| Header | Layout | Business logic (should be in App) |

### Easy Refactorings (4 applied)

1. **ConstructNode.tsx:145** — Raw HTML button → Button component
2. **ProjectInfoModal.tsx:67** — Raw HTML input → Input component
3. **Drawer.tsx:89** — Duplicate state → removed (use adapter)
4. **SchemaEditor.tsx:234** — Raw HTML select → Select component

### Medium Refactorings (2 need guidance)

1. **Header.tsx** — Business logic in layout component
   - Problem: Header contains theme switching logic and user settings
   - Should be: Header receives theme prop from App, App manages settings
   - Approach:
     1. Move useTheme() call to App.tsx
     2. Pass theme + setTheme as props to Header
     3. Move settings state to App
   - Files: Header.tsx, App.tsx

2. **ConstructDetailsEditor.tsx** — Mixed container + domain
   - Problem: Component both fetches schema data and renders form
   - Should be: Container fetches, domain component renders
   - Approach:
     1. Extract ConstructDetailsForm.tsx (domain component)
     2. ConstructDetailsEditor becomes container wrapper
     3. Form receives schema + onChange via props
   - Files: ConstructDetailsEditor.tsx (split into two)

### State Audit

| State | Location | Should Be | Action |
|-------|----------|-----------|--------|
| filteredNodes | Map.tsx useState | Derived from nodes + filter | Removed, compute inline |
| selectedIds | Map.tsx useState | UI state | Keep (correct) |
| schemas | Header useState | Document state | Use useDocument() |

### Summary
- 15 components audited
- 4 layer violations fixed (easy refactorings)
- 2 medium refactorings need user approval
- 9 components clean
```

## Important Notes

- **Read components first**: Always read actual code before classifying
- **Easy vs medium**: Only auto-fix mechanical changes (HTML → component)
- **Medium needs approval**: Structural changes need user decision
- **Specific instructions**: Give haiku exact imports and replacements
- **Preserve functionality**: Only change structure, not behavior

## Example Usage

```
User: "/frontend-architecture-nag" or "audit component layering"
You: [Read reference docs]
     [Scan all components, classify layers]
     [Identify 4 easy + 2 medium violations]
     [Launch 4 haiku agents for easy fixes]
     [Return audit with guidance for medium refactorings]
```
