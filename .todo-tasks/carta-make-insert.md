# `carta make --insert` — open a gap and renumber siblings

## Motivation

`carta make` (see `carta-make-command.md`) places entries by **appending** or by writing into a **free** slot (`--at`, strict). Neither can insert *between* existing siblings — to put a doc at position 02 when 02-09 are occupied, you'd have to `move` everything by hand. `--insert` adds the missing mode: write at a target slot and bump every sibling at prefix ≥ target up by one, rewriting their refs.

This is the inverse of `delete`'s gap-*closing*. It is deliberately a **separate, additive** task (doc04.08.09, action-based API design — grow the action surface additively) because it mutates existing docs and their cross-references, inheriting the full ref-safety obligation that append/`--at` do not.

## Description

Add `--insert REF` to `carta make`. `carta make --insert doc01.02.03 my-slug` writes the new entry at `doc01.02.03.NN`... no — `--insert` takes a **full target coordinate** like `--at` (e.g. `doc01.02.03`), places the new entry there, and shifts the sibling currently at that prefix (and all higher siblings) up by one. `--insert` and `--at` are mutually exclusive (`--at` refuses to displace; `--insert` always displaces).

The renumber + ref-rewrite machinery already exists and is exercised by `cmd_delete`:
- `bundle_mod.list_bundles(parent_dir)` enumerates siblings (bundle members move together).
- Build a rename map shifting each bundle at prefix ≥ target by +1 (`NN → NN+1`).
- `compute_rename_map(moves, carta_root)` → apply filesystem renames → `rewrite_refs` across `collect_rewritable_files(carta_root)`.

`--insert` feeds that pipeline an "open a gap" move-set (shift up) instead of `delete`'s "close a gap" (shift down).

## Scope

- Add `--insert REF` to the `make` parser and `cmd_make`.
- Implement the shift-up rename-map construction (mirror `cmd_delete`'s gap-close loop, inverted; reuse `compute_rename_map` + `rewrite_refs` + `collect_rewritable_files`).
- Bundle attachments move with their host (same as delete).
- Respect `--dry-run` (print the rename map + the new entry, write nothing) and `--no-regen`.
- Mutual exclusion: `--insert` xor `--at` xor (plain append). Error clearly on combinations.
- Output the canonical ref of the new entry (same as `make`).

## Out of Scope

- Inserting across directories (only renumbers within the target's parent).
- Any change to append / `--at` semantics from the base `make` task.

## Notes

- **Test surface is the real cost.** This inherits move/delete's property obligations: refs preserved across the bump, no prefix collisions, MANIFEST consistent post-insert, bundles intact. Mine the existing delete property tests (`tests/test_cli.py`, the gap-closing assertions around lines ~580-730) and write the symmetric insert versions.
- Triage this only after `carta-make-command.md` has landed and merged — it builds directly on `cmd_make`.
- Watch the recursion: shifting a *directory*'s prefix changes the coordinate of everything under it. `compute_rename_map` + full-file `rewrite_refs` already handle this for delete; confirm the insert move-set produces the same nested rewrites.
