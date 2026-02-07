---
name: carta-feature-implementor
description: Reads todo plans from todo-plans/, gathers codebase context, discusses approach with the user, then either enters plan mode or implements directly.
---

# carta-feature-implementor

Reads a plan from `todo-plans/`, builds codebase context around it, discusses considerations with the user, then executes — either via plan mode (complex) or direct implementation (simple).

## When This Triggers

- "Execute a plan"
- "Work on the flow trace plan"
- "Pick up a todo plan"
- `/carta-feature-implementor`
- `/carta-feature-implementor flow-trace-visualization`

## Phase 1: Select a Plan

List plans in `todo-plans/`:

```typescript
Glob({ pattern: 'todo-plans/*.md' })
```

**If specific plan named:** Match it against filenames (fuzzy — `flow-trace` matches `flow-trace-visualization.md`). Read it fully.

**If "first" specified:** Grab the first plan alphabetically. No prompting — just start working on it.

**If "all" specified:** Read all plan files. Present a combined briefing, then work through them sequentially. Appropriate when plans are small and self-contained.

**If no argument (default):** Read the first ~10 lines of each plan file (enough to get the title and motivation), then present a summary to the user:

```typescript
// Read heads of all plans
for (const file of planFiles) {
  Read(file, { limit: 10 })
}

AskUserQuestion({
  questions: [{
    question: "Which plan should we work on?",
    header: "Plan",
    options: [
      // one per plan, label = title, description = first-line summary from motivation section
    ],
    multiSelect: false
  }]
})
```

Read the selected plan file(s) fully before proceeding.

## Phase 2: Extract Context Requirements

After reading the plan, identify what codebase context is needed. Plans reference:

- **Architectural layers** — map to `.docs/` refs via MANIFEST tags
- **Specific files or directories** — read directly
- **Domain concepts** — look up via `.docs/MANIFEST.md` tag index
- **Existing patterns** — find similar code to understand conventions

Read `.docs/MANIFEST.md` first, then read only the docs and source files the plan actually touches.

### Context Gathering Strategy

```
Plan mentions "presentation model"
  → MANIFEST tag: presentation, rendering → doc02.09, doc02.08
  → Source: Glob('**/presentationModel*')

Plan mentions "edge rendering"
  → MANIFEST tag: canvas → doc03.01.01.01
  → Source: Grep({ pattern: 'Edge', glob: '*.tsx' })

Plan mentions "interaction layer"
  → MANIFEST tag: hooks → doc02.02, doc02.08
  → Source: Glob('**/hooks/use*.ts')
```

Read docs and source in parallel. Target: read only what the plan references, not the whole codebase.

## Phase 3: Briefing

Present to the user:

### 1. Plan Summary
One paragraph restating the plan's motivation and scope in your own words. Flag anything ambiguous.

### 2. Codebase Landscape
What exists today that's relevant:
- Files/modules that will be modified or extended
- Existing patterns the implementation should follow
- Adjacent code that might be affected

### 3. Considerations
Open questions and tradeoffs the plan surfaces. These come from:
- **Plan's own "Design Decisions to Make"** section (if present)
- **Tensions** between what the plan asks for and what the code currently does
- **Scope questions** — is something in or out?
- **Ordering** — what should be built first?

Present each consideration as a concrete question with your recommendation. Use `AskUserQuestion` for decisions that affect the approach:

```typescript
AskUserQuestion({
  questions: [{
    question: "Should hop badges reflect semantic graph distance or only visible hops?",
    header: "Hop distance",
    options: [
      { label: "Semantic (Recommended)", description: "Always show true graph hops, even through collapsed organizers" },
      { label: "Visual", description: "Re-sequence to show only visible node-to-node hops" }
    ],
    multiSelect: false
  }]
})
```

Group decisions into a single `AskUserQuestion` call when possible (up to 4 questions).

## Phase 4: Decide Execution Mode

Based on the conversation, determine the right execution path:

**Enter plan mode** when:
- The plan touches 4+ files
- There are architectural decisions (new abstractions, new layers, new patterns)
- The plan says "new engine" or "new subsystem"
- The user wants to review the implementation approach before code is written

**Implement directly** when:
- The plan is scoped to 1-3 files
- The pattern is clear from existing code
- The user says "just do it" or "go ahead"
- All design decisions have been resolved in the conversation

### Plan Mode Path

```typescript
EnterPlanMode()
```

In plan mode:
1. Write an implementation plan to the plan file (specified by plan mode system message)
2. The plan should be a concrete, ordered list of file changes — not a restatement of the todo plan
3. Reference specific files, line ranges, and existing patterns
4. Each step should be independently verifiable
5. Exit plan mode with `ExitPlanMode()` for user approval

### Direct Implementation Path

Implement the changes directly. Follow these principles:
- Read before writing — understand existing code before modifying
- Follow existing patterns — match the style of adjacent code
- Build incrementally — get one piece working before starting the next
- Run tests after changes: `pnpm build && pnpm test`

## Phase 5: Post-Implementation

After implementation (whether via plan mode or direct):

1. **Build check**: `pnpm build`
2. **Test check**: `pnpm test`
3. **Delete the completed plan file** from `todo-plans/`

Suggest follow-up skills if relevant:
- `/documentation-nag` if docs need updating
- `/test-builder` if new test coverage is needed
- `/style-nag` if UI components were added
- `/frontend-architecture-nag` if component structure changed

## Important Notes

- **This is interactive.** Do not skip the briefing and rush to implementation. The conversation in Phase 3 is where the user and agent align on approach.
- **Plans are not implementation specs.** A todo plan describes *what* and *why*. Your job is to figure out *how* and confirm it with the user.
- **Read code before proposing changes.** The plan may reference things that have changed since it was written. Always verify against current source.
- **One plan at a time.** Don't try to execute multiple plans in a single session.
