---
name: todo-task
description: "Task lifecycle manager: create ideas, triage into specs, execute via headless agents, check status, monitor agents. Usage: /todo-task [create|triage|execute|status|monitor] [args]"
---

# todo-task

Unified task lifecycle manager. When the user's intent is clear (e.g. "make a todotask to..."), go straight to the appropriate mode — do not run status first.

Route on `$ARGUMENTS[0]`. Each non-trivial mode lives in a sibling file — **read that file before acting in the mode**:

| Command | Mode | Read first |
|---------|------|-----------|
| `/todo-task` or `/todo-task status` | Show status | inline below |
| `/todo-task monitor` | Live dashboard | inline below |
| `/todo-task create {description}` | File a new task | `create.md` |
| `/todo-task triage {slug}` | Refine a task into an executable spec | `triage.md` |
| `/todo-task execute {slug}` | Launch headless agent to implement a plan | `execute.md` |

All files are in `.claude/skills/todo-task/`. For the lifecycle model (derive-don't-store),
manual merge-conflict cleanup, deferred-chain finalization, and the invariant rules, read
`REFERENCE.md` — needed only when reasoning about state or cleaning up a merge by hand.

First-time setup: if todo-task scripts prompt for approval, read `.claude/skills/todo-task/SETUP.md` for a suggested allowlist (kept separate to avoid context pollution).

---

## Mode: `status` (default when no arguments)

**IMPORTANT: ALWAYS run the status script FIRST. Do NOT read files, investigate errors, check git state, or do any other research before running this script. Show the script output to the user, then follow the triage flow below. Only investigate issues after the full triage flow is complete and the user asks you to.**

Run the status script with `--archive` and display results:

```bash
bash .claude/skills/todo-task/status.sh --archive
```

`--archive` renders the board AND auto-archives clean successes and completed chains in the same step (status delegates to `archive.sh`), printing an `- Archived {slug}` line for each. Make this the default — archiving successes is routine, derived cleanup, not a decision, so never ask whether to do it. Add `--force-failed` only if the user also wants failures archived.

### Triage completed agents

The `--archive` render above already archived clean successes and completed chains and reported which ones — relay those lines to the user. Then handle the states it deliberately leaves in place (these need a human, and are never auto-archived):

**Conflict agents (`merge_conflict` / `merged_with_markers`):** NOT auto-archived — the worktree is kept for resolution. Check if the branch was already merged manually. If `git log` shows the agent's commits on the current branch, the conflict was already resolved — then `archive.sh {slug}` cleans up. If not, treat as a failed merge and ask the user.

**Ready-for-review agents (`--no-merge`):** NOT archived — they await a human merge of the agent branch.

**Failed agents (`build_failure`/`session_failed`/`no_op`/`trunk_leak`, crashed, failed chains):** Do NOT archive by default. `archive.sh --force-failed` archives them explicitly once reviewed. First, ask the user what to do with `AskUserQuestion` (header "Failed agent"), offering: **Fix it now** (recommended — investigate the failure and fix the code in the existing worktree), **Re-triage and retry** (refine the plan to avoid the failure, then re-launch), **Archive and skip** (move to archived, don't retry).

**Salvaged agents (`salvageable`, e.g. a crashed run finished and merged by hand):** Never `--force-failed`-eligible — a worktree with recoverable work is never auto-`rm`'d. Once the operator has finished the work by hand and squash-merged it to trunk, run `archive.sh --merged <slug>` to clean it up — this is the sanctioned exit, not hand-moving files into `.archived/`.

---

## Mode: `monitor`

Launch the live dashboard — a self-refreshing TUI showing running agents, recent completions, and epic progress.

Tell the user to run it in a separate terminal (it redraws on its own; press `q` or `Ctrl-C` to exit):

```bash
bash .claude/skills/todo-task/monitor.sh
```

---

## Core rules

Full detail (with rationale) lives in `REFERENCE.md`. The invariants:

- `create` only writes `inbox/{slug}.md` (gitignored draft). Never commit it.
- `triage` promotes the draft → `tasks/{slug}.md` and deletes the inbox draft (and may add a slug to an epic's `members:` list). Do not commit the spec — the orchestrator commits it at launch.
- `execute` launches agents via shell scripts; it never moves files between directories.
- **Never hand-commit task specs** — the orchestrator commits them automatically before cutting the worktree.
- **Never hand-edit `results/*.agent.md`** — it is worktree-owned and carried by the merge.
- **Never write to `.running/`** — the run-record is the orchestrator's; the reporter only reads it.
- **Never hand-move files** to archive — run `archive.sh` (it uses `git rm`).
- **After manually resolving a merge conflict, always clean up** — see `REFERENCE.md`.
