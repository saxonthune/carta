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

## Phase 0: Check Running & Completed Agents

Plan lifecycle state is tracked by directory location:
- `todo-tasks/` — pending (needs grooming or execution)
- `todo-tasks/.running/` — agent executing
- `todo-tasks/.done/` — agent finished
- `todo-tasks/.archived/` — reviewed and closed

### Phase 0A: Debrief

Run the status script to get a summary of all agents and plans:

```bash
bash .claude/skills/carta-feature-implementor/status.sh
```

Review the output. For any completed agents where you need more detail (e.g., retried agents, failures), use `Read` to inspect the result file directly:

```typescript
Read('todo-tasks/.done/{slug}.result.md', { limit: 10 })
Grep({ pattern: '## Notes', path: 'todo-tasks/.done/{slug}.result.md', output_mode: 'content', -A: 20 })
```

Present status to the user as a **table** with a Notes column:

```markdown
## Agent Status

| Agent | Status | Merge | Notes |
|-------|--------|-------|-------|
| **page-description-ui** | SUCCESS | merged | Clean run, no concerns. 3 commits. |
| **component-smoke-tests** | SUCCESS | merged | Retried once (build failure). 3 commits. |
| **debug-logging** | RUNNING | — | Step 4: Run Headless Claude |
```

### Phase 0B: Archive

After the debrief has been presented to the user, offer to archive completed plans. **Never silently archive without showing the notes.**

```bash
bash .claude/skills/carta-feature-implementor/status.sh --archive
```

If a worktree still exists for a completed agent (merge conflict cases), mention it so the user can resolve manually.

**If invoked with `status` keyword:** Show status with debrief, archive completed plans, and stop. Don't proceed to plan selection.

**Otherwise:** Show status with debrief and archive completed plans (if any agents exist), then continue to Phase 1.

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

After reading the plan, identify what codebase context is needed using a **two-phase search** strategy. The goal is to locate relevant files cheaply (Phase 2A) before reading them (Phase 2B). Never launch an Explore agent for context gathering — it burns tokens on speculative reads.

### Phase 2A: Cheap Triage (Grep + MANIFEST)

1. **Read `.docs/MANIFEST.md`** — use the tag index to map plan keywords to doc refs.
2. **Run 3-5 parallel Grep calls** directly from the main context for the plan's key terms. Use `output_mode: "files_with_matches"` to identify relevant files without reading content:

```typescript
// Example: plan mentions "edge routing" and "waypoints"
Grep({ pattern: 'routeEdges|waypoints', output_mode: 'files_with_matches' })
Grep({ pattern: 'patchEdgeData', output_mode: 'files_with_matches' })
Grep({ pattern: 'PortDrawer', output_mode: 'files_with_matches' })
```

This identifies the ~5 relevant files in seconds for near-zero tokens.

3. **Map plan concepts to docs via MANIFEST tags:**

```
Plan mentions "presentation model" → tags: presentation, rendering → doc02.09, doc02.08
Plan mentions "edge pipeline"      → tags: pipeline, edges, sync   → doc02.10
Plan mentions "canvas interactions" → tags: canvas, hooks           → doc03.01.01.01, doc02.02
Plan mentions "waypoints"          → tags: waypoints               → doc02.10
```

### Phase 2B: Targeted Reads

Read only the files identified in Phase 2A. Prioritize:

1. **`.docs/` refs** from MANIFEST — these give architectural context without reading source
2. **Source files** from Grep hits — read the specific line ranges that matched, not entire files
3. **Adjacent code** — if the plan modifies a function, read its callers (one level up) to understand impact

**Do NOT:**
- Launch an Explore agent or Task subagent for context gathering
- Read entire directories speculatively
- Read files not surfaced by Grep or referenced by the plan
- Read the same file at multiple offsets — read it once with enough range

### When to Escalate to an Explore Agent

Only use `Task(subagent_type='Explore')` if:
- Phase 2A Grep returns 0 hits for all search terms (genuinely unknown territory)
- The plan involves a subsystem with no `.docs/` coverage and no obvious entry points
- You've done Phase 2A and still can't identify which files to modify

