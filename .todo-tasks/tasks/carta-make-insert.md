# `carta make --insert` — open a gap and renumber siblings

## Motivation

`carta make` places entries by **appending** or by writing into a **free** slot (`--at`, strict — errors if occupied). Neither can insert *between* existing siblings. `--insert REF` adds that mode: write the new entry at REF's coordinate and bump every sibling at prefix ≥ that up by one, rewriting their cross-references.

This is the inverse of `delete`'s gap-*closing*. It deliberately mutates existing docs and their refs, so it inherits the full ref-safety obligation that append/`--at` do not. The renumber + rewrite machinery already exists and is exercised by `cmd_delete` — `--insert` feeds it a "shift up / open a gap" move-set instead of delete's "shift down / close a gap."

## Do NOT

- **Do NOT change** the existing `make` addressing modes (append, root-by-omission, `--at`). `--insert` is purely additive.
- **Do NOT** make `--insert` displace into another directory. It only renumbers siblings **within the target's parent**.
- **Do NOT** reinvent the renumber/rewrite logic. Reuse `bundle_mod.list_bundles`, `compute_rename_map`, `rewrite_refs`, `collect_rewritable_files` exactly as `cmd_delete` does (in `carta_cli/commands/structure.py`).
- **Do NOT** allow `--insert` together with `--at` (mutually exclusive) or with a 2-element positional (`--insert` carries its position in the ref, like `--at`).
- **Do NOT** hand-edit `tests/__snapshots__/test_cli.ambr` — re-record with `--snapshot-update`.

## Plan

### 1. Parser (`carta_cli/commands/_parser.py`)

Add to `p_make`:
```
p_make.add_argument("--insert", default=None,
    help="Insert at REF (e.g. doc01.02.03), bumping that sibling and all higher ones up by one")
```
Update the `make` Examples epilog with an `--insert` example.

### 2. `cmd_make` (`carta_cli/commands/structure.py`)

Add an `--insert` addressing branch alongside the existing `--at` branch. Mirror the `--at` validation and ref-parsing, but instead of erroring on an occupied slot, open the slot.

- **Mutual exclusion (top of `cmd_make`, with the existing combination guards):**
  - `args.insert is not None and args.at is not None` → `CartaError("--insert and --at are mutually exclusive")`
  - `args.insert is not None and len(args.target) == 2` → `CartaError("--insert takes its position from the ref; do not also pass a parent")`
- **Resolve (when `args.insert` set):** require `len(args.target) == 1` → `slug = args.target[0]`. Parse `DocRef.parse(args.insert)`; `target_prefix = ref.segments[-1]`; parent from `ref.segments[:-1]` (resolve via `DocRef(...).to_path(carta_root)`, or `carta_root` when empty) — same as the `--at` branch. Set `prefix = target_prefix`. Validate `parent_path.is_dir()`.
- **Build the shift-up move-set** (mirror the `cmd_delete` gap-close loop, inverted):
  ```python
  bundles = bundle_mod.list_bundles(parent_path)
  shift_moves: list[tuple[Path, Path]] = []
  for bndl in bundles:
      if bndl.prefix == 0:        # never move 00-index
          continue
      if bndl.prefix < target_prefix:
          continue
      all_members = ([bndl.root] if bndl.root else []) + list(bndl.attachments)
      for member in all_members:
          tail = EntryName.parse(member.name).tail
          new_name = f"{bndl.prefix + 1:02d}-{tail}"
          shift_moves.append((member, parent_path / new_name))
  rename_map = compute_rename_map(shift_moves, carta_root)
  ```
  Target filenames are unique (distinct prefixes + tails), so apply order causes no path collisions; no special ordering required. Bundle attachments and directory bundles move with their host because `all_members` includes them — directory renames cascade nested coordinate rewrites through `rewrite_refs`, exactly as in delete.
