# Unify positional-write vocabulary on --at / --before

## Motivation

`carta make` and `carta move` already share a positional-write vocabulary: `--at REF`
(strict — write iff the slot is free, else error) and `--insert REF` (displacing — land
at REF's slot, bump that sibling and all higher ones up by one). This task completes the
unification across every positional-write command and settles the final flag name:

- Rename the displacing flag **`--insert` → `--before`** everywhere (make, move). `--before`
  is intent-aligned ("place this before that doc"), reads well across all commands, and frees
  the vocabulary from the mechanism-focused "insert".
- Convert **`carta copy`**: retire its int `--order N`; adopt `--at REF` / `--before REF`,
  mirroring `move`'s addressing (destination subsumed in the ref).
- Retype **`carta flatten`**'s `--at N` (int position) into `--before REF` (a doc ref),
  resolving the collision where `--at` meant a bare int on flatten but a ref everywhere else.

After this, the vocabulary is uniform:
- **append** — flag-less (positional destination)
- **`--at REF`** — strict placement; errors on an occupied slot
- **`--before REF`** — displacing placement; bumps the occupant and all higher siblings up

## Do NOT

- Do NOT keep `--insert` or `--order` as aliases or deprecated shims. Backwards compatibility
  is explicitly NOT a concern (see CLAUDE.md). Remove them completely — parser, code, docs, tests.
- Do NOT change any *behavior* of make/move beyond the flag rename. `--insert`→`--before` is a
  pure rename: same shift-up logic, same guards, same output, same error wording (only the flag
  token in messages changes from `--insert` to `--before`).
- Do NOT give `flatten` a strict `--at` mode. Flatten only splices (displacing). It gets
  `--before REF` only; there is no `--at` on flatten anymore.
- Do NOT add a positional destination requirement to copy's `--at`/`--before` paths — the
  destination directory comes FROM the ref (Flavor A), exactly like move.
- Do NOT touch `delete`, `punch`, `rename`, `attach`, `rewrite` — they have no positional-write
  flag to unify.
- Do NOT hand-edit the `.ambr` snapshot file. Regenerate it with `--snapshot-update`.

## Plan

### 1. Rename `--insert` → `--before` on make and move

**`carta_cli/commands/_parser.py`:**
- make block: rename the `p_make.add_argument("--insert", ...)` (line ~61) to `"--before"`;
  update its help text and the epilog example (`carta make --insert doc00.03 new-doc` →
  `carta make --before doc00.03 new-doc`).
- move block: rename `p_move.add_argument("--insert", ...)` (line ~90) to `"--before"`; update
  the two epilog examples (lines ~80-81) and the `destination` help text (line ~87,
  "Omit when using --at/--insert" → "--at/--before").

**`carta_cli/commands/structure.py`:**
- `cmd_make` (lines ~26-214): replace every `args.insert` with `args.before`; rename the local
  `insert_ref` → `before_ref`; update error strings (`"--insert and --at are mutually exclusive"`
  → `"--before and --at are mutually exclusive"`, `"--insert takes its position from the ref..."`,
  `"--insert requires exactly one positional argument (SLUG)"`, `"Invalid --insert ref"`,
  `"Error resolving parent from --insert ref"`, the `if args.insert is not None and shift_moves:`
  branch at line ~214). The argparse dest for `--before` is `args.before`.
- `cmd_move` (lines ~426-502): replace every `args.insert` with `args.before`; update the guard
  error strings at lines ~429-434 (`"--at and --insert are mutually exclusive"` →
  `"--at and --before are mutually exclusive"`, `"--at/--insert takes its destination from the
  ref..."` → `"--at/--before ..."`, `"provide a destination (append), or use --at/--insert"` →
  `"...use --at/--before"`), and the `ref_str = args.at if args.at is not None else args.insert`
  line (~451) → `args.before`.

### 2. Convert `carta copy` to `--at REF` / `--before REF`

**`carta_cli/commands/_parser.py`** (copy block, lines ~114-120):
- Make `destination` optional: `p_copy.add_argument("destination", nargs="?", default=None,
  help="Target directory (append mode). Omit when using --at/--before.")`.
- Remove `p_copy.add_argument("--order", ...)`.
- Add `p_copy.add_argument("--at", default=None, help="Exact target ref (docXX.YY.ZZ | dXX.YY |
  XX.YY); copies iff the slot is free, else error")` and
  `p_copy.add_argument("--before", default=None, help="Insert at REF, bumping that sibling and
  all higher ones up by one")`.
- Keep `--rename` (dest `rename_slug`) and `--dry-run`.
- Add a copy epilog with examples mirroring move (append / `--at` / `--before`), and set
  `formatter_class=argparse.RawDescriptionHelpFormatter`.

**`carta_cli/commands/transform.py`** — rewrite `cmd_copy` (lines ~310-353). Use `cmd_make`'s
`--insert`/`--at` blocks (now `--before`/`--at`) in `structure.py` as the reference for ref
resolution and the shift-up move-set. Structure:

1. Resolve `source_path = Path(args.source).resolve()` (external file — unchanged).
2. Guards (mirror move's combination guards):
   - `args.at` and `args.before` mutually exclusive.
   - `--at`/`--before` mutually exclusive with a positional `destination`.
   - require one of: positional `destination` (append), `--at`, or `--before`.
3. Determine `dest_path` (a directory) and `target_prefix`:
   - **append** (positional destination): `dest_path = resolve_and_validate(args.destination,
     carta_root).path`; must be a dir; `entries = list_numbered_entries(dest_path)`;
     `target_prefix = compute_insertion_prefix(entries, None)`.
   - **`--at` / `--before`**: parse the ref via `DocRef.parse`; `target_prefix = ref.segments[-1]`;
     `parent_segments = ref.segments[:-1]`; resolve `dest_path` from the parent ref (or
     `carta_root` when there are no parent segments), exactly as `cmd_make` does; must be a dir.
4. Index-slot guard (mirror the move task's guard): if `target_prefix == 0` and
   `(dest_path / "00-index.md").exists()`, raise a CartaError — slot 0 is reserved for the index.
5. Strict vs displacing:
   - **append or `--at`**: keep the existing occupancy check — if `target_prefix` is occupied,
     raise the existing "position NN is occupied" error. (Append never collides; `--at` is strict.)
   - **`--before`**: build the shift-up move-set over `dest_path`'s bundles at prefix
     `>= target_prefix` (copy `cmd_make`'s `shift_moves` construction verbatim), compute the
     rename map via `compute_rename_map`, and — outside dry-run — apply the moves in reverse
     prefix order and `rewrite_refs(collect_rewritable_files(carta_root), rename_map)` BEFORE
     copying the new file in. Do NOT run the occupancy check in the `--before` path.
6. Compute `rename_slug` (unchanged: `args.rename_slug` or the source stem's tail).
7. `new_name = f"{target_prefix:02d}-{rename_slug}{ext}"`; `shutil.copy2` the source in.
8. Dry-run: print the planned copy, the position, the slug, and (for `--before`) the shift plan
   and rename map, mirroring make's dry-run output. No files modified.
9. Regenerate (`do_regenerate`) and print the result, including the rename map for `--before`.

### 3. Retype `carta flatten --at N` → `--before REF`

**`carta_cli/commands/_parser.py`** (flatten block, line ~111):
- Replace `p_flatten.add_argument("--at", dest="at_position", type=int, default=None)` with
  `p_flatten.add_argument("--before", default=None, help="Insert hoisted children before REF
  (a doc ref) in the parent. Default: the dissolved directory's old position.")`.

**`carta_cli/commands/transform.py`** (`cmd_flatten`, line ~178):
- Replace `insertion_start = args.at_position` with logic that, when `args.before` is provided,
  parses it via `DocRef.parse` and takes `insertion_start = before_ref.segments[-1]`; when
  omitted, `insertion_start = source_prefix` (unchanged default). The rest of cmd_flatten is
  unchanged — it already works in terms of `insertion_start` as an int position in the parent.

### 4. Update ai-skill documentation

**`carta_cli/ai_skill.py`** — update the embedded command docs to the new vocabulary:
- make doc (lines ~62-103): `--insert` → `--before` throughout (synopsis, numbered modes,
  renumber note, flag table, dry-run note, gotchas).
- move doc (lines ~139-180): `--insert` → `--before` throughout.
- copy doc (lines ~291-304): replace the `--order N` synopsis and flag with the new
  `[--at REF | --before REF]` addressing; document append / strict / displacing like move.
- flatten doc (lines ~228, ~245): `--at N` → `--before REF`; update the description.
- line ~580: the "Position 0 is reserved: `--order` must be >= 1" bullet — reword to the
  index-slot rule (slot 0 reserved when a 00-index.md occupies it), consistent with make/move.

### 5. Update tests

**`tests/test_cli.py`** — migrate every `--insert` to `--before` and every copy `--order` to the
new flags. Known sites (verify by grep, don't trust the list):
- move `--insert` calls: lines ~634, ~663, ~726, ~1486, ~1498, ~1514, ~1526, ~1532, ~1536,
  ~2008, ~2037, ~2129.
- make `--insert` calls: the `TestMakeInsert` class (~2683+), lines ~2742, ~2771, and the
  class docstring/comments.
- Any test class docstrings naming `--insert` (e.g. "Tests for carta move --at / --insert
  vocabulary", "Test carta make --insert").
- copy tests using `--order`: grep `"order"` and any copy-occupancy tests; convert to `--at`
  (strict, still errors on occupied) and add at least one `--before` (displacing) copy test that
  asserts siblings bump up and refs rewrite.
- Add: a `flatten --before REF` test asserting children splice at the ref's position (and confirm
  the default-position flatten test still passes with `--before` omitted).

### 6. Update .carta docs

- `.carta/03-product-design/03-cli-user-flow.md` — any `--insert`/`--order`/`flatten --at N`
  examples → new flags.
- `.carta/03-product-design/01-workspace-scripts/05-actions/02-move.yaml` — `--insert` → `--before`.
- `.carta/03-product-design/01-workspace-scripts/05-actions/07-copy.yaml` — the copy CLI string
  `--order N` → `--at REF | --before REF`.
- `.carta/03-product-design/01-workspace-scripts/05-actions/05-flatten.yaml` — `--at N` → `--before REF`.
- Check `04-create.yaml`/`04-create.md` only if they reference these flags; otherwise leave them
  (their stale `carta create` residue is a separate concern, out of scope here).
- After doc edits, run `carta regenerate` if any MANIFEST-affecting fields changed (these are
  body/example edits, so likely not needed — but run it if the action yaml summaries change).

## Files to Modify

- `carta_cli/commands/_parser.py` — rename `--insert`→`--before` (make, move); copy `--order`→
  `--at`/`--before` + optional destination; flatten `--at N`→`--before REF`.
- `carta_cli/commands/structure.py` — `args.insert`→`args.before` in cmd_make and cmd_move.
- `carta_cli/commands/transform.py` — rewrite cmd_copy (add `--at`/`--before`, displacing logic);
  cmd_flatten (`at_position`→`--before` ref).
- `carta_cli/ai_skill.py` — make/move/copy/flatten command docs + position-0 bullet.
- `tests/test_cli.py` — migrate `--insert`→`--before`, copy `--order`→`--at`/`--before`, add
  copy `--before` and flatten `--before` tests.
- `tests/__snapshots__/test_cli.ambr` — regenerate.
- `.carta/03-product-design/03-cli-user-flow.md` and the move/copy/flatten action yaml files.

## Verification

```bash
make test
# No leftover old flags anywhere in source, docs, or tests:
! grep -rn "\-\-insert\b" carta_cli/ tests/ .carta/
! grep -rn "\-\-order\b" carta_cli/ tests/ .carta/
! grep -rn "at_position" carta_cli/
# New vocabulary is present and wired:
export PYTHONPATH="$PWD"
python -m carta_cli.main make --help | grep -q "\-\-before"
python -m carta_cli.main copy --help | grep -q "\-\-before"
python -m carta_cli.main move --help | grep -q "\-\-before"
python -m carta_cli.main flatten --help | grep -q "\-\-before"
```

## Out of Scope

- `delete`, `punch`, `rename`, `attach`, `rewrite` — no positional-write flag.
- The stale `carta create` residue in `04-create.yaml`/`04-create.md` (leftover from the make
  migration) — a separate cleanup task.
- Adding a `--after REF` flag — additive future work; not needed now (append covers end-insertion).

## Notes

- `make`'s `--insert` block in `structure.py:40-112` is the canonical reference for both the ref
  resolution (parent segments + last-segment prefix) and the shift-up move-set. copy's `--before`
  path should be a close transcription of it, differing only in using `shutil.copy2` of an
  external source instead of placing a new authored file.
- The index-slot guard (`target_prefix == 0 && 00-index.md exists → error`) must appear in copy's
  path too, matching make/move — otherwise copy could clobber an index.
- Watch the `--before` ordering: shift siblings up and rewrite refs FIRST, then place the new
  file, so the target slot is free when the copy lands.
- Run the CLI from source via `export PYTHONPATH="$PWD"; python -m carta_cli.main ...` — the
  installed `carta` binary fails with `ModuleNotFoundError` in this repo layout.
