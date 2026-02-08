---
name: execute-plan
description: Launches background agent to implement a plan from todo-tasks/
---

# execute-plan

Hands off a plan to a background agent that creates a worktree, implements the plan headlessly, verifies with build/test, and merges back into trunk.

## Usage

- `/execute-plan` — list available plans and pick one
- `/execute-plan {plan-name}` — execute a specific plan (filename without `.md`)

## Execution

### If no argument provided

List plans from `todo-tasks/*.md` and let the user pick:

```bash
ls todo-tasks/*.md | sed 's|todo-tasks/||;s|\.md$||'
```

Ask the user which plan to execute using AskUserQuestion.

### With a plan selected

1. **Confirm** — Show the plan summary and ask user to confirm execution.
2. **Launch** — Run the orchestrator in background:

```bash
nohup bash .claude/skills/execute-plan/execute-plan.sh {plan-name} > .claude/agent-results/{plan-name}.log 2>&1 &
```

3. **Report** — Tell the user:
   - The agent is running in the background
   - Check progress: `tail -f .claude/agent-results/{plan-name}.log`
   - Check results when done: `.claude/agent-results/{plan-name}.md`

### Options

Pass `--no-merge` to leave the branch ready for manual merge instead of auto-merging:

```bash
nohup bash .claude/skills/execute-plan/execute-plan.sh {plan-name} --no-merge > .claude/agent-results/{plan-name}.log 2>&1 &
```

## Prerequisites

- Must be on trunk branch (no `_claude` suffix)
- Plan file must exist in `todo-tasks/`
- `claude` CLI must be available
