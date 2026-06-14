# Wire DocRef — Task A: Resolution Core

## Motivation

`carta_cli/docref.py` defines `DocRef` and `EntryName` as a standalone, unimported
foundation. This task makes `DocRef` the internal currency for reference
resolution and **deletes the duplicated ref grammar in `ref_convert.py`**.

This is the **first of three sequenced tasks** (A → B → C). Task A is a
**behavior-preserving refactor**: the CLI accepts exactly the same inputs and
prints exactly the same output as before. Only the internals change — resolution
runs on `DocRef`/`DocEntry`, and `ref_convert.py` is gone. The `test_cli.ambr`
snapshots MUST NOT change. (Input restrictions and the Pure cutover happen in
Task C; the entry-name unit is Task B.)

## Do NOT

- Do NOT change any CLI input behavior. Refs, literal paths, and the existing
  fuzzy/stem matching must all still resolve exactly as today. No snapshot churn.
- Do NOT touch `numbering.py` or `bundle.py` (Task B).
- Do NOT add `type=` to `_parser.py`, restrict path input, or change error
  messages/exit codes (Task C).
- Do NOT touch `carta_cli/portable/`, `ai_skill.py`, `templates/`, or docs.
- Do NOT remove the "did you mean" suggestion behavior in `resolve_and_validate`.

## Plan

### 1. Add `DocEntry` to `carta_cli/docref.py`

```python
@dataclass(frozen=True)
class DocEntry:
    ref: DocRef        # logical address
    path: Path         # physical location

    @property
    def slug(self) -> str:
        return EntryName.parse(self.path.name).slug
```

`EntryName` already exists in this module. `DocEntry` binds a coordinate to its
resolved filesystem location; `slug` is derived, never stored.

### 2. Rewrite `carta_cli/entries.py` to return `DocEntry`

- `resolve_arg(arg, carta_root) -> DocEntry` and
  `resolve_and_validate(arg, carta_root, *, must_exist=True) -> DocEntry`.
- Internally: for ref-shaped input use `DocRef.parse(arg).to_path(carta_root)`;
  for literal/fuzzy path input resolve the path as today, then derive the ref via
  `DocRef.from_path(path, carta_root)`. Construct and return `DocEntry(ref, path)`.
- Preserve the literal-path branch and the fuzzy `_fuzzy_match` /
  `_match_path_segment` resolution **unchanged** (Task C trims them, not A).
- Delete the module-level `_REF_RE`; use `DocRef.parse` / a `DocRef`-based check
  for the ref-shaped branch instead.
- For `must_exist=False` targets whose path is not yet on disk: still return a
  `DocEntry`; derive `ref` from the path's numbered components via
  `DocRef.from_path` when possible. If components are not all `NN-` prefixed
  (a brand-new unnumbered name), see Notes.

### 3. Replace `ref_to_path` / `path_to_ref` call sites, then delete `ref_convert.py`

Swap every importer to the `DocRef` methods and canonical `str(DocRef)`:
- `carta_cli/regenerate_core.py:37` — `path_to_ref(item, root)` → `str(DocRef.from_path(item, root))`.
- `carta_cli/planning.py:289-290` — same swap for `old_ref`/`new_ref`.
- `carta_cli/commands/content.py:63,112,257,354,370` — `path_to_ref(...)` → `str(DocRef.from_path(...))`. Where the path came from `resolve_and_validate`, prefer the entry's `.ref` (e.g. line 257 `host` is now a `DocEntry`: use `str(host.ref)`).
- `carta_cli/commands/structure.py:95,101` — `path_to_ref(...)` → `str(DocRef.from_path(...))`.
- Delete `carta_cli/ref_convert.py` once no importers remain.

### 4. Update the 16 `resolve_arg` / `resolve_and_validate` call sites

Each call site currently treats the result as a `Path`. Update to use
`.path` (and `.ref` where it previously recomputed via `path_to_ref`):
- `content.py:26,127,208,285,340`
- `structure.py:36,154,301,312,381`
- `transform.py:26,161,310,357`
- `entries.py:86` (internal, inside `resolve_and_validate`)

## Files to Modify

- `carta_cli/docref.py` — add `DocEntry`.
- `carta_cli/entries.py` — resolvers return `DocEntry`; drop `_REF_RE`.
- `carta_cli/ref_convert.py` — **delete**.
- `carta_cli/regenerate_core.py` — `path_to_ref` → `DocRef.from_path`/`str`.
- `carta_cli/planning.py` — same.
- `carta_cli/commands/content.py` — call-site updates (`.path`/`.ref`, ref build).
- `carta_cli/commands/structure.py` — call-site updates.
- `carta_cli/commands/transform.py` — call-site updates.

## Verification

```bash
make test
# ref_convert.py is gone and nothing imports it:
test ! -f carta_cli/ref_convert.py && echo "ref_convert deleted: ok"
! grep -rn "ref_convert\|ref_to_path\|path_to_ref\|_REF_RE" carta_cli/ && echo "no stale refs: ok"
# snapshots unchanged (behavior-preserving):
git diff --quiet -- tests/__snapshots__/test_cli.ambr && echo "snapshots unchanged: ok"
```

## Out of Scope

- Entry-name unit (`numbering.py`, `bundle.py`) — Task B.
- Pure cutover: argparse `type=`, dropping fuzzy/path input, rewrite-via-SCAN,
  error catalog, `ai_skill.py`, `templates/`, `portable/`, docs — Task C.

## Notes

- This is at the upper bound of one session (~8 files) but cohesive: it is one
  mechanical swap (Path→DocEntry, ref_convert→DocRef) with no behavior change.
- `must_exist=False` + unnumbered new name: if `DocRef.from_path` cannot derive a
  coordinate (no `NN-` prefix on a brand-new target), document the chosen
  behavior in a comment. Do not invent new error text (Task C owns error
  semantics). Simplest: carry the `path`, leave ref derivation best-effort, and
  let the create/move logic continue to use `.path` as it does today.
- The payoff to watch for: several `path_to_ref(resolve_*(...))` pairs collapse to
  `entry.ref` — take those simplifications where they appear.
