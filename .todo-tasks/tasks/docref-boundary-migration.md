# Carry DocRef through the interior; format refs only at the edges

## Motivation

`rhidoc/docref.py` owns the ref grammar, and the modules already parse
`DocRef`/`EntryName` internally — but they flatten refs straight back to strings
(`str(DocRef.from_path(...))`, `rename_map: dict[str, str]`), and `rewriter.py`
hand-builds the same word-boundary regex that `DocRef.SCAN` encodes. Keeping refs as
`DocRef` values through the interior makes malformed refs impossible past the boundary
and, with the pyrefly gate, makes the convention enforced rather than remembered.

Triage note: this phase is triaged against the `typed-command-args` Surface — typed
`<Verb>Args` dataclasses exist in every command module, dispatch is unchanged, and
`rewriter`/`planning`/`entries` signatures are exactly as they were before that phase.

## Do NOT

- Do NOT change accepted CLI input forms (`docXX.YY` / `dXX.YY` / `XX.YY`), the
  canonical output form, or any printed/JSON output — `--output-mapping` JSON keeps
  emitting canonical `docXX.YY` strings.
- Do NOT alter the two-pass placeholder rewrite algorithm in `rewriter.py` — only its
  types and where its regex comes from.
- Do NOT touch `MANIFEST.md` format, `mdtree.py`, or `mdlint.py`.
- Do NOT keep parallel str-and-DocRef code paths "for safety" — migrate each seam
  fully; the checker is the safety.
- Do NOT run `pip install -e .` from the worktree.

## Plan

### 1. One boundary-matcher definition in docref.py

Add a method on `DocRef` (e.g. `matcher(self) -> re.Pattern[str]`) that returns the
compiled word-boundary pattern for finding this exact ref in prose —
`(?<!\w)<escaped canonical form>(?!\.[a-zA-Z0-9])` — the same boundary rules `SCAN`
uses. This replaces the regex `rewriter.py` builds by hand (lines 59 and 105).

### 2. Type the rename map end to end

- `rewriter.rewrite_refs` and `rewriter.apply_rename_to_text` accept
  `dict[DocRef, DocRef]`; internally build patterns via the new `matcher()` and
  replacement text via `str(new_ref)`.
- `planning.py` (~lines 313-314) builds the map as `DocRef` pairs instead of
  `str(DocRef.from_path(...))` pairs.
- Update every caller of these functions (in `commands/structure.py`,
  `commands/transform.py`, `commands/content.py`, `regenerate_core.py` — locate with
  grep) to pass and receive `DocRef` maps; convert to strings only where the map is
  printed or serialized (`--output-mapping`).

### 3. Stop flattening at parse sites

Where code does `ref = str(DocRef.from_path(...))` or
`old = str(DocRef.parse(...))` (e.g. `commands/content.py` cmd_rewrite ~lines
172-176, `regenerate_core.py` lines 37/361/383, `planning.py`), keep the `DocRef`
value and apply `str()` only at the final display/write expression. Where a
variable's only use is immediate display, leaving it as-is is fine — the target is
interior flow, not cosmetic churn.

### 4. Remove duplicated ad-hoc ref regexes

Any local regex in the touched files that recognizes or bounds `docXX.YY` forms is
replaced by `DocRef.parse`, `DocRef.SCAN`, or the new `matcher()`.

## Files to Modify

- `rhidoc/docref.py` — `matcher()` method
- `rhidoc/rewriter.py` — typed signatures, shared matcher
- `rhidoc/planning.py` — DocRef rename-map pairs
- `rhidoc/commands/content.py`, `rhidoc/commands/structure.py`,
  `rhidoc/commands/transform.py`, `rhidoc/regenerate_core.py` — callers
- `tests/` — only where a test calls the retyped functions directly

## Verification

```bash
python3 -m pyrefly check
python3 -m pytest tests/ -v
```

## Out of Scope

- Changing resolution semantics in `entries.py` (`resolve_arg` keeps `str` in,
  `DocEntry` out — it IS the boundary).
- Strict-mode pyrefly settings.
- Any CLI surface change.

## Notes

- `DocRef` is a frozen dataclass over a tuple, so it is hashable and safe as a dict
  key as-is.
- Tests that construct rename maps with string literals (grep `tests/` for
  `rewrite_refs` / `apply_rename_to_text`) must switch to `DocRef.parse(...)` keys —
  that churn is expected and small.

## Surface after this phase

- `rewriter.rewrite_refs(files, rename_map: dict[DocRef, DocRef])` and
  `apply_rename_to_text(text, rename_map: dict[DocRef, DocRef])` are the only rewrite
  entry points; no str-keyed variant exists.
- `DocRef.matcher()` exists and is the single source of ref word-boundary rules
  besides `DocRef.SCAN`.
- All CLI behavior, output, and accepted input forms are byte-identical; pyrefly
  clean; full suite passes.
- Negative space: `entries.resolve_arg` / `resolve_and_validate` signatures unchanged.
