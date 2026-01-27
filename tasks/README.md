# Task Queue System

Batch task processing for Carta development.

## Quick Start

```bash
# Add tasks (plain English)
./tasks/maketask fix button color in header
./tasks/maketask add tooltip to settings icon + test
./tasks/maketask write e2e tests for export

# Prepare and process
./tasks/prepare
# Then tell Claude: "process tasks"
```

## Two Modes

### Simple Mode: batch-executor (recommended for small tasks)
```
"process tasks"
```
- One agent processes all tasks sequentially
- Handles impl, tests, or both
- More token-efficient for small tasks

### Parallel Mode: task-master (for larger tasks)
```
"launch task-master"
```
- Spawns separate agents per task
- Better for complex/independent tasks
- More overhead but parallel execution

## Directory Structure

```
tasks/
├── maketask         # Script: add new task
├── prepare          # Script: prepare context for task-master
├── context.md       # Codebase summary (update periodically)
├── inputs/          # Pending tasks
│   ├── 1.txt
│   └── 2.txt
├── outputs/         # Completed tasks + results
│   ├── add-delete-dialog.txt
│   └── add-delete-dialog-result.md
└── clarifications/  # Tasks needing user input
    └── ambiguous-task.md
```

## Adding Tasks

Just write plain English:

```bash
./tasks/maketask Implement bulk selection with shift+click
./tasks/maketask Add tests for port connection validation
./tasks/maketask Fix: nodes sometimes render with wrong color
```

The script auto-increments task ID and writes to `inputs/{id}.txt`.

## Processing Tasks

1. **Prepare context** (optional but saves tokens):
   ```bash
   ./tasks/prepare
   ```
   This concatenates all pending tasks + codebase context into one file.

2. **Launch task-master**:
   ```
   launch task-master
   ```

Task-master will:
- Classify each task (TEST → test-builder, IMPL → task-executor)
- Create implementation plans
- Spawn agents in background
- Move completed tasks to `outputs/`

## Clarifications

If task-master can't understand a task, it writes to `clarifications/`:

```markdown
# Clarification: node-color-issue

## Question
Is this a bug fix or a feature request? Should nodes inherit
color from their schema or allow per-instance override?

## Options
- A: Bug fix - nodes should always use schema color
- B: Feature - add per-instance color override

---
>> (User: write your response below this line)

```

Add your response after `>>`, then run task-master again.

## Updating Context

Edit `context.md` when:
- Major features are added
- File structure changes
- New conventions are established

This keeps task-master efficient (reads summary instead of exploring).

## Token Efficiency

The `prepare` script reduces tokens by:
- Concatenating all tasks into one read
- Including codebase summary inline
- Including any clarification responses

Without prepare: ~5-10 tool calls per task
With prepare: 1 tool call for all tasks
