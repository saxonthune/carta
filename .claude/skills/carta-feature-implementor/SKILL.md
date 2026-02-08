---
name: carta-feature-implementor
description: Grooms todo-tasks/ plans into implementation-ready specs, then hands off to /execute-plan for background execution.
---

# carta-feature-implementor

Grooms a plan from `todo-tasks/` into implementation-ready work. Reads codebase context, discusses approach with the user, resolves design decisions, refines the plan file, then hands off to `/execute-plan` for background implementation.

## Pipeline Position

```
/carta-builder          → ideate, test concepts in the Carta document
/carta-feature-implementor  → groom plans into concrete, implementable specs  ← YOU ARE HERE
/execute-plan           → background agent implements the groomed plan
```

This skill does NOT implement code. Its output is a refined plan file that a headless Sonnet agent can execute without ambiguity.

## When This Triggers

- "Groom a plan"
- "Prep this for execution"
- "Work on the flow trace plan"
- "Pick up a todo task"
- "Check on the page-description agent"
- `/carta-feature-implementor`
- `/carta-feature-implementor flow-trace-visualization`
- `/carta-feature-implementor status`

## Phase 0: Check Running Agents

Before anything else, check for running or completed background agents:

```bash
ls .claude/agent-results/*.log 2>/dev/null
ls .claude/agent-results/*.md 2>/dev/null
```

For each `.log` file found:
1. Check if the agent process is still running: `ps aux | grep "execute-plan.sh $(basename log .log)" | grep -v grep`
2. If a corresponding `.md` result file exists, the agent is **done** — read the result and report status (SUCCESS/FAILURE, merge status, commits)
3. If only a `.log` exists (no `.md`), the agent is **still running** — show the last 10 lines of the log

Present a brief status summary:

```
## Agent Status
- **page-description-ui**: SUCCESS — merged into trunk (3 commits)
- **debug-logging**: RUNNING — currently at "Step 4: Run Headless Claude"
```

**If invoked with `status` keyword:** Show status and stop. Don't proceed to plan selection.

**Otherwise:** Show status (if any agents exist), then continue to Phase 1.

## Phase 1: Select a Plan

List plans in `todo-tasks/`:

```typescript
Glob({ pattern: 'todo-tasks/*.md' })
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
    question: "Which plan should we groom?",
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

## Phase 4: Scope Check — Is This One Headless Session?

Evaluate whether the plan can be executed by a single headless Sonnet session. The plan executor runs `claude -p` with a $5 budget cap, so the plan must be completable within that.

### Right-Sized Work for One Session

A headless Sonnet session should target:

- **~5-8 file modifications** (edits, not reads)
- **One cohesive feature or fix** — not a grab bag of changes
- **Completable in a single focused pass** — no "part 1 of N"
- **Verifiable with `pnpm build && pnpm test`**
- **All design decisions already resolved** — no ambiguity for the agent

### When a Plan Is Too Large

If the plan requires:
- Touching 10+ files across multiple packages
- Introducing a new subsystem AND integrating it
- Multiple independent features bundled together
- Design decisions that need human judgment mid-implementation

**Split it.** Propose decomposing the plan into 2-3 smaller plans, each independently executable. Write each as a separate file in `todo-tasks/`. Two clean headless sessions beat one that runs out of budget.

## Phase 5: Refine the Plan File

This is the key output. Rewrite the plan file in `todo-tasks/` so it's **unambiguous enough for a headless agent**. The refined plan should include:

### Required Sections

1. **Motivation** — Why this change (1-2 sentences, for commit messages)
2. **Files to Modify** — Explicit list of files with what changes in each
3. **Implementation Steps** — Ordered, concrete steps. Reference specific functions, line ranges, existing patterns. Each step should be independently verifiable.
4. **Constraints** — Codebase rules the agent must follow (from CLAUDE.md, doc references)
5. **Verification** — What `pnpm build && pnpm test` should confirm, plus any manual checks

### What Makes a Good Headless Plan

- **No ambiguity.** Every design decision is resolved. The agent should never need to choose between approaches.
- **Concrete file references.** Not "update the hook" but "in `packages/web-client/src/hooks/useDocument.ts`, add a `pageDescription` field to the return value."
- **Pattern examples.** If the agent needs to follow a pattern, include a code snippet showing the pattern from existing code.
- **No exploration needed.** The agent shouldn't need to search the codebase to understand what to do. Everything it needs is in the plan or referenced by path.

### Refinement Process

```typescript
// Read the current plan
Read('todo-tasks/plan-name.md')

// Rewrite it with concrete implementation details
Edit({
  file_path: 'todo-tasks/plan-name.md',
  old_string: '...original content...',
  new_string: '...refined content with file paths, code patterns, step-by-step...'
})
```

## Phase 5b: Archive the Plan

After refining, move the plan to the archive:

```bash
ts=$(date +%Y%m%d)
mv todo-tasks/{plan-name}.md "todo-tasks/.archived/${ts}-{plan-name}.md"
```

Create `todo-tasks/.archived/` if it doesn't exist. The timestamp prefix keeps a chronological record.

## Phase 6: Hand Off

Once the plan is refined and archived, offer to launch execution:

```typescript
AskUserQuestion({
  questions: [{
    question: "Plan is groomed and ready. Launch background execution?",
    header: "Execute",
    options: [
      { label: "Launch now (Recommended)", description: "Run /execute-plan in background, merge on success" },
      { label: "Launch (no merge)", description: "Run /execute-plan --no-merge, leave branch for review" },
      { label: "Not yet", description: "I want to review the plan file first" }
    ],
    multiSelect: false
  }]
})
```

If the user says launch:

```bash
nohup bash .claude/skills/execute-plan/execute-plan.sh {plan-name} > .claude/agent-results/{plan-name}.log 2>&1 &
```

Report:
- Agent is running in background
- Check progress: `tail -f .claude/agent-results/{plan-name}.log`
- Check results when done: `.claude/agent-results/{plan-name}.md`

## Phase 7: Suggest Next Tasks

After launching (or if the user declines), read the remaining plans in `todo-tasks/` and suggest up to 3 as next tasks. Present them as a brief list the user can reference when they start a new conversation:

```
## Next tasks to pick up

1. **directional-auto-layout** — Hierarchical layout by edge flow direction
2. **debug-logging** — Replace console.log with `debug` package
3. **mcp-flow-layout-tool** — MCP tool for topological node arrangement

Start a new conversation and run `/carta-feature-implementor directional-auto-layout` to groom the next one.
```

Read the first ~5 lines of each remaining plan to extract title and one-line summary. Only show plans that haven't been archived. If no plans remain, say so.

## Important Notes

- **This is interactive.** Do not skip the briefing and rush to refinement. The conversation in Phase 3 is where the user and agent align on approach.
- **Plans are not implementation specs — until you make them one.** A todo task describes *what* and *why*. Your job is to figure out *how*, confirm it with the user, and write it down precisely enough for a headless agent.
- **Read code before proposing changes.** The plan may reference things that have changed since it was written. Always verify against current source.
- **One plan at a time.** Don't try to groom multiple plans in a single session.
- **You do NOT write code.** You write plans. The plan executor writes code.
