# Unify `carta create` + `carta group` into `carta make`

## Motivation

`carta create` and `carta group` are two spellings of one idea — place a new numbered entry in the workspace. They diverge artificially: `create` takes a **parent** + slug and computes the child `NN`; `group` makes you pre-number the full target path yourself. Collapse both onto the cleaner create-model (give the parent, the CLI picks the number) under a single `carta make` command, where `-g/--group` flips the result from a leaf `.md` to a directory + `00-index.md`.

This also makes `make` a **pure structural command**: it does numbering and placement, full stop. All frontmatter is content the agent authors in the same pass where it writes the body (see Do NOT). Backwards compatibility is not a concern (CLAUDE.md) — remove `create`/`group` completely.

## Do NOT

- **Do NOT keep `create` or `group`** as aliases or deprecated paths. Remove them entirely — command names, dispatch entries, `known_subcommands`, parser blocks, `ai_skill` docs, and tests.
- **Do NOT add frontmatter flags** (`--title`, `--summary`, `--tags`, `--deps`) to `make`. This was decided deliberately: `regenerate` reads every frontmatter field with a fallback (`fm.get("title", dir_name)`, `fm.get("summary", "")`), so none are load-bearing at creation time. `make` writes a schema-valid skeleton; the agent authors real frontmatter in the same write where it writes the body. Do NOT add a `--meta key=value` arbitrary-frontmatter escape hatch — it breaks the closed frontmatter schema that MANIFEST depends on.
- **Do NOT implement insert-and-renumber** (shifting existing siblings to open a gap). `--at` is strict: write iff the slot is free, else error. The bump operation is a separate follow-up task (`carta-make-insert.md`).
- **Do NOT touch `move`, `delete`, `punch`, `flatten`, `rename`, `copy`, `attach`.**
- **Do NOT hand-edit `tests/__snapshots__/test_cli.ambr`** — re-record it with the syrupy `--snapshot-update` flag.

## Plan

### 1. Replace `cmd_create` with `cmd_make` in `carta_cli/commands/structure.py`

Rename/rewrite `cmd_create` (lines ~25-85) to `cmd_make`. It handles both the doc case and (when `args.group`) the group case — `cmd_group` folds in here. Signature: `cmd_make(args, carta_root)`.

**Argument resolution (three addressing modes):**
- The positional capture is a list (`args.target`, see step 3). Resolve it together with `--at`:
  - If `args.at` is set: require `len(args.target) == 1` → `slug = args.target[0]`. Parse `args.at` via `DocRef.parse`. The **last** segment is the desired prefix; the parent is `DocRef(segments=at.segments[:-1])`. Resolve the parent to a directory (`carta_root` itself when the parent coordinate is empty). The prefix **must be free** — error (`CartaError`) if occupied, listing occupied positions.
  - Else if `len(args.target) == 1`: `slug = args.target[0]`, parent = `carta_root` (root / top-level title), append.
  - Else if `len(args.target) == 2`: parent = resolve `args.target[0]` via `resolve_arg(...).path`, `slug = args.target[1]`, append.
  - Else: `CartaError` ("too many positional arguments; usage: carta make [PARENT] SLUG").
  - If `args.at` is set **and** `len(args.target) == 2`: `CartaError` ("--at takes its position from the ref; do not also pass a parent").
- Slug guard (keep from create): reject a slug that already carries an `NN-` prefix — the current code does this with `if EntryName.parse(slug) is not None: raise CartaError(...)`. Keep that idiom and message.
- Append prefix: reuse `compute_insertion_prefix(list_numbered_entries(parent), None)`. For `--at`, the prefix comes from the ref; verify it is not in the occupied set, built the way the current code builds it: `{EntryName.parse(e.name).prefix for e in list_numbered_entries(parent) if EntryName.parse(e.name)}`.

**Skeleton written (both doc and group):** title derived from slug (`slug.replace("-", " ").title()`), `summary: ""`, `tags: []`, `deps: []`, body `\n# {title}\n`. No flag overrides — the derivation is the only source.

