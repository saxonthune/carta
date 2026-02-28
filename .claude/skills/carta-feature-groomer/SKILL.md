---
name: carta-feature-groomer
description: Researches codebase context, discusses approach with the user, resolves design decisions, and refines todo-tasks/ plans into implementation-ready specs.
---

# carta-feature-groomer

Grooms a plan from `todo-tasks/` into implementation-ready work. Reads codebase context, discusses approach with the user, resolves design decisions, and refines the plan file so a headless Sonnet agent can execute it without ambiguity.

## Pipeline Position

```
/carta-builder          → ideate, test concepts in the Carta document
/carta-feature-groomer  → research, discuss, refine plans into concrete specs  ← YOU ARE HERE
/carta-feature-implementor  → status, launch, triage agents
/execute-plan           → background agent implements the groomed plan
```

This skill does NOT implement code or launch agents. Its output is a refined plan file.

## When This Triggers

- "Groom a plan"
- "Groom the flow trace plan"
- "Prep this for execution"
- "Work on the flow trace plan"
- `/carta-feature-groomer`
- `/carta-feature-groomer flow-trace-visualization`
- `/carta-feature-groomer all`

## Phase 1: Select a Plan

List plans in `todo-tasks/`, excluding epic overviews:

```typescript
Glob({ pattern: 'todo-tasks/*.md' })  // then filter out *.epic.md
```

**Epic files (`*.epic.md`) are NOT groomable plans.** Never present them as plan options, never try to execute them. They are context documents — read them for background when grooming tasks from the same epic.

**If specific plan named:** Match it against task filenames (fuzzy — `flow-trace` matches `flow-trace-visualization.md`). Read it fully. If it belongs to an epic (has `{epic}-` prefix), also read `{epic}.epic.md` for context.

**If epic named:** Match against the `{epic}-` prefix (e.g., "testability" matches all `testability-*.md` task files). Read the `{epic}.epic.md` overview first, then present the epic's pending tasks as a combined briefing. Work through them sequentially.

**If "first" specified:** Grab the first task plan alphabetically (skip `.epic.md`). No prompting — just start working on it.

**If "all" specified:** Read all task plan files. Present a combined briefing, then work through them sequentially. Appropriate when plans are small and self-contained.

**If no argument (default):** Read the first ~10 lines of each task plan file (enough to get the title and motivation), then present a summary to the user:

```typescript
// Read heads of all task plans (not .epic.md)
for (const file of taskFiles) {
  Read(file, { limit: 10 })
}

AskUserQuestion({
  questions: [{
    question: "Which plan should we groom?",
    header: "Plan",
    options: [
      // one per task plan, label = title, description = first-line summary from motivation section
    ],
    multiSelect: false
  }]
})
```

Read the selected plan file(s) fully before proceeding. For epic tasks, also read the `.epic.md` for additional context.

## Phase 2: Extract Context Requirements

After reading the plan, identify what codebase context is needed using a **two-phase search** strategy. The goal is to locate relevant files cheaply (Phase 2A) before reading them (Phase 2B). Never launch an Explore agent for context gathering — it burns tokens on speculative reads.

### Phase 2A: Cheap Triage (Grep + MANIFEST)

1. **Read `.carta/MANIFEST.md`** — use the tag index to map plan keywords to doc refs.
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

1. **`.carta/` refs** from MANIFEST — these give architectural context without reading source
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
- The plan involves a subsystem with no `.carta/` coverage and no obvious entry points
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

If the todo-task lacks a Verifiability section, write one with the user during the briefing. Ask: **"What would be true about this feature if implemented correctly, without referencing the implementation?"** See doc05.04.

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

Evaluate whether the plan can be executed by a single headless Sonnet session. The plan executor runs `claude -p` with a budget cap, so the plan must be completable within that.

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

The builder's todo-task includes a `## Verifiability` section with plain-language correctness properties. Your job is to **operationalize** each property into something the headless agent can execute. See doc05.04 for the full framework.

For each correctness property from the todo-task:

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
- **Property/round-trip tests** over example-based: `addSchema(s); getSchema(s.id)` returns equivalent to `s` — covers all schemas, not just the one in your example
- **Compiler as oracle**: if the feature affects document semantics, assert on compiler output diff rather than internal state
- **Adapter-level tests** over hook-level: test the operation logic directly against DocumentAdapter when possible, avoiding `renderHook`/`waitFor` ceremony
- **Postcondition scripts** for structural constraints: grep-based checks that the agent runs after implementation

**4. Flag untestable properties.** If a correctness property can't be operationalized into an automated check (e.g., "the UI feels responsive"), say so explicitly and mark it as a manual verification step. Don't pretend smoke tests cover it.

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

After refinement, tell the user the plan is ready and suggest next steps:

```
Plan **{slug}** is groomed and ready for execution.

To launch: `/carta-feature-implementor {slug}`
To launch with chain: `/carta-feature-implementor` and select chain launch
To review first: `Read('todo-tasks/{slug}.md')`
```

If the user wants to launch immediately, invoke `/carta-feature-implementor` to handle launch mechanics.

## Important Notes

- **This is interactive.** Do not skip the briefing and rush to refinement. The conversation in Phase 3 is where the user and agent align on approach.
- **Plans are not implementation specs — until you make them one.** A todo task describes *what* and *why*. Your job is to figure out *how*, confirm it with the user, and write it down precisely enough for a headless agent.
- **Read code before proposing changes.** The plan may reference things that have changed since it was written. Always verify against current source.
- **One plan at a time.** Don't try to groom multiple plans in a single session (unless "all" is specified and plans are small).
- **You do NOT write code.** You write plans. The plan executor writes code.