Even then, give the Explore agent a **surgical prompt** with specific questions and file paths to start from — not an open-ended "investigate thoroughly."

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
2. **Design constraint** — One sentence stating the core design decision. Example: "All description UI lives in the trigger bar, NOT in the dropdown." This anchors the agent before it reads implementation details.
3. **Do NOT** — Explicit list of things the agent must NOT do. This prevents scope creep and "path of least resistance" implementations. Include anything from the "Out of Scope" discussion, plus any structurally easy but wrong approaches the agent might be tempted by. Place this near the top — headless agents may not read the full document with equal attention.
4. **Files to Modify** — Explicit list of files with what changes in each
5. **Implementation Steps** — Ordered, concrete steps. Reference specific functions, line ranges, existing patterns. Each step should be independently verifiable.
6. **Constraints** — Codebase rules the agent must follow (from CLAUDE.md, doc references)
7. **Verification** — What `pnpm build && pnpm test` should confirm, plus any manual checks
8. **Plan-specific checks** (optional) — Grep-based or script-based assertions the agent runs after implementation to verify negative constraints. Example: `! grep -q 'isEditingDescription' packages/web-client/src/components/PageSwitcher.tsx` to confirm removed code stays removed. These are crude but effective guardrails that complement the build/test gate.

### What Makes a Good Headless Plan

- **No ambiguity.** Every design decision is resolved. The agent should never need to choose between approaches.
- **Concrete file references.** Not "update the hook" but "in `packages/web-client/src/hooks/useDocument.ts`, add a `pageDescription` field to the return value."
- **Pattern examples.** If the agent needs to follow a pattern, include a code snippet showing the pattern from existing code.
- **No exploration needed.** The agent shouldn't need to search the codebase to understand what to do. Everything it needs is in the plan or referenced by path.
- **Negative constraints up front.** If the plan has "Out of Scope" items that describe something structurally easy to do (e.g., adding UI to an existing component), call it out explicitly in the "Do NOT" section. The agent will gravitate toward the path of least resistance — block that path if it's wrong.

### Anticipating Agent Drift

When refining, ask: "What's the easiest wrong implementation?" If the plan asks the agent to modify component A but the same data is accessible in component B, the agent may add UI to B instead. Explicitly forbid the wrong-but-easy path. Err on the side of over-specifying negative constraints — a "Do NOT" that was unnecessary costs nothing, but a missing one can derail the whole session.

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

## Phase 6: Hand Off

Once the plan is refined, offer to launch execution. **Do not archive the plan** — the execute-plan agent reads it from `todo-tasks/`. It will be archived in Phase 0 of the next session after the agent completes.

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
mkdir -p todo-tasks/.running
nohup bash .claude/skills/execute-plan/execute-plan.sh {plan-name} > todo-tasks/.running/{plan-name}.log 2>&1 &
```

Report:
- Agent is running in background
- Check progress: `tail -f todo-tasks/.running/{plan-name}.log`
- Check results when done: `todo-tasks/.done/{plan-name}.result.md`

## Phase 7: Suggest Next Tasks

After launching (or if the user declines), suggest safe next tasks. **Do not suggest plans that would conflict with running agents.**

### Check for conflicts

1. List running agents:
   ```bash
   ls todo-tasks/.running/*.md 2>/dev/null
   ```
2. Each `.md` in `.running/` is an active agent. Note the plan slug.
3. Read the plan files for running agents to understand which files they modify.

### Identify safe plans

Read the first ~10 lines of each remaining plan in `todo-tasks/` to extract title, summary, and files touched. A plan is **unsafe to suggest** if:
- It modifies the same files as a running agent's plan
- It's already running as an agent (has a file in `todo-tasks/.running/`)

### Present suggestions

Show up to 3 safe plans. Flag any skipped plans with the reason:

```
## Next tasks to pick up

1. **debug-logging** — Replace console.log with `debug` package
2. **mcp-flow-layout-tool** — MCP tool for topological node arrangement

⏳ **page-description-ui** — skipped (agent running)
⏳ **directional-auto-layout** — skipped (agent running, overlaps Map.tsx)

Start a new conversation and run `/carta-feature-implementor debug-logging` to groom the next one.
```

Only show plans that haven't been archived. If no safe plans remain, say so.

## Important Notes

- **This is interactive.** Do not skip the briefing and rush to refinement. The conversation in Phase 3 is where the user and agent align on approach.
- **Plans are not implementation specs — until you make them one.** A todo task describes *what* and *why*. Your job is to figure out *how*, confirm it with the user, and write it down precisely enough for a headless agent.
- **Read code before proposing changes.** The plan may reference things that have changed since it was written. Always verify against current source.
- **One plan at a time.** Don't try to groom multiple plans in a single session.
- **You do NOT write code.** You write plans. The plan executor writes code.
