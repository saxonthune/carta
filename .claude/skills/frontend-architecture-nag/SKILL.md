---
name: frontend-architecture-nag
description: Audits Carta components for layering violations, state misplacement, and refactoring opportunities
---

# frontend-architecture-nag

Audits Carta components for layering violations, state misplacement, and refactoring opportunities.

## Reference Documentation

Architecture principles live in `.docs/` (source of truth):
- **Frontend architecture** (doc02.08): Four-layer model, state partitioning, container pattern, feature boundaries, audit checklist
- **Architecture overview** (doc02.01): Layer separation, monorepo structure, data flow

Read these before auditing:
```
.docs/02-system/08-frontend-architecture.md
.docs/02-system/01-overview.md
CLAUDE.md
```

## Four-Layer Model

**Primitives** (`src/components/ui/`): No business logic, no domain imports. Generic props (variant, size, children).

**Domain** (feature components): Receives data via props. No direct adapter access. Local state is UI-only. Example: ConstructNode, SchemaNode.

**Container** (orchestration): Calls hooks (useDocument, useGraphOperations). Passes data down. Example: Map, Metamap, App.

**Layout** (structural): Purely arranges children. No conditional logic based on user data.

## Issues to Find

**Layer violations:**
- Raw HTML (`<button>`, `<input>`) in domain components → use primitives
- Business logic in layout components → move to container
- Service coupling in domain components (useDocumentContext) → receive via props

**Nested containers:**
- Smart components inside smart components
- Component calling useDocument() inside another that also calls useDocument()

**State misplacement:**
- Document data in useState (should be in Yjs adapter)
- Derived state stored instead of computed
- Prop drilling (props passed through 3+ components)

**Missing abstractions:**
- Repeated UI patterns (3+ places) → extract primitive
- Repeated hook patterns → extract custom hook

**Premature abstractions:**
- Single-use components in ui/ → inline them

## Execution Pattern

You are opus. You do the analysis work:

### 1. Read Reference Docs
```typescript
Read('.docs/02-system/08-frontend-architecture.md');
Read('.docs/02-system/01-overview.md');
Read('CLAUDE.md');
```

### 2. Scan Components
```typescript
Glob('src/components/**/*.tsx');
```

For each component, determine:
- **Layer classification** (primitive/domain/container/layout)
- **Hook usage** (useDocument, useState, useEffect)
- **Prop types** (generic vs domain-specific)
- **Direct adapter access** (useDocumentContext)

### 3. Classify Violations

**Easy refactorings** (give exact edits):
- Replace `<button>` with `<Button>`
- Extract repeated JSX pattern to primitive
- Remove useState duplicating adapter state

**Medium refactorings** (give guidance):
- Extract container logic to custom hook
- Split component mixing container + domain
- Introduce new primitive for repeated pattern
- Restructure props to eliminate drilling

### 4. Launch Parallel Workers (Easy Fixes Only)
```typescript
Task({
  subagent_type: 'general-purpose',
  model: 'haiku',
  prompt: `Fix layering violation in ConstructNode.tsx:
  Line 145: Replace <button className="...">Close</button> with <Button variant="secondary" size="sm">Close</Button>
  Add import: import { Button } from './ui/Button';
  Use Edit tool.`,
  description: 'Fix ConstructNode button'
})
```

### 5. Return Audit Report
```markdown
## Frontend Architecture Audit

### Layer Classification (15 components)
| Component | Layer | Issues |

### Easy Refactorings (4 applied)
1. **ConstructNode.tsx:145** — Raw HTML button → Button component

### Medium Refactorings (2 need guidance)
1. **Header.tsx** — Business logic in layout component
   - Problem: ...
   - Approach: ...

### State Audit
| State | Location | Should Be | Action |

### Summary
- X components audited
- Y layer violations fixed (easy)
- Z medium refactorings need user approval
- N components clean
```

## Important Notes

- **Read components first**: Always read actual code before classifying
- **Easy vs medium**: Only auto-fix mechanical changes (HTML → component)
- **Medium needs approval**: Structural changes need user decision
- **Specific instructions**: Give haiku exact imports and replacements
- **Preserve functionality**: Only change structure, not behavior
