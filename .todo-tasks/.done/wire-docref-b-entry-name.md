# Wire DocRef — Task B: Entry-Name Unit

## Motivation

The `NN-slug.ext` decomposition is re-matched with ad-hoc regexes in
`numbering.py`, `bundle.py`, and the slug-stripping in `structure.py`.
`carta_cli/docref.py` already defines `EntryName` as the single home for that
grammar. This task routes those call sites through `EntryName` and centralizes
slug validation.

This is the **second of three sequenced tasks** (A → B → C). Like Task A it is a
**behavior-preserving refactor** — same CLI inputs, same outputs, no
`test_cli.ambr` churn. It is independent of Task A's resolver changes but assumes
Task A has merged (so `EntryName`/`DocEntry` are present and stable).

## Do NOT

- Do NOT change CLI input/output behavior or error messages. No snapshot churn.
- Do NOT touch the resolver (`entries.py`) or `DocRef` (Task A's territory).
- Do NOT restrict input, add `type=`, or alter error codes (Task C).
- Do NOT touch `portable/`, `ai_skill.py`, `templates/`, or docs.
- Do NOT keep `get_numeric_prefix` / `get_slug` as wrappers "for safety" —
  backwards compatibility is not a concern (CLAUDE.md). Replace call sites.

## Plan

### 1. Collapse `carta_cli/numbering.py` into `EntryName`

- `get_numeric_prefix(name) -> int | None` becomes
  `EntryName.parse(name).prefix if EntryName.parse(name) else None` at call sites,
  or a one-line shim that delegates to `EntryName`. Prefer replacing call sites
  outright.
- `get_slug(name) -> str` → `EntryName.parse(name).slug` (note today's `get_slug`
  returns the full name when unprefixed; `EntryName.parse` returns `None` there —
  preserve the existing fallback at each call site).
- Keep `compute_insertion_prefix` (it is numbering logic, not name parsing).
- Update importers of `get_numeric_prefix`/`get_slug` across the codebase
  (e.g. `entries.list_numbered_entries`, `transform.py:318`, `structure.py`).

### 2. Route `carta_cli/bundle.py` regexes through `EntryName`

- Lines 31 (`^\d{2}-(.*?)\.md$`) and 118 (`^\d{2}-(.*?)\.[^.]+$`) reparse entry
  names. Replace with `EntryName.parse(...)`, using `prefix`/`slug`/`ext` and an
  `ext == ".md"` test to distinguish a bundle root from a sidecar.
- If a small predicate helps (`is_markdown` / `is_sidecar`), add it as a method on
  `EntryName` rather than re-deriving in `bundle.py`.

### 3. Centralize new-slug validation in `EntryName`

- `structure.py:29` (`create`) and `structure.py:388-389` (`rename`) both guard /
  strip an `NN-` prefix from a user-supplied slug. Replace with a single
  `EntryName`-based validator: a user slug must NOT carry an `NN-` prefix; reject
  it with the existing error text (do not change the message — Task C owns error
  semantics).
- Apply the same validator to `copy --rename` (`transform.py` copy path) so all
  new-slug inputs share one rule.

## Files to Modify

- `carta_cli/docref.py` — optionally add `is_markdown`/`is_sidecar` to `EntryName`.
- `carta_cli/numbering.py` — remove `get_numeric_prefix`/`get_slug` (keep
  `compute_insertion_prefix`).
- `carta_cli/bundle.py` — use `EntryName` for root/sidecar parsing.
- `carta_cli/entries.py` — update `list_numbered_entries` to use `EntryName`.
- `carta_cli/commands/structure.py` — slug validation via `EntryName`.
- `carta_cli/commands/transform.py` — `transform.py:318` slug parse + `copy --rename`.

## Verification

```bash
make test
# numbering's name-parsers are gone:
! grep -rn "get_numeric_prefix\|get_slug" carta_cli/ && echo "numbering parsers removed: ok"
# entry-name regexes no longer duplicated in bundle:
! grep -n "\\\\d{2}-" carta_cli/bundle.py && echo "bundle regexes routed via EntryName: ok"
# behavior-preserving:
git diff --quiet -- tests/__snapshots__/test_cli.ambr && echo "snapshots unchanged: ok"
```

## Out of Scope

- Resolver / `DocRef` plumbing — Task A.
- Pure cutover (argparse `type=`, input restriction, rewrite-via-SCAN, error
  catalog, docs, `portable/`) — Task C.

## Notes

- Watch the `get_slug` fallback: today it returns the raw name for an unprefixed
  entry; `EntryName.parse` returns `None`. Preserve behavior at each call site
  (`EntryName.parse(name).slug if ... else name`).
- `compute_insertion_prefix` stays — it is about choosing a number, not parsing a
  name.
