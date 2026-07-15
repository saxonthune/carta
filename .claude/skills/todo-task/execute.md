# todo-task: execute mode

Launch a headless agent to implement a triaged plan.

**Input**: `$ARGUMENTS[1]` is the task slug. If empty, list pending tasks and ask. Supports `--no-merge` and `--chain`.

## Single plan execution

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

## Options

- `--no-merge` — leave branch for manual review instead of auto-merging:
  ```bash
  bash .claude/skills/todo-task/launch.sh {slug} --no-merge
  ```

## Chain execution

If `--chain` is passed with multiple slugs, call `launch-chain.sh`:
```bash
bash .claude/skills/todo-task/launch-chain.sh {chain-name} {slug1} {slug2} ...
```

To queue a chain to start after a running or pending standalone task completes and merges, pass `--after <predecessor-slug>`:
```bash
bash .claude/skills/todo-task/launch-chain.sh {chain-name} {slug1} {slug2} ... --after {predecessor-slug}
```

The predecessor must be a standalone task (not part of the chain). It merges to trunk independently; the chain waits for it to complete and merge successfully before cutting its worktree from the now-updated trunk. If the predecessor fails or does not produce a result, the chain aborts. The predecessor slug must exist in pending, running, or done at launch time.