**Doc case (default):** write `{prefix:02d}-{slug}.md` into the parent dir via `write_frontmatter`.

**Group case (`-g/--group`):** create directory `{prefix:02d}-{slug}/` in the parent, then write its `00-index.md` with the same skeleton. Preserve `cmd_group`'s guards that still apply: if the computed directory already exists and is non-empty → `CartaError`; if it exists but is empty → proceed (write the index). (The old "must have NN- prefix" guard is obsolete — `make` computes the prefix.)

**`--dry-run`:** print what would be created (path, position, doc-vs-group), write nothing, return.

**`--no-regen`:** skip the `do_regenerate` call (unify both old flags onto `make`).

**Output:** after writing (and regen), print the **canonical ref** of the new entry plus its workspace-relative path. Compute the ref with `DocRef.from_path(new_path, carta_root)` (for groups, pass the directory path). Example: `Created: doc01.02.03.04  (03-product-design/.../04-architecture-guidelines.md)`.

### 2. Remove `cmd_group` from `carta_cli/commands/transform.py`

Delete `cmd_group`. Remove any imports left unused by its deletion **only if** nothing else in the file uses them — check first. (Note: `numbering.py` now exports only `compute_insertion_prefix`; name decomposition goes through `EntryName.parse(...).prefix` / `.slug` / `.tail` from `..docref`. Do not reintroduce `get_numeric_prefix`/`get_slug` — they were removed.)

### 3. Rewrite the parser in `carta_cli/commands/_parser.py`

- Remove `p_create` (lines ~42-60) and `p_group` (lines ~123-138). Add `p_make`:
  ```
  p_make = subparsers.add_parser("make", help="Create a doc or group at a position")
  p_make.add_argument("target", nargs="+", help="[PARENT] SLUG — omit PARENT for a top-level title")
  p_make.add_argument("-g", "--group", action="store_true", help="Create a directory + 00-index.md instead of a leaf .md")
  p_make.add_argument("--at", default=None, help="Exact target ref (e.g. doc01.02.03.04); writes iff the slot is free")
  p_make.add_argument("--dry-run", action="store_true")
  p_make.add_argument("--no-regen", action="store_true")
  ```
  Give `p_make` an Examples epilog mirroring the other commands (there are help-has-examples tests).
- In `known_subcommands` (line ~203): remove `"create"`, `"group"`; add `"make"`.
- In the `dispatch` dict (line ~269): remove `"create"`/`"group"` entries; add `"make": cmd_make`. Update the import so `cmd_make` is imported from `.structure` (and drop the `cmd_group` import from `.transform`).
- Remove the `--slug` special-case hint block (lines ~219-229) — it referenced `carta create`. Replace with the equivalent hint for `make` only if cheap; otherwise delete it (the positional usage is self-documenting via the help epilog).

### 4. Update `carta_cli/ai_skill.py`

In `_COMMAND_DOCS`, remove the `"create"` (line ~56) and `"group"` (line ~280) entries. Add a `"make"` entry documenting the unified command: the three addressing modes (root by omission, parent + slug, `--at`), the `-g` flag, `--dry-run`, `--no-regen`, the "no frontmatter flags — author content in the file" note, and the canonical-ref output. State plainly that it does NOT renumber siblings (append or strict `--at` only).

### 5. Migrate tests in `tests/test_cli.py`

- `TestCreate` (class ~line 1266): rename to `TestMake`; convert each `_run_carta(..., "create", "doc00", ...)` to `"make", "doc00", ...`. The `--order N` cases become `--at` cases: `test_create_at_free_position` → use `--at doc00.NN`; `test_create_at_occupied_position_errors` → `--at doc00.01`. Drop `test_create_with_title` and `test_create_with_frontmatter_flags` (flags removed); replace with a `test_make_writes_skeleton_frontmatter` asserting the slug-derived title + empty summary/tags/deps. Replace `test_create_slug_as_flag_shows_hint` per the parser decision in step 3 (keep a `make`-targeted hint, or delete the test if the hint is removed). Update `test_create_help_has_examples` → `make`. Add a `test_make_at_root` (single positional → top-level entry) and a `test_make_outputs_canonical_ref`.
- `TestGroup` (class ~line 1487): rename to use `make -g`. `test_group_creates_directory` → `make -g 05 test-group` (parent = root, append). The pre-numbering tests (`test_group_errors_without_prefix`) are obsolete — remove. Keep the empty/non-empty-existing-dir behavior tests, adapted to the computed path. Keep `test_group_rejects_workspace_prefix` (path-resolution hint still applies). Update `test_group_help_has_examples`.
- The post-unification test (~line 1761, `test_create_works`) → assert `carta make` works.
- Re-record the snapshot: `make test` will fail on the `.ambr` diff; re-run with snapshot update (below).

