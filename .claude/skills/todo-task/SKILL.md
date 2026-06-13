---
name: todo-task
description: "Task lifecycle manager: create ideas, triage into specs, execute via headless agents, check status, monitor agents. Usage: /todo-task [create|triage|execute|status|monitor] [args]"
---

# todo-task

Unified task lifecycle manager. When the user's intent is clear (e.g. "make a todotask to..."), go straight to the appropriate mode — do not run status first.

Route based on `$ARGUMENTS[0]`:

| Command | Purpose |
|---------|---------|
| `/todo-task` | Show status (same as `status`) |
| `/todo-task create {description}` | File a new task |
| `/todo-task triage {slug}` | Refine a pending task into an executable spec |
| `/todo-task execute {slug}` | Launch headless agent to implement a plan |
| `/todo-task status` | Full lifecycle report |
| `/todo-task monitor` | Live dashboard (watch loop) |

First-time setup: if todo-task scripts prompt for approval, read `.claude/skills/todo-task/SETUP.md` for a suggested allowlist (kept separate to avoid context pollution).

---

## Mode: `status` (default when no arguments)

**IMPORTANT: ALWAYS run the status script FIRST. Do NOT read files, investigate errors, check git state, or do any other research before running this script. Show the script output to the user, then follow the triage flow below. Only investigate issues after the full triage flow is complete and the user asks you to.**

Run the status script and display results:

```bash
bash .claude/skills/todo-task/status.sh
```

If `$ARGUMENTS` includes `--archive`, pass `--archive` through (status delegates to `archive.sh`).

### Triage completed agents

After showing status, handle completed agents:

**Successful agents & completed chains:** Archive automatically. `archive.sh` (no args) `git rm`s every auto-eligible outcome (clean successes, completed chains) and removes their worktrees/branches:
```bash
bash .claude/skills/todo-task/archive.sh
```

**Conflict agents (`merge_conflict` / `merged_with_markers`):** NOT auto-archived — the worktree is kept for resolution. Check if the branch was already merged manually. If `git log` shows the agent's commits on the current branch, the conflict was already resolved — then `archive.sh {slug}` cleans up. If not, treat as a failed merge and ask the user.

**Ready-for-review agents (`--no-merge`):** NOT archived — they await a human merge of the agent branch.

**Failed agents (`build_failure`/`session_failed`/`no_op`/`trunk_leak`, crashed, failed chains):** Do NOT archive by default. `archive.sh --force-failed` archives them explicitly once reviewed. First, ask the user what to do:

```typescript
AskUserQuestion({
  questions: [{
    question: "Agent '{slug}' failed. How should we proceed?",
    header: "Failed agent",
    options: [
      { label: "Fix it now (Recommended)", description: "Investigate the failure and fix the code in the existing worktree" },
      { label: "Re-triage and retry", description: "Refine the plan to avoid the failure, then re-launch" },
      { label: "Archive and skip", description: "Move to archived, don't retry" }
    ],
    multiSelect: false
  }]
})
```

---

## Mode: `create`

Quickly file a task so the current session can continue its primary work.

**Input**: everything after `create` is the task description. If empty, ask the user what to file.

### Step 1: Generate a slug

Format: `{slug}.md` — kebab-case, descriptive.

Examples: `fix-login-timeout.md`, `add-user-search.md`, `stale-cache-after-deploy.md`

### Step 2: Write the draft

Write to `.todo-tasks/inbox/{slug}.md`. The inbox is **gitignored** — a filed idea is not yet work, so it never touches git. Do NOT commit. (Triage later promotes it to a tracked `tasks/{slug}.md`.)

```markdown
# {Title}

## Motivation

{Why this task exists. 2-3 sentences. Include how it was discovered if relevant.}

## Description

{What needs to happen. Be concrete about the problem/feature. Reference specific files, functions, or behaviors if known.}

## Scope

- {Bullet list of what's in scope}
- {Be specific enough that a triage step can act on it}

## Out of Scope

- {Anything explicitly NOT part of this task}

## Notes

- {Optional. Context that would help the triage step: related files, prior attempts, links to related tasks.}
```

### Step 3: Confirm

Tell the user the file was created and they can triage it with `/todo-task triage {slug}`.

### Guidelines

- **Be concrete.** "Login times out after 30s on slow connections" > "login issues"
- **Include reproduction context.** What you were doing, what file, what symptoms.
- **Reference files.** If you know which files are involved, list them.
- **One task per file.** Three bugs = three tasks.
- **Don't over-specify the solution.** Describe the problem and desired outcome.
- **Check for duplicates.** Scan `.todo-tasks/inbox/` and `.todo-tasks/tasks/` first.

### Epic Tasks

Epic membership is an **explicit slug list**, not a filename prefix. If the task belongs to an existing epic (`.todo-tasks/epics/{epic}.md`), write the task as a normal `tasks/{slug}.md`, then add its slug to that epic's `members:` line (comma-separated). The slug is the stable id — references never break.