- **`--dry-run`:** print the planned sibling shifts and the rename map (follow delete's dry-run formatting), plus what would be created at `target_prefix`; write nothing; return.
- **Apply (non-dry-run):** `shutil.move` each `shift_moves` entry, then `rewrite_refs(collect_rewritable_files(carta_root), rename_map)`. Then fall through to the **existing** shared doc/group writer (it writes at `prefix == target_prefix`, now free). Ensure regeneration happens **exactly once** after both the shift and the write (the shared writer already regenerates — do not double-regenerate).
- **Output:** the canonical ref of the new entry (as today) plus `Shifted: N sibling(s) renumbered`.

Refactor only as much as needed to reuse the shared writer after the shift — keep the diff focused.

### 3. `ai_skill.py`

Extend the `make` `_COMMAND_DOCS` entry: document `--insert REF` as the displacing counterpart to `--at` (which is strict/non-displacing). State plainly that it renumbers siblings and rewrites their refs.

### 4. Tests (`tests/test_cli.py`)

Add a `TestMakeInsert` class (model assertions on the delete gap-close property tests, ~lines 580-730, inverted):
- `test_insert_shifts_siblings` — insert at an occupied middle slot; assert the new entry lands there and every higher sibling moved up by one (no gaps, no collisions).
- `test_insert_rewrites_refs` — a surviving doc that referenced a shifted sibling now points at the new coordinate (no orphaned refs).
- `test_insert_preserves_bundle_attachments` — a shifted bundle keeps its attachments under the new prefix.
- `test_insert_at_root` — `--insert doc05 …` shifts top-level titles.
- `test_insert_dry_run` — prints the plan, mutates nothing.
- `test_insert_rejects_with_at` — `--insert X --at Y` errors; `--insert X parent slug` errors.
Re-record snapshots (Verification below).

### 5. Docs

`.carta/03-product-design/03-cli-user-flow.md`: add a one-line `carta make --insert doc01.02 …` example beside the existing make examples.

## Files to Modify

- `carta_cli/commands/_parser.py` — `--insert` arg + epilog example
- `carta_cli/commands/structure.py` — `--insert` branch in `cmd_make` (shift-up move-set, reuse delete's pipeline)
- `carta_cli/ai_skill.py` — document `--insert` in the `make` entry
- `tests/test_cli.py` — `TestMakeInsert`
- `tests/__snapshots__/test_cli.ambr` — re-record (do not hand-edit)
- `.carta/03-product-design/03-cli-user-flow.md` — insert example

## Verification

```bash
# Re-record the CLI snapshot after adding --insert, then run the full suite
make test || python -m pytest tests/test_cli.py --snapshot-update -q
make test

# Smoke-test the bump against a scratch workspace
cd "$(mktemp -d)" && carta init >/dev/null
carta make doc00 alpha >/dev/null      # 00-codex/05-alpha
carta make doc00 beta  >/dev/null      # 00-codex/06-beta
carta tree
carta make --insert doc00.05 wedge     # should land at 05 and bump alpha->06, beta->07
echo "--- after insert ---"
carta tree
carta make --insert doc00.05 dupe --dry-run   # prints plan, writes nothing
carta regenerate && echo "regenerate OK"
```

## Out of Scope

- Cross-directory insertion.
- Any change to append / `--at` semantics.
- A frontmatter validator / `carta check`.

## Notes

- **Test surface is the real cost**, not code volume — the shift mutates existing docs and their refs. Mirror delete's property assertions: refs preserved across the bump, no prefix collisions, MANIFEST consistent, bundles intact.
- Directory bundles: shifting a directory's prefix changes the coordinate of everything under it. `compute_rename_map` + full-file `rewrite_refs` already handle nested rewrites for delete; the same move-set shape produces the same nested rewrites here — confirm with `test_insert_rewrites_refs` against a doc inside a shifted subdirectory.
- Reviewer watch-list: regeneration must run exactly once; `--dry-run` must touch nothing even though it computes the move-set.