### 6. Update docs

- **doc03.03** (`.carta/03-product-design/03-cli-user-flow.md`): the "Add a new doc" example (line ~98) `carta create 01-product my-feature --title "My Feature"` → `carta make 01-product my-feature`. Add a group example: `carta make -g 05 architecture` and an `--at` example. Update the portable example (line ~32) `python3 .carta/carta.py create 00-codex my-doc` → `make`.
- **doc04.06.01** (`.carta/04-product-strategy/06-products/01-cli-scripts.md`): update any `create`/`group` command references to `make`.
- Run `carta regenerate` after doc edits if any frontmatter changed (it didn't, so MANIFEST is unaffected — but run it to be safe).

## Files to Modify

- `carta_cli/commands/structure.py` — `cmd_create` → `cmd_make` (folds group, three addressing modes, ref output)
- `carta_cli/commands/transform.py` — remove `cmd_group`
- `carta_cli/commands/_parser.py` — replace `p_create`/`p_group` with `p_make`; dispatch, `known_subcommands`, imports, `--slug` hint
- `carta_cli/ai_skill.py` — replace `create`+`group` `_COMMAND_DOCS` entries with `make`
- `tests/test_cli.py` — migrate `TestCreate`/`TestGroup`/unification test to `make`
- `tests/__snapshots__/test_cli.ambr` — re-record (do not hand-edit)
- `.carta/03-product-design/03-cli-user-flow.md` — command examples
- `.carta/04-product-strategy/06-products/01-cli-scripts.md` — command references

## Verification

```bash
# Re-record the CLI snapshot after the rename, then run the full suite
make test || python -m pytest tests/test_cli.py --snapshot-update -q
make test

# Smoke-test the three addressing modes against a scratch workspace
cd "$(mktemp -d)" && carta init >/dev/null
carta make doc00 scratch-doc                 # parent + slug, append
carta make -g scratch-title                   # single positional + -g => top-level group, append
carta make -g doc00 scratch-subgroup          # parent + slug, group child, append
carta make --at doc00.09 pinned-doc           # strict slot
carta make --at doc00.09 dupe && echo "BUG: should have errored on occupied slot"
carta tree
carta regenerate && echo "regenerate OK"
```

## Out of Scope

- Insert-and-renumber (`--insert`) — see `carta-make-insert.md`.
- A frontmatter validator / `carta check` command.
- Any change to `move`/`delete`/`punch`/`flatten`/`rename`.

## Notes

- `compute_insertion_prefix(entries, None)` already gives append semantics (max+1, or 1 when empty). For `--at`, derive the prefix from the ref's last segment and check it against the occupied set directly — do not route it through `compute_insertion_prefix`.
- `DocRef.parse` accepts `doc01.02 | d01.02 | 01.02`; the positional parent also accepts real paths via `resolve_arg` (interop) — both normalize to a path. `--at` should go through `DocRef.parse` (it's always a coordinate, never a path).
- `DocRef.from_path(new_path, carta_root)` gives the canonical ref for output; it raises `ValueError` on a path with no numeric prefix — won't happen for a freshly-made `NN-slug` entry, but guard if you reuse it for `--dry-run`.
- Reviewer watch-list: the `nargs="+"` + `--at` mutual-exclusion logic is the subtle part; make sure all four positional/`--at` combinations error or resolve correctly. The snapshot re-record should be a pure rename diff (create/group → make) — scan it to confirm no unexpected churn.
