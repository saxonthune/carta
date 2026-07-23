# todo-task: triage mode

Refine a pending task from a rough idea into an executable spec that a headless agent can implement without asking questions. **This is interactive** — present findings, ask questions, get alignment before writing the spec.

**Input**: `$ARGUMENTS[1]` is the task slug. If empty, list pending tasks and ask.

## Step 1: List or select

If no slug provided, list untriaged drafts (the inbox):
```bash
bash .claude/skills/todo-task/list-drafts.sh
```

Present tasks to the user with `AskUserQuestion`:

```typescript
AskUserQuestion({
  questions: [{
    question: "Which task should we triage?",
    header: "Task",
    options: [
      // one per task, label = title, description = first line of motivation
    ],
    multiSelect: false
  }]
})
```

## Step 2: Read the task

Read the draft at `.todo-tasks/inbox/{slug}.md` (or `.todo-tasks/tasks/{slug}.md` if you're re-triaging an already-promoted spec). Understand the motivation and scope. If the slug appears in any `.todo-tasks/epics/{epic}.md` `members:` list, also read that epic file for context.

## Step 3: Research the codebase

Investigate the codebase to understand what changes are needed:

1. **Check `.carta/MANIFEST.md`** — use the tag index to map task keywords to relevant docs.
2. **Find relevant files** — Use Grep/Glob to locate code related to the task. Start broad (keyword search), then narrow to specific files.
3. **Read key files** — Read the files you'll need to modify. Understand their structure, patterns, and conventions.
4. **Understand test patterns** — Find existing tests near the code you'll change. Note the test framework, assertion style, and what's already covered.
5. **Check for gotchas** — Look for related code that might break, shared state, or implicit dependencies.

**Chain/epic phases:** When triaging a spec that is part of a chain or epic and whose predecessor phases have not merged yet, do not research live code for the predecessor's output. Read the predecessor spec's `## Surface after this phase` block and triage against that declared Surface. The Surface stands in for code that does not exist yet. If a symbol or behavior is not in the Surface, treat it as not existing.

## Step 4: Briefing

Present your findings to the user before writing anything. This is where alignment happens.

### 1. Plan Summary
One paragraph restating the task's motivation and scope in your own words. Flag anything ambiguous.

### 2. Codebase Landscape
What exists today that's relevant:
- Files/modules that will be modified or extended
- Existing patterns the implementation should follow
- Adjacent code that might be affected

### 3. Considerations
Open questions, tradeoffs, and design decisions the task surfaces. Present each as a concrete question with your recommendation. Use `AskUserQuestion` for decisions that affect the approach:

```typescript
AskUserQuestion({
  questions: [{
    question: "Should concept files co-locate tests or use separate test files?",
    header: "Test layout",
    options: [
      { label: "Co-located (Recommended)", description: "Tests at the bottom of each concept file — reads like a spec" },
      { label: "Separate files", description: "One .test.ts per concept — conventional but splits the narrative" }
    ],
    multiSelect: false
  }]
})
```

Group up to 4 decisions into a single `AskUserQuestion` call when possible.

## Step 5: Scope check — is this one headless session?

Evaluate whether the plan can be executed by a single headless agent session. A good session targets:

- **~5-8 file modifications** (edits, not reads)
- **One cohesive feature or fix**
- **Completable in a single focused pass**
- **All design decisions already resolved**

If the task is too large (10+ files, multiple independent features, needs mid-implementation judgment), propose splitting into 2-3 smaller tasks. Write each as a separate file in `.todo-tasks/` and tell the user.

## Step 6: Rewrite as executable spec

After the user has answered all questions and confirmed the approach, **promote the draft**: write the executable spec to `.todo-tasks/tasks/{slug}.md` and delete the `.todo-tasks/inbox/{slug}.md` draft. Do NOT commit — the spec stays uncommitted (it doesn't block launching, and the orchestrator commits it automatically when you execute). Use this structure:

````markdown
# {Title}

## Motivation

{Original motivation, refined with what you learned from research.}

## Do NOT

- {Explicit negative constraints — things the agent must avoid}
- {Scope boundaries — what NOT to touch}
- {Wrong-but-easy approaches the agent might be tempted by}

## Plan

### 1. {First logical step}

{Concrete instructions. Name specific files, functions, line ranges. Describe what to change and why.}

### 2. {Second logical step}

{Continue with specifics...}

## Files to Modify

- `path/to/file.ts` — {what changes}
- `path/to/test.ts` — {what test to add/modify}

## Verification

```bash
{commands to verify the implementation}
```

## Out of Scope

- {Anything deferred to a future task}

## Notes

- {Caveats, risks, things a reviewer should watch for}

## Surface after this phase

> Required for chain/epic phases. Omit for standalone one-off tasks.

- {Symbols this phase promises to leave behind — exported functions, types,
  files — stated precisely enough that a later phase can triage against them.}
- {Behaviors / integration points the phase guarantees.}
- {Negative space: what is deliberately unchanged and can still be relied on —
  e.g. "Legacy X still exists and still works until Phase N".}
````

The `## Surface after this phase` block is the contract that downstream phases triage against. Write it precisely: if a symbol is not listed, later phases will treat it as nonexistent.

> The `## Verification` section MUST contain at least one fenced bash/sh code block. execute-plan.sh parses commands from that block to run as the verification gate.

> **Verification must be non-destructive.** The block runs inside the agent's
> worktree and whatever it commits merges to trunk. Never invoke `archive.sh`
> (sweep), `git rm`, worktree removal, or anything that mutates trunk or other
> tasks. Treat `.todo-tasks/` as orchestrator-owned and off-limits to a task's own
> verification. Test exit codes with a scoped, side-effect-free invocation.

## Step 7: Confirm and hand off

Tell the user the task has been triaged with a brief summary of the plan, then offer to launch:

```typescript
AskUserQuestion({
  questions: [{
    question: "Plan is triaged and ready. Launch background execution?",
    header: "Execute",
    options: [
      { label: "Launch now (Recommended)", description: "Run execute-plan in background, merge on success" },
      { label: "Launch (no merge)", description: "Run execute-plan, leave branch for manual review" },
      { label: "Not yet", description: "I want to review the plan file first" }
    ],
    multiSelect: false
  }]
})
```

If the user says launch, switch to execute mode for that slug.

## Triaging Guidelines

- **This is interactive.** Do not skip the briefing and rush to writing the spec. The conversation in Step 4 is where you and the user align on approach.
- **Name every file.** The agent shouldn't have to search for where to make changes.
- **Be specific about what, not how.** "Add a `getUserById` function to `users.ts` that queries by primary key" — not pseudocode.
- **Write negative constraints early.** "Do NOT" goes near the top of the spec — headless agents may not read the full document with equal attention. Ask yourself: "What's the easiest wrong implementation?" and block that path.
- **Include verification.** The agent needs to know when it's done.
- **Keep it atomic.** If triaging reveals the task is too large, split it into multiple tasks and tell the user.
- **Chain triage rule — Surface, not the code.** For chain/epic phases whose predecessors have not merged, triage against the predecessor's `## Surface after this phase` block, not live code. The Surface stands in for code that does not exist yet.
- **Chain triage rule — not in Surface = doesn't exist.** If a symbol, file, or behavior is absent from the Surface, treat it as nonexistent. Do not assume it will be present.
- **Chain triage rule — negative space is a contract.** Lines like "Legacy X still exists and still works until Phase N" are promises later phases can rely on.