---

## Mode: `triage`

Refine a pending task from a rough idea into an executable spec that a headless agent can implement without asking questions. **This is interactive** — present findings, ask questions, get alignment before writing the spec.

**Input**: `$ARGUMENTS[1]` is the task slug. If empty, list pending tasks and ask.

### Step 1: List or select

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

### Step 2: Read the task

Read the draft at `.todo-tasks/inbox/{slug}.md` (or `.todo-tasks/tasks/{slug}.md` if you're re-triaging an already-promoted spec). Understand the motivation and scope. If the slug appears in any `.todo-tasks/epics/{epic}.md` `members:` list, also read that epic file for context.

### Step 3: Research the codebase

Investigate the codebase to understand what changes are needed:

1. **Check `.carta/MANIFEST.md`** — use the tag index to map task keywords to relevant docs.
2. **Find relevant files** — Use Grep/Glob to locate code related to the task. Start broad (keyword search), then narrow to specific files.
3. **Read key files** — Read the files you'll need to modify. Understand their structure, patterns, and conventions.
4. **Understand test patterns** — Find existing tests near the code you'll change. Note the test framework, assertion style, and what's already covered.
5. **Check for gotchas** — Look for related code that might break, shared state, or implicit dependencies.

**Chain/epic phases:** When triaging a spec that is part of a chain or epic and whose predecessor phases have not merged yet, do not research live code for the predecessor's output. Read the predecessor spec's `## Surface after this phase` block and triage against that declared Surface. The Surface stands in for code that does not exist yet. If a symbol or behavior is not in the Surface, treat it as not existing.

### Step 4: Briefing

Present your findings to the user before writing anything. This is where alignment happens.

#### 1. Plan Summary
One paragraph restating the task's motivation and scope in your own words. Flag anything ambiguous.

#### 2. Codebase Landscape
What exists today that's relevant:
- Files/modules that will be modified or extended
- Existing patterns the implementation should follow
- Adjacent code that might be affected

#### 3. Considerations
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

### Step 5: Scope check — is this one headless session?

Evaluate whether the plan can be executed by a single headless agent session. A good session targets:

- **~5-8 file modifications** (edits, not reads)
- **One cohesive feature or fix**
- **Completable in a single focused pass**
- **All design decisions already resolved**

If the task is too large (10+ files, multiple independent features, needs mid-implementation judgment), propose splitting into 2-3 smaller tasks. Write each as a separate file in `.todo-tasks/` and tell the user.

### Step 6: Rewrite as executable spec

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

### Step 7: Confirm and hand off

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

### Triaging Guidelines

- **This is interactive.** Do not skip the briefing and rush to writing the spec. The conversation in Step 4 is where you and the user align on approach.
- **Name every file.** The agent shouldn't have to search for where to make changes.
- **Be specific about what, not how.** "Add a `getUserById` function to `users.ts` that queries by primary key" — not pseudocode.
- **Write negative constraints early.** "Do NOT" goes near the top of the spec — headless agents may not read the full document with equal attention. Ask yourself: "What's the easiest wrong implementation?" and block that path.
- **Include verification.** The agent needs to know when it's done.
- **Keep it atomic.** If triaging reveals the task is too large, split it into multiple tasks and tell the user.
- **Chain triage rule — Surface, not the code.** For chain/epic phases whose predecessors have not merged, triage against the predecessor's `## Surface after this phase` block, not live code. The Surface stands in for code that does not exist yet.
- **Chain triage rule — not in Surface = doesn't exist.** If a symbol, file, or behavior is absent from the Surface, treat it as nonexistent. Do not assume it will be present.
- **Chain triage rule — negative space is a contract.** Lines like "Legacy X still exists and still works until Phase N" are promises later phases can rely on.

---

## Mode: `execute`

Launch a headless agent to implement a triaged plan.

**Input**: `$ARGUMENTS[1]` is the task slug. If empty, list pending tasks and ask. Supports `--no-merge` and `--chain`.

### Single plan execution

1. **Select** — If no slug, list available plans:
   ```bash
   bash .claude/skills/todo-task/list-pending.sh
   ```
   Ask the user which plan to execute.

2. **Confirm** — Show the plan summary and ask user to confirm.

3. **Launch** — Run `launch.sh`. It validates preconditions synchronously (plan exists, clean tree, correct branch) and only backgrounds the real run if validation passes. Do NOT manually run `execute-plan.sh --validate-only` or hand-roll `nohup` — `launch.sh` handles both.

   ```bash
   bash .claude/skills/todo-task/launch.sh {slug}
   ```

   If the command exits non-zero, validation failed — show the error to the user and tell them what to fix. Do NOT retry.

4. **Report** — Tell the user:
   - Agent is running in the background
   - Check progress: `tail -f .todo-tasks/.running/{slug}.log`
   - Check results: `.todo-tasks/results/{slug}.agent.md` (+ `.merge.md` after merge)
   - Check status: `/todo-task status`

### Options

- `--no-merge` — leave branch for manual review instead of auto-merging:
  ```bash
  bash .claude/skills/todo-task/launch.sh {slug} --no-merge
  ```

### Chain execution

If `--chain` is passed with multiple slugs, call `launch-chain.sh`:
```bash
bash .claude/skills/todo-task/launch-chain.sh {chain-name} {slug1} {slug2} ...
```

To queue a chain to start after a running or pending standalone task completes and merges, pass `--after <predecessor-slug>`:
```bash
bash .claude/skills/todo-task/launch-chain.sh {chain-name} {slug1} {slug2} ... --after {predecessor-slug}
```

The predecessor must be a standalone task (not part of the chain). It merges to trunk independently; the chain waits for it to complete and merge successfully before cutting its worktree from the now-updated trunk. If the predecessor fails or does not produce a result, the chain aborts. The predecessor slug must exist in pending, running, or done at launch time.

---

## Mode: `monitor`

Launch a live dashboard that refreshes every 5 seconds, showing running agents, recent completions, and epic progress.

Tell the user to run this in a separate terminal:

```bash
watch -n5 bash .claude/skills/todo-task/monitor.sh
```

Or run it once for a snapshot:

```bash
bash .claude/skills/todo-task/monitor.sh
```

---

## Task Lifecycle (derive, don't store)

There is no directory-as-state-machine. Lifecycle is **derived from which files exist**,
not from moving files between directories. The directories below are stable *categories*,
never lifecycle states.

```
.todo-tasks/
  inbox/{slug}.md            IGNORED   untriaged draft — written by create, local-only
  tasks/{slug}.md            TRACKED   spec — promoted by triage; committed by the orchestrator at launch
  results/{slug}.agent.md    TRACKED   worktree-owned outcome — carried to trunk by the merge
  results/{slug}.merge.md    TRACKED   trunk-owned outcome — written on trunk after the merge
  chains/{chain}.md          TRACKED   chain definition — written on trunk at completion
  epics/{epic}.md            TRACKED   epic definition with `members: a,b,c`
  task-config.sh             TRACKED   build/test commands
  .running/{slug}.run        IGNORED   run-record — liveness (pid) + worktree location
  .archived/                 IGNORED   physical copies after `git rm`
  *.log .version             IGNORED
```

Phase is computed by the reporter from file presence:

| Files present | Phase |
|---|---|
| draft in `inbox/` only | draft (untriaged) |
| spec in `tasks/` | pending |
| run-record + live PID | running |
| run-record + dead PID + no `merge.md` | crashed (result read from the worktree) |
| `agent.md` + `merge.md` | done (classified success/failure) |

The spec being uncommitted does not block launching — the dirty-tree guard ignores
`.todo-tasks/`, and `execute-plan.sh` commits the spec to trunk before cutting the worktree
(so the squash-merge never collides with an untracked spec). You never hand-commit task files.

`report.sh` is the **only** component that walks the filesystem and classifies state.
`status.sh`, `monitor.sh`, and `list-pending.sh` are pure renderers over its TSV output.
`archive.sh` is the **only** component that moves files (via `git rm`).

## Manual Merge Conflict Resolution

When you manually resolve a merge conflict from an agent (auto-merge failed, so no
`merge.md` was written and the worktree was kept), clean up afterwards:

1. **Remove the worktree** (path shown in `status.sh` and in `.todo-tasks/.running/{slug}.run`):
   ```bash
   git worktree remove <worktree-path>
   ```

2. **Delete the agent branch** (it's already merged):
   ```bash
   git branch -d {trunk}_claude_{slug}
   ```

3. **Archive the task:**
   ```bash
   bash .claude/skills/todo-task/archive.sh {slug}
   ```

If you skip these steps, future sessions will see stale worktrees in status output.

## Rules

- `create` only writes `inbox/{slug}.md` (gitignored draft). Never commit it.
- `triage` promotes the draft → `tasks/{slug}.md` and deletes the inbox draft (and may add a slug to an epic's `members:` list). Do not commit the spec — the orchestrator commits it at launch.
- `execute` launches agents via shell scripts; it never moves files between directories.
- **Never hand-commit task specs** — `execute-plan.sh`/`execute-chain.sh` commit them automatically before cutting the worktree.
- **Never hand-edit `results/*.agent.md`** — it is worktree-owned and carried by the merge.
- **Never write to `.running/`** — the run-record is the orchestrator's; the reporter only reads it.
- **Never hand-move files** to archive — run `archive.sh` (it uses `git rm`).
- **After manually resolving a merge conflict, always clean up** (remove worktree, delete branch, `archive.sh {slug}`).
