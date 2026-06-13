# Agent Result: carta-make-insert

date: 2026-06-13T15:45:00-04:00
session: completed
verification: passed
commits: 1
branch: feat/260422_claude_carta-make-insert
surface deviations: none
session id: 52a57d92-53f1-4ddb-8e9f-022d1b34b2e6


## Summary

Implementation complete. All 273 tests pass.

## Implementation Summary

Added `carta make --insert REF SLUG` — a displacing insert mode that opens a gap at REF's coordinate and shifts every sibling at that prefix or higher up by one.

**What changed:**

1. **`carta_cli/commands/_parser.py`**: Added `--insert` argument to `p_make`; updated epilog with an example.

2. **`carta_cli/commands/structure.py`**: Added `--insert` branch in `cmd_make` with:
   - Mutual exclusion guards: `--insert` + `--at` errors; `--insert` + two-positional errors
   - Shift-up move-set built by iterating `list_bundles` for all bundles at `prefix >= target_prefix`
   - `reversed()` iteration when applying moves to avoid path collisions (highest prefix first)
   - `compute_rename_map` + `rewrite_refs` for ref safety
   - Dry-run prints the shift plan without touching files
   - Falls through to the shared writer; single regeneration at end
   - Output: prints canonical ref + `Shifted: N sibling(s) renumbered`

3. **`carta_cli/ai_skill.py`**: Extended `make` docs to document `--insert` as the displacing counterpart to `--at`.

4. **`tests/test_cli.py`**: Added `TestMakeInsert` (8 tests): shifts siblings, rewrites refs, preserves bundle attachments, root-level insert, dry-run, mutual-exclusion guards, output format.

5. **`tests/__snapshots__/test_cli.ambr`**: Re-recorded 5 snapshots (make --help, make-group --help, ai-skill output).

6. **`.carta/03-product-design/03-cli-user-flow.md`**: Added `--insert` example.

## Notes

- The plan stated "no special ordering required" for the shift moves, but this is incorrect when consecutive bundles need to be shifted (e.g., 03→04, 04→05, 05→06). Applying in ascending order causes collisions. Used `reversed()` to process highest prefix first.
- `_assert_no_duplicate_prefixes` in `TestMakeInsert` is intentionally more precise than the version in `TestDelete`: it only flags two `.md` files or two directories at the same prefix, not bundle attachments sharing a prefix with their root.

## Surface Deviations

None.

## Commits

```
b902ddd9 feat: carta make --insert — open a gap and renumber siblings
```

## Build & Test Output (last 30 lines)

```
Shifted: 2 sibling(s) renumbered
--- after insert ---
.carta
└── 00-codex -- Codex
    ├── 00-index -- Codex
    ├── 01-about -- About This Workspace
    ├── 02-maintenance -- Maintenance
    ├── 03-conventions -- Conventions
    ├── 04-ai-retrieval -- AI Retrieval Patterns
    ├── 05-wedge -- Wedge
    ├── 06-alpha -- Alpha
    └── 07-beta -- Beta
Would insert at position 05 in 00-codex

=== Shift-up moves (3) ===
  00-codex/05-wedge.md -> 00-codex/06-wedge.md
  00-codex/06-alpha.md -> 00-codex/07-alpha.md
  00-codex/07-beta.md -> 00-codex/08-beta.md

=== Ref rename map (3 entries) ===
  doc00.05 -> doc00.06
  doc00.06 -> doc00.07
  doc00.07 -> doc00.08

Would create: 00-codex/05-dupe.md
  Position: 05

(dry-run: no files created)
Wrote /tmp/tmp.JiRkZ8rk6s/.carta/MANIFEST.md
regenerate OK
```
