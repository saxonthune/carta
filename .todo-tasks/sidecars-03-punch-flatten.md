# Bundle-Aware Punch and Flatten

## Motivation

`punch` and `flatten` change the *topology* of the workspace (leaf ↔ directory), not just basenames. Attachments must follow their root md through these transformations. Without this, a `punch` on a doc with sidecars orphans the sidecars at the old level; a `flatten` loses them entirely. See `sidecars.epic.md`.

**Requires**: task 01 (`sidecars-01-bundle-resolver`). Independent of task 02, but either can land first.

## Do NOT

- Do NOT try to make the outer directory own sidecars. Directories are never bundle roots; sidecars must live *inside* the new directory as a bundle rooted at `00-index.md`.
- Do NOT leave sidecars at the old level with no root. That creates orphans.
- Do NOT touch `move`, `delete`, `rename` here — task 02 owns those.
- Do NOT change ref-rewriting behavior. `punch` already doesn't rewrite refs (doc ref is unchanged). `flatten` does rewrite refs; attachments stay out of that map.
- Do NOT rename attachments by slug during `punch` — they keep their slug, just change prefix to `00-` (or `01-` under `--as-child`).

## Plan

### 1. Locate current implementations

`punch` and `flatten` live in `carta_cli/commands/structure.py` or `carta_cli/commands/transform.py` (grep to confirm). Both use helpers from `planning.py` for the move computation and `rewriter.py` for ref rewriting. Make the minimum changes that respect bundles.

### 2. Update `cmd_punch`

Current behavior: `NN-slug.md` → `NN-slug/00-index.md`. With `--as-child`: `NN-slug.md` → `NN-slug/01-slug.md` with a fresh `00-index.md`.

New behavior:
- Compute the target bundle with `bundle.find_bundle(target)`.
- For each attachment, move it into the new directory with prefix `00-` (default) or `01-` (`--as-child`), preserving its original slug segment.

Example default punch of `01-game-logic.md` + `01-game-logic.xstate.json` + `01-mockup.png`:
```
01-game-logic.md              → 01-game-logic/00-index.md
01-game-logic.xstate.json     → 01-game-logic/00-game-logic.xstate.json
01-mockup.png                 → 01-game-logic/00-mockup.png
```

Example `--as-child` punch of the same:
```
01-game-logic.md              → 01-game-logic/01-game-logic.md
01-game-logic.xstate.json     → 01-game-logic/01-game-logic.xstate.json
01-mockup.png                 → 01-game-logic/01-mockup.png
00-index.md (new)             ← skeleton group index
```

Implementation notes:
- The new directory is created with `mkdir`, then `shutil.move` each bundle member.
- Under `--as-child`, the new `00-index.md` skeleton is written via existing helper.
- The attachments' basenames become `{new_prefix:02d}-{attachment_slug}` where `attachment_slug` is everything after the old `NN-` in the old filename. Use the existing `numbering.get_slug` helper.

### 3. Update `cmd_flatten`

Current behavior: dissolves a directory, hoisting children into parent with renumbering, optionally keeping the index.

New behavior:
- Each hoisted child is a bundle (by task 01's resolver). Each bundle travels as a unit into the parent, receiving a new prefix via `--at` or sequential assignment.
- Attachments in the child bundles get the child's new prefix, keeping their own slugs.
- If `--keep-index` is set, the old `00-index.md` becomes `NN-<dir-slug>.md` at the insertion position. Its bundle (any attachments that were `00-*` siblings of `00-index.md`) travels with it, reprefixed to match.
- Orphans inside the flattened directory (attachments with no `.md` root at their prefix) are hoisted as-is but flagged for `regenerate`'s orphan report. They keep their prefix within the new parent (with offset applied).

Subtle edge case: `00-*` attachments of the index migrate out together only under `--keep-index`. Under the default discard, those attachments become orphans in the parent (or get discarded? decide explicitly).

**Decision**: discard `00-*` attachments alongside `00-index.md` when not `--keep-index`. A `--force` override already exists for discarding the index with significant content; extend its semantics to cover its attachments too. Document this in the help text.

### 4. Planning helper

If `planning.py` has shared logic for flatten's move computation, extend it similarly to task 02 — renumber by bundle, not by individual entry. If not, inline the logic in `cmd_flatten` itself; don't introduce a new module purely for this.

### 5. Tests: extend `tests/test_cli.py`

Add a new section `TestBundleAwarePunchFlatten`. Cases:

**punch**:
- Punch a leaf with one attachment (default) → verify `00-index.md` + `00-<attachment>.*` inside new dir; old files gone.
- Punch a leaf with multiple attachments (default) → all inside, all reprefixed.
- Punch with `--as-child` → attachments reprefixed to `01-`, new `00-index.md` generated; attachments' slug segment unchanged.
- Punch a leaf with no attachments → behavior identical to pre-change.
- Punch a directory → existing behavior (error or no-op), confirm unchanged.

**flatten**:
- Flatten a directory whose children each have attachments → each bundle travels.
- Flatten with `--keep-index` → index-bundle travels with its attachments.
- Flatten discards `00-index.md`'s attachments by default (verify they're deleted, not orphaned in parent). Test for expected warning-free behavior.
- Flatten with `--at N` → children inserted starting at N; earlier parent siblings bump; attachments travel.
- Flatten where a child bundle has an attachment but the main md renames via hoisting → cross-ref rewrite still works for the md's ref; attachments don't appear in the map.

## Files to Modify

- `carta_cli/commands/structure.py` — `cmd_punch`, `cmd_flatten` (~50-80 line delta).
- `carta_cli/planning.py` — possible small extension for flatten's bundle renumbering if the logic is reusable.
- `tests/test_cli.py` — new bundle test cases (~200 lines).

## Verification

- `make test` passes.
- Manual smoke on throwaway workspace:
  1. `carta init /tmp/sc && cd /tmp/sc`
  2. Create `01-game.md` + `01-game.json`.
  3. `carta punch doc00.01` → verify `01-game/00-index.md` + `01-game/00-game.json`.
  4. Second workspace: create a dir with two child bundles each with attachments.
  5. `carta flatten doc00.01` → verify all children hoisted with attachments intact.

## Out of Scope

- `move`, `delete`, `rename` (task 02).
- `attach` (task 04).
- MANIFEST / orphan reporting (task 05).
- Doc updates (task 06).

## Notes

- Punch's default (sidecars move into dir, reprefixed to `00-`) is opinionated — there's an alternative where sidecars become siblings of `00-index.md` at non-zero prefixes. We picked `00-` so they stay bundled with the new index. If feedback wants the alternative, revisit in a follow-up.
- Flatten's `00-*` attachment discard is intentionally aggressive. Users who care can pre-move attachments with `carta move` before flattening, or use `--keep-index`.
- Watch for Windows path-case quirks on directory-to-directory moves inside punch.
