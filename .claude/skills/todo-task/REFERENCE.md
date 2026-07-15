# todo-task: lifecycle & manual-cleanup reference

Background model for how the system represents task state, plus the hand-cleanup
procedures for merges the orchestrator could not complete automatically. Read this
when you need to reason about lifecycle state or resolve a conflict/deferred chain
by hand — the operational modes do not require it.

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

### Finalizing a deferred chain

When a chain defers its merge (`awaiting-merge` or `conflict`) and you complete the merge
by hand, the run-record lingers and the chain shows as `finalizable` on the dashboard.
After you finish the merge, run:

```bash
bash .claude/skills/todo-task/finalize-chain.sh <chain-name>
```

This writes the chain definition to trunk, removes the worktree and branch, and clears the
run-record. `archive.sh` then sweeps it as complete on the next run.

The script refuses to act if the chain's phase results are not yet present on trunk HEAD —
it will print the merge command and exit 1 without touching anything.

## Rules

- `create` only writes `inbox/{slug}.md` (gitignored draft). Never commit it.
- `triage` promotes the draft → `tasks/{slug}.md` and deletes the inbox draft (and may add a slug to an epic's `members:` list). Do not commit the spec — the orchestrator commits it at launch.
- `execute` launches agents via shell scripts; it never moves files between directories.
- **Never hand-commit task specs** — `execute-plan.sh`/`execute-chain.sh` commit them automatically before cutting the worktree.
- **Never hand-edit `results/*.agent.md`** — it is worktree-owned and carried by the merge.
- **Never write to `.running/`** — the run-record is the orchestrator's; the reporter only reads it.
- **Never hand-move files** to archive — run `archive.sh` (it uses `git rm`).
- **After manually resolving a merge conflict, always clean up** (remove worktree, delete branch, `archive.sh {slug}`).
