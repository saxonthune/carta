---
name: todo-task
description: Creates a todo-task file for later grooming and execution. Use when any session discovers a bug, improvement, or feature idea that should be tracked but not implemented immediately.
---

# todo-task

Quickly files a todo-task so the current session can continue its primary work. The task enters the lifecycle at `todo-tasks/` (pending) and will be picked up later by `/carta-feature-implementor` for grooming and `/execute-plan` for implementation.

## When to Use

- A session discovers a bug while working on something else
- A session notices a missing feature or improvement opportunity
- A user wants to capture an idea without switching context
- Any time work should be deferred, not done now

## Usage

- `/todo-task` — interactive: asks what to file
- `/todo-task fix: edge routing breaks when organizer is collapsed` — file from a one-liner
- `/todo-task` while looking at a bug — infers context from conversation

## Task Lifecycle

The todo-task system is a directory-as-state-machine. Files move through directories to represent lifecycle state.

```
todo-tasks/              ← PENDING (you create files here)
    ↓
todo-tasks/.running/     ← EXECUTING (execute-plan moves files here)
    ↓
todo-tasks/.done/        ← FINISHED (agent writes .result.md here)
    ↓
todo-tasks/.archived/    ← REVIEWED (implementor archives after triage)
```

**You only write to `todo-tasks/`.** The other directories are managed by downstream skills.

### API Surface

The lifecycle is operated by three skills and a set of shell scripts. Each has a single responsibility.

#### Capture — `/todo-task` (this skill)

```
task create <slug>              # write a task file to todo-tasks/
task create <slug> --epic <name>  # write with epic prefix
```

Input: a rough idea, bug report, or feature request.
Output: a markdown file in `todo-tasks/` with enough context for a groomer.

#### Groom — `/carta-feature-implementor`

```
task status                     # report on all lifecycle states
task archive --successful       # bulk archive passing results
task groom <slug>               # interactive: refine into executable spec
task groom --first              # grab first pending task alphabetically
task groom --all                # briefing for all pending tasks
```

Input: a pending task file in `todo-tasks/`.
Output: the same file, rewritten with concrete file paths, implementation steps, verification instructions, and negative constraints — unambiguous enough for a headless agent.

The groomer is **project-specific**. It has extra context that a generic system doesn't:

1. **Doc system navigation** — reads `.carta/MANIFEST.md` tag index to map plan keywords to architecture docs, getting design context without reading source.
2. **Two-phase codebase search** — cheap `Grep` triage (files_with_matches) guided by MANIFEST tags, then targeted reads. Never speculative.
3. **Verification operationalization** — classifies correctness properties by where truth lives (data model → adapter test, compiler output → oracle test, rendered UI → E2E), based on knowledge of the project's test boundaries.

A different project would supply a different groomer with its own doc system, search strategy, and test boundary knowledge.

#### Execute — `/execute-plan`

```
task execute <slug>             # launch headless agent in worktree
task execute <slug> --no-merge  # leave branch for manual review
task chain <s1> <s2> ...        # sequential execution, stop on failure
```

Input: a groomed task file in `todo-tasks/`.
Output: a worktree with committed changes, merged back to trunk (or left as branch).

The executor is **project-agnostic**. It:
1. Moves the plan to `.running/`
2. Creates a git worktree + branch
3. Runs `claude -p` with the plan as prompt and a budget cap
4. Writes a `.result.md` to `.done/` with status, branch, and log path
5. Merges to trunk on success (unless `--no-merge`)

Chain execution (`launch-chain.sh`) runs plans sequentially, creating a `.manifest` file that claims all phases so parallel agents don't touch them.

#### Status — `status.sh`

```
task status                     # full report: completed, running, chains, pending, stale worktrees
task archive --successful       # move successful .done/ results to .archived/
```

Parses `.result.md` files for status, reads chain manifests, detects stale worktrees. One script, all information, no follow-up commands needed.

