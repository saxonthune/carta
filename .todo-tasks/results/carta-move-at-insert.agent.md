# Agent Result: carta-move-at-insert

date: 2026-06-13T21:24:04-04:00
session: completed
verification: passed
commits: 2
branch: feat/260422_claude_carta-move-at-insert
surface deviations: none
session id: aeed9ff7-d83f-4523-b567-f51892459609


## Summary

Good. The implementation is complete with 2 commits.

## Implementation Summary

Successfully implemented `carta move --at/--insert` vocabulary per the plan, retiring `--order`.

**Changes made:**

1. **`carta_cli/commands/_parser.py`**: Made `destination` optional (`nargs="?"`), added `--at REF` and `--insert REF` flags, added epilog with 4 examples and `RawDescriptionHelpFormatter`.

2. **`carta_cli/commands/structure.py`** (`cmd_move`): Replaced blanket `--order < 1` guard with three-mode addressing resolution:
   - Combination guards (mutual exclusion, missing destination)
   - `--at`/`--insert` branch: parses ref via `DocRef.parse`, resolves parent path, applies index-slot guard (prefix 0 reserved only when `00-index.md` exists), strict occupancy precheck for `--at`
   - Append branch: existing positional destination logic unchanged

3. **`carta_cli/planning.py`**: Threaded `strict: bool = False` through `compute_all_moves`, `_compute_same_dir_moves`, and `_compute_cross_dir_moves`. When `strict=True`, destination sibling bumps are skipped in both strategies.

4. **`carta_cli/ai_skill.py`**: Rewrote the `move` doc block to document the three addressing modes, ref forms, slot-0 rule, and all flags.

5. **`tests/test_cli.py`**: Migrated 6 existing `--order` calls to `--insert`/append. Added `TestMoveAtInsert` class with 10 new tests covering: free-slot `--at`, occupied-slot error, displacing `--insert`, Bug-3 root promotion, index-slot guards, mutual exclusion guards, missing destination error, and help epilog.

6. **`.carta/` docs**: Updated `03-cli-user-flow.md` with `--insert` example and root-promotion example; updated `02-move.yaml` with new CLI signature and guard catalog (added `G-MOVE-6` for slot-0 rule).

7. **`tests/__snapshots__/test_cli.ambr`**: Re-recorded 3 updated snapshots (ai-skill move block and help text).

## Notes

- The `test_move_first_entry_to_last` test now uses `f"doc{max_prefix:02d}"` to construct the ref dynamically, matching the previous dynamic behavior.
- The smoke test's index-slot guard step errored for the wrong reason (source ref not found after the Bug-3 step changed workspace state), but unit tests `test_move_insert_into_index_slot_errors` and `test_move_at_into_index_slot_errors` cover this correctly.
- `--insert doc00.01` when source is already at position 01 (same-dir same-prefix) correctly hits the rename-only path — used in `test_move_bundle_with_rename_renames_same_slug_attachments`.

## Surface Deviations

None.

## Commits

```
0e7532ec test: re-record CLI snapshots for move --at/--insert vocabulary
6201d61e feat: carta move --at/--insert vocabulary, retire --order
```

## Build & Test Output (last 30 lines)

```
Wrote /tmp/tmp.MwKrC2U32N/.carta/MANIFEST.md
Moved 2 item(s):
  00-codex -> /tmp/tmp.MwKrC2U32N/.carta/01-codex
  01-group-x -> /tmp/tmp.MwKrC2U32N/.carta/00-group-x
Refs updated: 17 replacement(s) across 7 file(s)
Rename map (10 entries):
  doc00 -> doc01
  doc00.00 -> doc01.00
  doc00.01 -> doc01.01
  doc00.02 -> doc01.02
  doc00.03 -> doc01.03
  doc00.04 -> doc01.04
  doc00.05 -> doc01.05
  doc00.07 -> doc01.07
  doc01 -> doc00
  doc01.00 -> doc00.00
.carta
├── 00-group-x -- Group X
│   └── 00-index -- Group X
└── 01-codex -- Codex
    ├── 00-index -- Codex
    ├── 01-alpha -- Alpha
    ├── 02-about -- About This Workspace
    ├── 03-maintenance -- Maintenance
    ├── 04-conventions -- Conventions
    ├── 05-ai-retrieval -- AI Retrieval Patterns
    └── 07-beta -- Beta
Error resolving 'doc00.02': Cannot resolve segment '02' in /tmp/tmp.MwKrC2U32N/.carta/00-group-x: no entry starting with '02-'
Wrote /tmp/tmp.MwKrC2U32N/.carta/MANIFEST.md
regenerate OK
```
