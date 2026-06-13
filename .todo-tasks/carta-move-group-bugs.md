# carta CLI: `move` same-parent reorder + `group` prefix collision

## Motivation

Related bugs in the carta structural commands surfaced while restructuring `.carta/` — first during the action-catalog scaffolding session (Bugs 1–2), then while renumbering the codex to `00-codex` (Bug 3). All are correctness/usability bugs that make routine workspace ops unreliable or unreachable. Filed together because they touch the same area — prefix handling, bundle travel, and the move/group commands.

## Description

### Bug 1 — `carta move` fails on same-parent reorder

When source and destination resolve to the same parent directory, `carta move` errors out with a spurious "No such file or directory" pointing at the would-be renamed path:

```
$ carta move 03-product-design/01-workspace-scripts/10-actions \
             03-product-design/01-workspace-scripts/ --order 5
Error: [Errno 2] No such file or directory:
  '/.../03-product-design/01-workspace-scripts/05-actions'
```

Workaround used: `mv` on disk + `carta rewrite doc03.01.10=doc03.01.05 ...` for every affected ref. That bypasses MANIFEST/regen and leaves room for skipped refs in externalRefPaths.

Expected behavior: same-parent move should act as a rename-with-renumber, renumbering other siblings as needed and rewriting all refs. This is the natural "reorder within a group" operation.

### Bug 2 — `carta group` silently creates a prefix collision

When a sibling file already occupies the target prefix, `carta group <dir>` creates the new directory at that prefix anyway, leaving the existing file with a duplicate `NN`. No error, no warning, no auto-bump. The file's attachments become orphans at that moment.

Reproduction (observed during this session):

```
$ ls
00-index.md  10-punch.md  10-punch.yaml

$ carta group ./10-actions --title "Actions"
# succeeds silently

$ ls
00-index.md  10-actions/  10-punch.md  10-punch.yaml
# 10-punch.md and 10-actions/ share prefix 10
# 10-punch.yaml is now an orphan (its bundle root vanished —
# directories can't be bundle roots)
```

Compounding: the subsequent `carta move 10-punch.md 10-actions/ --order 1` moved only the `.md`, not the `.yaml` — because at move-time the yaml was already orphaned, so carta didn't see it as part of punch's bundle. Had to `mv` the yaml manually.

Expected behavior: `carta group <dir>` should either (a) error with a prefix-collision message and refuse to proceed, or (b) auto-bump the existing sibling (and its bundle) to the next free prefix, rewriting refs.

### Bug 3 — `carta move --order 0` is globally blocked, but the root `00` slot is a valid group position

`carta move` rejects `--order 0` outright:

```
$ carta move 01-codex . --order 0
Error: --order must be >= 1 (position 0 is reserved for index files).
```

The guard is correct *within* a directory (00 is the `00-index.md` slot), but wrong at the **workspace root**, where `00` is the canonical codex group position — `carta init` seeds `00-codex` directly. So the documented `00-codex` convention is unreachable via `move`: a group at `01-codex` cannot be promoted to `00-codex` with the CLI.

Workaround used (renumbering this repo's codex `01-codex` → `00-codex`): `git mv` the directory, then `carta rewrite doc01.0X=doc00.0X ...` for each ref, then `carta regenerate`. Bypasses the structural-op path and is easy to get wrong.

Expected behavior: at the root level (or wherever `00` is not already an index slot), allow `--order 0` so a group can occupy the `00` position. Alternatively, add a dedicated group-renumber path. The reserved-position guard should be scoped to directory-internal moves, not applied unconditionally.

## Scope

- Reproduce all three bugs with minimal fixtures in `tests/`
- Fix `carta move` so same-parent reorder works: it should treat source and destination parent identity as a renumber operation, renumber siblings, and rewrite refs
- Fix `carta group` to detect prefix collision on the target: pick one of the expected behaviors (error-out OR auto-bump). Pick error-out by default — explicit is safer than magic — and require a flag (e.g., `--bump`) to opt into auto-renumber
- Fix `carta move --order 0`: scope the reserved-position guard to directory-internal moves so a group can be moved into the root `00` slot (or add a group-renumber path). This is the CLI-supported way to reach the `00-codex` convention
- Ensure that once `carta group` is fixed, the downstream bundle-travel bug (yaml left behind during move) no longer has a reachable state
- Add regression tests for both in `tests/commands/`

## Out of Scope

- Any larger redesign of the move/group commands' UX
- Changes to `rewrite` or `regenerate`
- Changes to bundle-detection logic beyond what's needed to validate the collision case

## Notes

- Relevant code likely in `carta_cli/commands/structure.py` (move, group) and `carta_cli/commands/transform.py` (punch reference for bundle-aware ops)
- Invariant at stake: INV-2 (prefix uniqueness per directory) from the action-catalog work at `doc03.01.02`. `carta group` currently violates it.
- The `punch` command is bundle-aware correctly (tested this session); comparing its bundle handling to `move` + `group` may surface why the latter two diverged
- Both bugs were encountered in sequence during one restructure, suggesting they're common enough to hit casually — not edge cases
