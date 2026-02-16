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
- `todo-tasks/.running/` — agent executing (`.md` files) or chain active (`.manifest` files)
- `todo-tasks/.done/` — agent finished
- `todo-tasks/.archived/` — reviewed and closed

**Chain manifests**: `todo-tasks/.running/chain-*.manifest` files claim a sequence of plans. Plans listed in a manifest are "spoken for" — don't groom, launch, or suggest them. The status script marks these with ⛓️.

### Phase 0A: Debrief

Run the status script — it provides ALL information needed in one call (completed agents table, chain status with log tails, running agents with log tails, stale worktrees, pending plans, and a summary line):

```bash
bash .claude/skills/carta-feature-implementor/status.sh
```

Present the output directly to the user. The script already formats tables and includes notes. No follow-up `ls`, `Read`, or `Grep` commands are needed for the debrief — the script covers it all.

### Phase 0B: Archive & Triage Failures

After the debrief, handle completed agents based on status:

**Successful agents:** Archive automatically.

```bash
bash .claude/skills/carta-feature-implementor/status.sh --archive-success
```

**Failed agents:** Do NOT archive. Instead, ask the user what to do:

```typescript
AskUserQuestion({
  questions: [{
    question: "Agent '{slug}' failed. How should we proceed?",
    header: "Failed agent",
    options: [
      { label: "Fix it now (Recommended)", description: "Investigate the failure and fix the code in the existing worktree" },
      { label: "Re-groom and retry", description: "Refine the plan to avoid the failure, then re-launch" },
      { label: "Archive and skip", description: "Move to archived, don't retry" }
    ],
    multiSelect: false
  }]
})
```

If "Fix it now": Switch to the agent's worktree, read the result file for error details, diagnose the failure, apply fixes, run `pnpm build && pnpm test`, commit, and merge. This is interactive — the skill acts as a debugging partner, not a headless agent.

If a worktree still exists for a completed agent (merge conflict cases), mention it so the user can resolve manually.

**Chain debrief**: If `status.sh` reports chains, show chain progress. For failed chains, read the manifest (`grep '^failed_phase:' todo-tasks/.running/chain-*.manifest`) and the failed phase's result file. Offer: fix in worktree, re-groom the failed phase, or archive and skip. For completed chains, archive the manifest: `mv todo-tasks/.running/chain-*.manifest todo-tasks/.archived/`.

**If invoked with `status` keyword:** Show status with debrief, archive successful agents, triage failures, and stop. Don't proceed to plan selection.

**Otherwise:** Show status with debrief, archive successful agents, triage failures, then continue to Phase 1.

## Phase 1: Select a Plan

List plans in `todo-tasks/`:

```typescript
Glob({ pattern: 'todo-tasks/*.md' })
```

**If specific plan named:** Match it against filenames (fuzzy — `flow-trace` matches `flow-trace-visualization.md`). Read it fully.

**If epic named:** Match against the `{epic}-` prefix (e.g., "testability" matches all `testability-*.md` files). Present the full epic as a combined briefing, work through them sequentially.

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

### 3. Verifiability Assessment
Review the todo-task's `## Verifiability` section (if present). For each correctness property, assess:
- Can this be tested at the adapter level (integration) or does it require E2E?
- What oracle type applies? (partial, semantic/compiler, metamorphic, or manual-only)
- Are there properties missing? If the builder only wrote smoke-level properties ("it renders"), surface this gap now.

If the todo-task lacks a Verifiability section, write one with the user during the briefing. Ask: **"What would be true about this feature if implemented correctly, without referencing the implementation?"** See doc01.05.02.

### 4. Considerations
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
7. **Verification** — Correctness properties, postconditions, and test instructions (see below)

### Verification Section

The todo-task should include correctness properties (from the builder's `## Verifiability` section). Your job is to **operationalize** each into executable verification. See doc01.05.02 for the full framework.

For each correctness property:

**1. Classify where truth lives:**
- **Data model** (adapter in, adapter out) → integration test or script assertion
- **Compiler output** (semantic oracle) → integration test comparing compiler output before/after
- **Rendered composition** (requires browser) → E2E test or manual check

**2. Write a concrete verification instruction the agent can follow:**

| Property | Verification instruction |
|----------|------------------------|
| "Applying a package adds all its schemas" | Write integration test: call `applyPackage(doc, pkg)`, assert `adapter.getSchemas()` contains each schema from `pkg.schemas` |
| "Compilation includes new construct type" | Write integration test: create construct of new type, compile, assert output contains type name |
| "Port handles render at correct positions" | Add to E2E `port-connections.spec.ts`: create node with custom ports, assert handle count matches port count |
| "Deleted code stays deleted" | Plan-specific check: `! grep -q 'oldFunctionName' path/to/file.ts` |

**3. Prefer higher-value test patterns:**
- **Property/round-trip tests** over example-based: `addSchema(s); getSchema(s.id)` returns equivalent to `s`
- **Compiler as oracle**: if the feature affects document semantics, assert on compiler output diff
- **Adapter-level tests** over hook-level: test operation logic against DocumentAdapter directly when possible
- **Postcondition scripts** for structural constraints: grep-based checks run after implementation

**4. Flag untestable properties.** If a correctness property can't be automated (e.g., "the UI feels responsive"), mark it as manual verification. Don't pretend smoke tests cover it.

The Verification section in the refined plan should contain:
- `pnpm build && pnpm test` as the baseline gate
- Specific new tests the agent must write, with file paths and assertion descriptions
- Plan-specific postcondition scripts (grep/script checks)
- Manual verification steps (if any) clearly marked as such

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

### Chain Launch

When multiple pre-groomed plans form a sequential dependency chain (e.g., an epic), offer chain execution instead of single-plan launch. The `{epic}-` prefix in filenames makes this natural — all tasks in an epic sort together and can be launched as a chain:

```bash
nohup bash .claude/skills/execute-plan/execute-chain.sh {epic} {epic}-01-{slug} {epic}-02-{slug} ... > todo-tasks/.running/chain-{epic}.log 2>&1 &
```

The chain script runs plans sequentially, stopping on first failure. It creates a `.manifest` file that claims all phases (preventing parallel agents from touching them). If a plan is already running (launched before the chain), the chain waits for it.

Example:
```bash
nohup bash .claude/skills/execute-plan/execute-chain.sh testability \
  testability-01-compiler-tests testability-02-adapter-round-trips \
  testability-03-extract-connections testability-04-extract-organizer-ops \
  testability-05-compiler-oracle \
  > todo-tasks/.running/chain-testability.log 2>&1 &
```

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
- It's claimed by an active chain (listed in a `.running/chain-*.manifest`)

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
