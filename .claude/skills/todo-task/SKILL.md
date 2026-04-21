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

---

## Mode: `status` (default when no arguments)

**IMPORTANT: ALWAYS run the status script FIRST. Do NOT read files, investigate errors, check git state, or do any other research before running this script. Show the script output to the user, then follow the triage flow below. Only investigate issues after the full triage flow is complete and the user asks you to.**

Run the status script and display results:

```bash
bash .claude/skills/todo-task/status.sh
```

If `$ARGUMENTS` includes `--archive`, run with `--archive-success` flag.

### Triage completed agents

After showing status, handle completed agents:

**Successful agents:** Archive automatically. Also archives completed or resolved chains (worktrees, branches, manifests, and logs):
```bash
bash .claude/skills/todo-task/status.sh --archive-success
```

**Conflict agents (success but merge failed):** Check if the branch was already merged manually. If `git log` shows the agent's commits on the current branch, the conflict was already resolved — clean up the worktree, delete the branch, and archive. If not, treat as a failed merge and ask the user.

**Failed agents:** Do NOT archive. Ask the user what to do:

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

### Step 2: Write the task file

Write to `.todo-tasks/{slug}.md`:

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
- **Check for duplicates.** Scan `.todo-tasks/` first.

### Epic Tasks

If the task belongs to an existing epic (`{epic}.epic.md` in `.todo-tasks/`), prefix: `{epic}-{nn}-{slug}.md`

---

## Mode: `triage`

Refine a pending task from a rough idea into an executable spec that a headless agent can implement without asking questions. **This is interactive** — present findings, ask questions, get alignment before writing the spec.

**Input**: `$ARGUMENTS[1]` is the task slug. If empty, list pending tasks and ask.

### Step 1: List or select

If no slug provided:
```bash
ls .todo-tasks/*.md 2>/dev/null | grep -v '\.epic\.md$' | sed 's|.todo-tasks/||;s|\.md$||'
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

Read `.todo-tasks/{slug}.md`. Understand the motivation and scope. If it belongs to an epic (`{epic}-` prefix), also read `{epic}.epic.md` for context.

### Step 3: Research the codebase

Investigate the codebase to understand what changes are needed:

1. **Check `.carta/MANIFEST.md`** — use the tag index to map task keywords to relevant docs.
2. **Find relevant files** — Use Grep/Glob to locate code related to the task. Start broad (keyword search), then narrow to specific files.
3. **Read key files** — Read the files you'll need to modify. Understand their structure, patterns, and conventions.
4. **Understand test patterns** — Find existing tests near the code you'll change. Note the test framework, assertion style, and what's already covered.
5. **Check for gotchas** — Look for related code that might break, shared state, or implicit dependencies.

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

After the user has answered all questions and confirmed the approach, rewrite `.todo-tasks/{slug}.md` in place with this structure:

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
````

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

---

## Mode: `execute`

Launch a headless agent to implement a triaged plan.

**Input**: `$ARGUMENTS[1]` is the task slug. If empty, list pending tasks and ask. Supports `--no-merge` and `--chain`.

### Single plan execution

1. **Select** — If no slug, list available plans:
   ```bash
   ls .todo-tasks/*.md 2>/dev/null | grep -v '\.epic\.md$' | sed 's|.todo-tasks/||;s|\.md$||'
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
   - Check results: `.todo-tasks/.done/{slug}.result.md`
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

## Task Lifecycle

The todo-task system is a directory-as-state-machine. Files move through directories to represent lifecycle state.

```
.todo-tasks/              <- PENDING  (create creates, triage refines)
    |
.todo-tasks/.running/     <- EXECUTING (execute-plan moves files here)
    |
.todo-tasks/.done/        <- FINISHED  (agent writes .result.md here)
    |
.todo-tasks/.archived/    <- REVIEWED  (archived after triage)
```

### File Types

| Pattern | Purpose | Created by |
|---------|---------|------------|
| `*.md` | Task plans | `create` / `triage` |
| `*.epic.md` | Epic overview (not executable) | manual |
| `*.result.md` | Execution results | `execute` |
| `chain-*.manifest` | Chain progress tracker | `execute --chain` |
| `*.log` | Execution logs | `execute` |

## Manual Merge Conflict Resolution

When you manually resolve a merge conflict from an agent (e.g., merging the agent's branch yourself because auto-merge failed), you **must** clean up afterwards:

1. **Remove the worktree:**
   ```bash
   git worktree remove <worktree-path>
   ```
   The worktree path is in the `.result.md` file.

2. **Delete the agent branch** (it's already merged):
   ```bash
   git branch -d feat/260401_claude_{slug}
   ```

3. **Archive the task:**
   ```bash
   bash .claude/skills/todo-task/status.sh --archive-success
   ```

If you skip these steps, future sessions will see stale worktrees and unresolved conflicts in status output, and may try to re-resolve them.

## Rules

- `create` only writes to `.todo-tasks/`
- `triage` only modifies existing files in `.todo-tasks/`
- `execute` moves files through the lifecycle via shell scripts
- Never manually move files to `.running/`, `.done/`, or `.archived/`
- Never write `.result.md` files (agents create those)
- **After manually resolving a merge conflict, always clean up** (remove worktree, delete branch, archive task)
