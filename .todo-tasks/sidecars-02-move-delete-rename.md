# Bundle-Aware Move, Delete, Rename

## Motivation

`move`, `delete`, and `rename` all mutate basenames or numeric prefixes in place. With sidecars landed as first-class bundle members (task 01), these three commands must travel the whole bundle together. Otherwise structural ops silently rot the spec graph — exactly the drift problem Carta exists to prevent. See `sidecars.epic.md`.

**Requires**: task 01 (`sidecars-01-bundle-resolver`) merged.

## Do NOT

- Do NOT modify `rewrite_refs` or `rewriter.py`. Cross-reference rewriting stays md-only; attachments have no refs of their own at Level 2.
- Do NOT touch `punch` or `flatten` here — task 03 owns those.
- Do NOT try to renumber attachments independently of their root. They always share the root's prefix.
- Do NOT add an orphan-warning output here; `regenerate` (task 05) owns that. Commands simply leave orphans in place.
- Do NOT scan the whole workspace for ref rewriting of attachment paths — attachments aren't addressable by doc ref.
- Do NOT conflate "same-slug attachment" with "same-prefix attachment" during rename. Only same-slug ones get their basename rewritten.

## Plan

### 1. Update `carta_cli/planning.py` to be bundle-aware

`compute_all_moves` currently treats a single source file and renumbers direct siblings. Refactor so that:

- When a source is a `NN-<slug>.md` leaf, the move set includes every attachment in its bundle (`bundle.bundle_members`), each getting the same prefix change as the root. Same-slug attachments that get renamed via `--rename` follow the root's new slug; non-same-slug attachments keep their slug but take the new prefix.
- Source sibling gap-closing and destination sibling bumps operate on **bundles**, not individual files. That is, shifting bundle `03-` to `02-` means renaming `03-foo.md`, `03-foo.xstate.json`, and `03-bar.yaml` all to `02-*`.
- `trace_path` and `compute_rename_map` stay unchanged — they already thread the moves list correctly. Attachments never appear in the rename_map (they have no refs); only the md roots do.

Approach: introduce an internal `_compute_bundle_moves(bundle, new_prefix, new_slug=None)` helper that expands one bundle into the concrete list of `(old, new)` pairs, and call it everywhere `_compute_same_dir_moves` / `_compute_cross_dir_moves` currently emits a single move for a root.

### 2. Update `cmd_move` in `carta_cli/commands/structure.py`

Minimal change — `compute_all_moves` now returns the bundle-expanded list. Validate that:
- `args.source` must resolve to a `NN-<slug>.md` (existing behavior) or a directory. Attempting to `move` an attachment directly should raise `CartaError("cannot move an attachment directly; move its root md")`.
- The `len(dest_entries) >= 99` check already counts bundles-as-groups since it counts numbered entries; revisit: it may over-count when a bundle has many attachments. Fix to count distinct prefixes, not distinct files, by using `bundle.list_bundles` length.

Output unchanged in spirit; just lists more moves when attachments exist.

### 3. Update `cmd_delete` in `carta_cli/commands/structure.py`

- `target_paths` must be bundle roots (md) or directories. Reject targeting an attachment directly (same error as move). If the user really wants to delete an attachment, they can `rm` it — that's out of scope for `delete` at Level 2.
- `_collect_refs_under` stays md-focused (attachments have no refs).
- When deleting a root md, `shutil.rmtree` the bundle: unlink the md, unlink every attachment in the bundle. Reuse `bundle.bundle_members` to enumerate.
- Gap-closing already walks `list_numbered_entries` and renumbers remaining siblings. Refactor to walk bundles instead: for each surviving bundle in each parent, assign it the next sequential prefix and emit moves for every member (root + attachments).
- The orphan-ref scan (`_find_orphaned_refs`) is unrelated to sidecars; leave as-is.

### 4. Update `cmd_rename` in `carta_cli/commands/structure.py`

Current `rename` only renames the target file. Extend:

