# `carta move` — adopt the `make` positional-write vocabulary (`--at` / `--insert`), retire `--order`

## Motivation

`carta make` established a clean vocabulary for positional writes — a **collision
policy** layered on a coordinate:

- *(no flag)* → **append** (next free slot)
- `--at REF` → **strict** (write iff the slot is free, else error; never displaces)
- `--insert REF` → **displacing** (write at REF, bump every sibling ≥ up by one, rewrite refs)

`carta move` already does two of these three under a different name: with no flag it
appends, and `--order N` is *exactly* `--insert` semantics ("inserts at destination,
bumps destination siblings at or above `--order`"). What it lacks is a **strict** mode,
and its addressing is a bare position number rather than a ref. This task unifies
`move` onto the `make` vocabulary: **remove `--order`, add `--at REF` and `--insert REF`,
both taking a full ref that subsumes the destination** (Flavor A — one mental model
across the CLI). `carta move src --insert doc00` and `carta make foo --insert doc00`
then read identically.

This also **dissolves the old "Bug 3"** (`move --order 0` was globally banned, making the
canonical `00-codex` root position unreachable via the CLI). Position 0 stops being a
magic number: the reserved slot is reframed as a real invariant — *slot 0 is reserved
only when a `00-index.md` occupies it.* The workspace root has no `00-index.md`, so
`carta move 01-codex --insert doc00` promotes a group into root slot 0, bumping the
existing `00-codex` to `01`.

Backwards compatibility is not a concern (CLAUDE.md) — remove `--order` entirely.

> The original triage draft (`carta-move-group-bugs.md`) bundled three bugs. Two are
> already resolved: Bug 1 (same-parent reorder) was fixed when `_compute_same_dir_moves`
> landed; Bug 2 (`carta group` silent prefix collision) is obsolete — `group` was folded
> into `carta make -g`, whose strict `--at` / append semantics make collisions
> unreachable. Only Bug 3 remained, and this task subsumes it into the vocabulary work.

## Do NOT

- **Do NOT keep `--order`** as an alias or deprecated path. Remove it from the parser,
  `cmd_move`, `ai_skill`, tests, docs, and the action-catalog yaml. No compatibility shim.
- **Do NOT touch `carta copy`** — it also has `--order`, but unifying it is an explicit
  follow-up (out of scope here). Leave `copy`'s `--order` exactly as is.
- **Do NOT touch `make`, `delete`, `punch`, `flatten`, `rename`, `attach`.**
- **Do NOT** reinvent the displacing/gap-close/bundle machinery. `--insert` is literally
  the current `--order` code path with the position sourced from a ref instead of an int.
  Reuse `compute_all_moves` / `_compute_same_dir_moves` / `_compute_cross_dir_moves`,
  `compute_rename_map`, `rewrite_refs`, `collect_rewritable_files`.
- **Do NOT** let `--at`/`--insert` coexist with each other or with a positional destination
  (mutually exclusive — the ref carries the destination).
- **Do NOT** allow displacing or occupying a directory's `00-index.md` slot. Inside any
  directory that contains a `00-index.md`, target prefix `00` is reserved. At the workspace
  root (no `00-index.md`) prefix `00` is a normal group position and must be allowed.
- **Do NOT hand-edit `tests/__snapshots__/test_cli.ambr`** — re-record with syrupy's
  `--snapshot-update`.

## Plan

### 1. Parser — `carta_cli/commands/_parser.py` (move block, ~lines 73-82)

Replace the `--order` argument and make the destination optional:

```python
p_move = subparsers.add_parser("move", help="Move/reorder entries")
p_move.add_argument("source", help="Path or doc ref to move")
p_move.add_argument("destination", nargs="?", default=None,
                    help="Target directory (append mode). Omit when using --at/--insert.")
p_move.add_argument("--at", default=None,
                    help="Exact target ref (docXX.YY.ZZ | dXX.YY | XX.YY); moves iff the slot is free, else error")
p_move.add_argument("--insert", default=None,
                    help="Insert at REF, bumping that sibling and all higher ones up by one")
p_move.add_argument("--mkdir", action="store_true")
p_move.add_argument("--rename", default=None)
p_move.add_argument("--no-regen", action="store_true", help="Skip MANIFEST regeneration.")
p_move.add_argument("--no-gap-close", action="store_true",
                    help="Skip gap-closing of source siblings. Use for batch moves.")
p_move.add_argument("--dry-run", action="store_true")
```

Give `p_move` (or update its existing) Examples epilog mirroring the `make` epilog
(there is a `move` help-has-examples test, so it needs examples). Cover: append
(`carta move doc01.03 02-architecture`), strict (`carta move doc01.03 --at doc02.05`),
displacing (`carta move doc01.03 --insert doc02.01`), and root promotion
(`carta move doc01 --insert doc00`).

### 2. `cmd_move` — `carta_cli/commands/structure.py` (~line 426)

**Replace the blanket `--order` guard** (lines 428-429, `if args.order is not None and
args.order < 1: ...`) with addressing resolution that mirrors `cmd_make`.

**a. Combination guards (top of the function):**
- `args.at is not None and args.insert is not None` → `CartaError("--at and --insert are mutually exclusive")`
- `(args.at is not None or args.insert is not None) and args.destination is not None`
  → `CartaError("--at/--insert takes its destination from the ref; do not also pass a destination")`
- `args.at is None and args.insert is None and args.destination is None`
  → `CartaError("provide a destination (append), or use --at/--insert")`

**b. Resolve source** as today (`resolve_and_validate`, attachment guard, rename-index guard).

**c. Resolve `(dest_path, target_prefix, strict)`** from the three modes:
- **append** (positional `destination`, no `--at`/`--insert`): keep the existing
  destination-resolution + `--mkdir` block verbatim. `target_prefix = None`
  (compute_all_moves appends), `strict = False`.
- **`--at REF`** / **`--insert REF`**: parse the ref with `DocRef.parse(args.at or args.insert)`
  (it already accepts `docXX.YY.ZZ | dXX.YY | XX.YY` — do not write a new parser).
  `target_prefix = ref.segments[-1]`; the parent is `DocRef(segments=ref.segments[:-1])`
  resolved to a path (`carta_root` when the parent coordinate is empty — i.e. root-level
  refs like `doc00`). `dest_path = parent_path`. Require `dest_path.is_dir()` (no `--mkdir`
  composition with refs — error if the parent does not exist). `strict = (args.at is not None)`.

**d. Index-slot guard (the Bug-3 fix), applied only in the `--at`/`--insert` branch:**
```python
if target_prefix == 0 and (dest_path / "00-index.md").exists():
    raise CartaError(f"position 00 is reserved for 00-index.md in {dest_path.name}")
```
At the workspace root there is no `00-index.md`, so prefix 0 is permitted there.

**e. Strict (`--at`) occupancy precheck:** build the occupied-prefix set of `dest_path`
excluding the source itself, the way `cmd_make` does
(`{EntryName.parse(e.name).prefix for e in list_numbered_entries(dest_path) if EntryName.parse(e.name)}`);
if `target_prefix` is in it → `CartaError(f"position {target_prefix:02d} is occupied in {dest_path.name}")`
(mirror make's occupied-slot message, including the occupied list if cheap).

**f. Compute moves:** call `compute_all_moves(source_path, dest_path, target_prefix,
rename_slug=args.rename, no_gap_close=args.no_gap_close, strict=strict)`. The rest of
`cmd_move` (rename_map, dry-run, apply, `rewrite_refs`, regen, output) is **unchanged**.

### 3. `compute_all_moves` + strategies — `carta_cli/planning.py`

Thread a `strict: bool = False` parameter through `compute_all_moves`,
`_compute_same_dir_moves`, and `_compute_cross_dir_moves`. `strict` means **non-displacing**:
the destination slot is already known free (precheck in `cmd_move`), so place the source
there and do **not** bump destination siblings.

- **`compute_all_moves`**: accept `strict` and forward it to both sub-strategies.
- **`_compute_cross_dir_moves`**: when `strict`, **skip step 1** (the destination
  sibling-bump loop, lines ~195-204). Keep step 2 (source-side gap-close, honoring
  `no_gap_close`) and step 3 (main move + bundle). `insertion_prefix = order` (order is
  never `None` in strict mode).
- **`_compute_same_dir_moves`**: when `strict`, skip the range-shift logic — emit only
  the main move of the source (+bundle) to `order`'s prefix (reuse `_compute_bundle_moves`
  / the existing main-move tail). Do not gap-close the vacated source slot: `--at` is exact
  placement by definition (same contract as `make --at`). When `order == source_prefix`,
  it is a no-op (return `[]`, or just the rename if `rename_slug` differs — preserve the
  existing no-op/rename handling).

`--insert` and append pass `strict=False` and hit the **existing** displacing/append code
unchanged — `--insert`'s `order = target_prefix` is exactly what `--order` fed in before.

> Sanity check for Bug 3: `carta move 01-codex --insert doc00` is a *same-dir* reorder at
> root (source parent == dest == root). `_compute_same_dir_moves` with `order=0`,
> `strict=False`, `source_prefix=1` takes the moving-up branch, range `[0, 0]` → bumps
> `00-codex`→`01`, then moves `01-codex`→`00`. Correct. The only thing that previously
> blocked it was the deleted `--order < 1` guard.

### 4. `ai_skill.py` — move entry (~line 133)

Rewrite the `"move"` `_COMMAND_DOCS` block:
- Synopsis: `carta move <source> [<destination>] [--at REF | --insert REF] [--mkdir] [--rename SLUG] [--no-regen] [--no-gap-close] [--dry-run]`.
- Document the three addressing modes (append via positional destination; `--at REF`
  strict / non-displacing; `--insert REF` displacing — bumps siblings ≥ and rewrites refs).
- State the accepted ref forms (`docXX.YY.ZZ | dXX.YY | XX.YY`) and that `--at`/`--insert`
  carry the destination (mutually exclusive with the positional destination and each other).
- Document the `00`-slot rule: reserved inside a directory (held by `00-index.md`), free
  at the workspace root (group position).
- Remove every `--order` reference (including the "Position 0 is reserved: `--order` must
  be >= 1" note — replace it with the `00-index` reservation phrasing above).

### 5. Tests — `tests/test_cli.py`

Migrate existing `--order` move calls (lines 634, 663, 726, 1902, 1932, 2024) to the new
flags. Most are displacing → `--insert`, sourced as a ref at the destination:
- `move "03-architecture" "." --order 1` → `move "03-architecture" --insert doc00`
  (root, position 1 → `--insert doc01`; pick the ref matching the intended prefix).
- `move "doc00.01" "00-codex" --order 3` → `move "doc00.01" --insert doc00.03`.
- The `--rename ... --order 1` case → `--rename engine --insert <ref>.01`.
- The `--order 3 --dry-run` case → `--insert <ref>.03 --dry-run`.

Add new tests:
- `test_move_at_free_slot` — `--at` into a genuinely free slot (cross-dir, or a same-dir
  gap from a prior `--no-gap-close`): source lands at the exact prefix, **no** destination
  sibling is renumbered.
- `test_move_at_occupied_errors` — `--at` onto an occupied prefix errors with the
  occupied-slot message; nothing is moved.
- `test_move_insert_displaces` — `--insert` into an occupied middle slot bumps that
  sibling and every higher one up by one, refs rewritten (no orphans).
- `test_move_promote_group_to_root_zero` — **the Bug-3 regression**: create a group at a
  non-zero root slot, `carta move <group> --insert doc00`; assert it lands at `00` and the
  former `00-codex` (and others) shifted up, refs rewritten, MANIFEST consistent.
- `test_move_insert_into_index_slot_errors` — `--insert <dir>.00` (or `--at`) targeting a
  directory that has a `00-index.md` errors with the reserved-slot message.
- `test_move_at_and_insert_mutually_exclusive` and
  `test_move_ref_flag_rejects_positional_destination` — combination guards.
- Update the `move` help-has-examples test for the new epilog.

Re-record the snapshot (Verification below) — the `.ambr` move/help blocks change.

### 6. Docs + action catalog

- **doc03.03** (`.carta/03-product-design/03-cli-user-flow.md`, line ~113): change
  `carta move 01-product/03-my-feature 01-product --order 1` to the `--insert` form, and
  add a root-promotion example (`carta move doc01 --insert doc00`).
- **doc03.01.05.02** action spec — update the CLI string in
  `.carta/03-product-design/01-workspace-scripts/05-actions/02-move.yaml` (line 5) and any
  `--order` prose in `02-move.md` to the `--at`/`--insert` vocabulary.
- Run `carta regenerate` after doc edits (frontmatter is unchanged, so MANIFEST should be
  unaffected — run it to confirm no drift).

## Files to Modify

- `carta_cli/commands/_parser.py` — move parser: drop `--order`, add `--at`/`--insert`, optional destination, epilog
- `carta_cli/commands/structure.py` — `cmd_move`: addressing resolution, combination guards, index-slot guard, strict precheck
- `carta_cli/planning.py` — thread `strict` through `compute_all_moves` and both sub-strategies (non-displacing path)
- `carta_cli/ai_skill.py` — rewrite the `move` doc to the new vocabulary
- `tests/test_cli.py` — migrate `--order` calls, add `--at`/`--insert`/root-promotion/guard tests
- `tests/__snapshots__/test_cli.ambr` — re-record (do not hand-edit)
- `.carta/03-product-design/03-cli-user-flow.md` — move command examples
- `.carta/03-product-design/01-workspace-scripts/05-actions/02-move.yaml` — CLI string
- `.carta/03-product-design/01-workspace-scripts/05-actions/02-move.md` — `--order` prose, if any

## Verification

```bash
# Re-record the CLI snapshot after the vocabulary change, then run the full suite
make test || python -m pytest tests/test_cli.py --snapshot-update -q
make test

# Smoke-test the three addressing modes + Bug-3 root promotion against a scratch workspace
export PYTHONPATH="$PWD"
S=$(mktemp -d); ( cd "$S" && python -m carta_cli.main init >/dev/null )
cd "$S/.carta"
carta() { python -m carta_cli.main "$@"; }

carta make doc00 alpha >/dev/null          # 00-codex/05-alpha (append)
carta make -g group-x   >/dev/null         # top-level group, appended
carta tree

# strict --at into a free slot, and the occupied-slot error
carta make doc00 beta >/dev/null
carta move doc00.05 --at doc00.09          # strict, free -> lands at 09, no sibling shifts
carta move doc00.01 --at doc00.02 && echo "BUG: should error on occupied slot"

# displacing --insert
carta move doc00.09 --insert doc00.01      # bumps 01.. up by one

# Bug 3: promote a root group into slot 00
carta tree
carta move doc01 --insert doc00            # group-x -> 00, codex bumps to 01
carta tree

# index-slot guard: cannot displace a directory's 00-index
carta move doc00.02 --insert doc00.00 && echo "BUG: should refuse the 00-index slot"

carta regenerate && echo "regenerate OK"
```

## Out of Scope

- `carta copy` — it has the same `--order`; unifying it onto `--at`/`--insert` is a
  separate follow-up task.
- Any change to `make`, `delete`, `punch`, `flatten`, `rename`, `attach`.
- The stale `carta create` references in `04-create.yaml` / `04-create.md` (leftover from
  the make migration) — not this task's concern.
- A frontmatter validator / `carta check`.

## Notes

- **The displacing path is a pure rename, not new logic.** `--insert REF` == old
  `--order N` with `N = REF.segments[-1]` and the parent taken from the ref. If a reviewer
  sees behavior changes in the displacing/append/gap-close paths, something drifted.
- **`strict` only suppresses destination bumps.** Source-side gap-close (cross-dir) and
  bundle travel still apply under `--at`. The occupancy precheck in `cmd_move` is what makes
  skipping the bumps safe.
- **Same-dir `--at` may leave a gap** at the source's old slot — that is the strict
  contract (exact placement, minimal disturbance), matching `make --at`. Use append or
  `--insert` when you want contiguity. Most real `--at` use is cross-dir or root-targeted.
- **Reviewer watch-list:** (1) the `nargs="?"` destination + `--at`/`--insert` mutual
  exclusion — all combinations must error or resolve correctly; (2) `regenerate` runs
  exactly once; (3) `--dry-run` (especially with `--mkdir` in append mode) touches nothing;
  (4) the snapshot diff should be confined to move/help/`ai_skill` move blocks — scan it for
  unexpected churn elsewhere.
</content>
</invoke>
