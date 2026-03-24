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