- If the target is a directory or `00-index.md`, behavior is unchanged (directories never own attachments; `00-index.md` renaming via `rename` is already forbidden elsewhere if applicable — confirm).
- If the target is a leaf md, compute `bundle.find_bundle(target_path)`, then use `bundle.slug_matched_attachments(bundle, old_slug)` to collect attachments to rename. For each, construct the new basename by replacing the `NN-<old-slug>.` prefix with `NN-<new-slug>.`. Attachments not in the matched set are untouched.
- Do the renames in a single pass with `shutil.move`, same pattern as current code.
- Regen at the end (existing behavior via `args.no_regen`).

Output: print each renamed file. Example:
```
Renamed: 01-game-logic.md -> 01-state-engine.md
Renamed: 01-game-logic.xstate.json -> 01-state-engine.xstate.json
Left unchanged (same prefix, different slug): 01-mockup.png
```
The "left unchanged" line is optional but helpful for user confidence.

### 5. Tests: extend `tests/test_cli.py`

Add a new test class or section, `TestBundleAwareMoveDeleteRename`. Use existing workspace-fixture patterns.

Cases (at minimum):

**move**:
- Move a bundle (`01-foo.md` + `01-foo.json` + `01-bar.yaml`) to a new prefix within the same directory → all three renumbered.
- Move a bundle across directories → all three travel.
- Move with `--rename` → root md gets new slug; same-slug attachment (`01-foo.json`) gets new slug; non-same-slug attachment (`01-bar.yaml`) keeps its slug, new prefix.
- Attempting to move an attachment path directly → `CartaError`.

**delete**:
- Delete a bundle with attachments → all attachments removed alongside the md.
- Delete the lowest-prefixed of three bundles → remaining bundles gap-close as groups (attachments travel with their roots).
- Delete multiple bundles in one call → gap-close remaining bundles correctly.

**rename**:
- Rename a bundle with one same-slug and one differently-slugged attachment → only same-slug renamed; differently-slugged retained.
- Rename where there are no attachments → behaves identically to pre-change.
- Rename an `assets/` directory attachment case (if relevant). Confirm directory attachments are covered: `01-foo.assets/` should rename to `01-new.assets/` when the slug matches. Edge case — handle or defer explicitly.

**cross-ref integrity** (regression):
- Move a doc with attachments → refs to `doc01.02.03` still rewrite correctly; attachments never appear in `rename_map`.

## Files to Modify

- `carta_cli/planning.py` — bundle-aware `compute_all_moves` (~60-100 line delta, mostly refactoring existing helpers).
- `carta_cli/commands/structure.py` — update `cmd_move`, `cmd_delete`, `cmd_rename` to consume the bundle helpers and to reject direct attachment operations (~40-60 line delta).
- `tests/test_cli.py` — extend with bundle cases (~250 lines of new tests).

## Verification

- `make test` passes. All existing `test_cli.py` cases still pass (no regressions on pure-md workspaces).
- New bundle test cases pass.
- Manual smoke on a throwaway workspace:
  1. `carta init /tmp/sc && cd /tmp/sc`
  2. `carta create 00-codex logic && touch .carta/00-codex/01-logic.statemachine.json .carta/00-codex/01-logic.mockup.png`
  3. `carta move doc00.01 doc00.02 --order 1` → verify all three files moved.
  4. `carta rename doc00.01 engine` → verify json renamed, png not (if png is same-slug, it renames; pick a differently-slugged sidecar to test non-rename branch).
  5. `carta delete doc00.01` → verify all three files gone; gap-close correct.

## Out of Scope

- `punch` and `flatten` (task 03).
- `attach` command (task 04).
- MANIFEST attachment column, orphan warnings in `regenerate` (task 05).
- Doc updates (task 06).
- Level 3 (sidecars-as-docs).

## Notes

- The `99-item` cap in `cmd_move` counts numbered entries. With bundles, a single bundle with 10 attachments used to count as 10 items; fix to count bundles (distinct prefixes) instead. Easy via `len(bundle.list_bundles(dest_path))`.
- Watch for the `--no-gap-close` path in cross-dir moves; bundle members must still gap-close together if gap-close is on, and all stay in place if off.
- Regression risk: `_compute_same_dir_moves` has subtle range logic (moving UP vs DOWN). Make sure bundle expansion keeps members adjacent and doesn't split when a range overlaps partially.