### File Types

| Pattern | Purpose | Created by |
|---------|---------|------------|
| `*.md` | Task plans | `/todo-task` or `/carta-builder` |
| `*.epic.md` | Epic overview (not groomable) | `/carta-builder` |
| `*.result.md` | Execution results | `execute-plan.sh` |
| `chain-*.manifest` | Claims a sequence of plans | `launch-chain.sh` |
| `*.log` | Execution logs | `launch.sh` / `launch-chain.sh` |

### What's Generic vs Project-Specific

| Component | Generic? | Notes |
|-----------|----------|-------|
| Directory lifecycle | Yes | Just file moves between directories |
| `status.sh` | Yes | Parses result files, reports tables |
| `execute-plan.sh` | Yes | Worktree + headless claude + merge |
| `launch.sh` / `launch-chain.sh` | Yes | Backgrounding, log capture |
| `/todo-task` (capture) | Yes | Template + guard rails |
| Groomer | **No** | Needs project docs, search strategy, test boundaries |
| Verification strategy | **No** | Needs knowledge of testable boundaries |
| Epic structure | Partly | Naming convention is generic, content is project-specific |

## How to Create a Task

### Step 1: Generate a slug

Format: `{slug}.md` where slug is a kebab-case description.

Examples:
- `fix-edge-routing-collapsed-organizer.md`
- `add-undo-for-schema-deletion.md`
- `navigator-stale-after-file-rename.md`

### Step 2: Write the task file

Write to `todo-tasks/{slug}.md` using this template:

```markdown
# {Title}

## Motivation

{Why this task exists. 2-3 sentences. Include how it was discovered if relevant.}

## Description

{What needs to happen. Be concrete about the problem/feature. Reference specific files, functions, or behaviors if known.}

## Scope

- {Bullet list of what's in scope}
- {Be specific enough that a groomer can act on it}

## Out of Scope

- {Anything explicitly NOT part of this task}

## Notes

- {Optional. Context that would help the groomer: related files, prior attempts, links to related tasks.}
```

### Step 3: Confirm to the user

Tell the user:
- The task file was created at `todo-tasks/{slug}.md`
- It will be picked up by `/carta-feature-implementor` for grooming
- Continue with current work

## Guidelines

- **Be concrete.** "Edge routing breaks when X" is better than "edge routing issues."
- **Include reproduction context.** If you found a bug, note what you were doing when you found it, what file you were in, what the symptoms were.
- **Reference files.** If you know which files are involved, list them. The groomer will verify they still exist.
- **One task per file.** Don't bundle unrelated work. If you found three bugs, file three tasks.
- **Don't over-specify the solution.** Describe the problem and desired outcome. The groomer decides the implementation approach.
- **Don't groom it yourself.** This skill is for quick capture. Resist the urge to write implementation steps, file lists, or verification sections — that's `/carta-feature-implementor`'s job.
- **Check for duplicates.** Quickly scan `todo-tasks/` before creating. If a similar task exists, add a note to it instead of creating a new one.

## What NOT to Do

- Do NOT move files to `.running/`, `.done/`, or `.archived/`
- Do NOT write `.epic.md` files (those are created by `/carta-builder`)
- Do NOT write `.result.md` files (those are created by agents)
- Do NOT try to groom or refine the task (that's `/carta-feature-implementor`)
- Do NOT launch execution (that's `/execute-plan`)
- Do NOT stop current work to implement the task — file it and move on

## Epic Tasks

If the task is clearly part of an existing epic (files matching `{epic}-*.md` or `{epic}.epic.md` in `todo-tasks/`), prefix the slug:

```
{epic}-{nn}-{slug}.md
```

Example: if `testability.epic.md` exists and you're filing a testing task:
```
testability-11-compiler-edge-case-tests.md
```

If unsure whether an epic exists, just use a plain slug. The groomer will associate it later if needed.
