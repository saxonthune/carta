# Wire DocRef — Task C: Pure Cutover

## Motivation

Tasks A and B made `DocRef`/`EntryName`/`DocEntry` the internal currency without
changing behavior. This task makes the **behavioral change**: a reference is a
coordinate, the input grammar is formalized, prose-scanning uses `DocRef.SCAN`,
and the grammar is documented as shipped.

This is the **third of three sequenced tasks** (A → B → C) and the only
**breaking** one. Expect `test_cli.ambr` snapshot churn (help text, error
messages) — re-record snapshots intentionally as part of the task.

## Decisions (resolved during triage — implement these, do not re-litigate)

- **Real paths stay.** The resolver accepts a `DocRef` form (`docXX.YY` |
  `dXX.YY` | `XX.YY`) **or** a real, existing filesystem path (relative to the
  workspace root) — so external scripts can pass paths. Both normalize to a
  `DocEntry` immediately.
- **Drop fuzzy/stem guessing as a resolution path.** A misspelled or
  stem-only/prefix-only path no longer silently resolves. Keep the
  `_fuzzy_match`-based "did you mean" suggestion, but only as an *error hint* on
  failure — never as a successful resolution.
- **No `type=DocRef.parse` on positionals.** Path→`DocRef` needs `carta_root`
  (a filesystem walk), which argparse `type=` cannot access. Conversion stays in
  the resolver, which returns a `DocEntry`.
- **rewrite normalizes through `DocRef`.** Both sides of each `old=new` mapping
  parse via `DocRef.parse` → canonical `str(DocRef)`, then prose is scanned and
  rewritten using `DocRef.SCAN` (canonical-only, so dates/versions are never
  matched).

## Do NOT

- Do NOT reintroduce fuzzy/stem matching as a resolution mechanism.
- Do NOT add `type=DocRef.parse` to argparse positionals.
- Do NOT merge `create` + `group` into `make` (separate task).
- Do NOT leave docs describing the old grammar — `ai_skill.py`, the bundled
  template, and the glossary must match shipped behavior.

## Plan

### 1. Restrict resolution in `carta_cli/entries.py`

- Resolve only: ref forms (via `DocRef.parse`) and real existing paths (via
  `DocRef.from_path`). Remove the fuzzy/stem/prefix-guessing *resolution* branch
  (`_match_path_segment` as a resolver). Retain a `_fuzzy_match`-style helper only
  to build the "did you mean" hint in `resolve_and_validate` failures.
- Ensure `DocRef.parse` rejects bad refs with a clear, single error path.

### 2. Add an error code for malformed refs

- `doc03.01.04` (Error Catalog) + the `errors.py` exception classes: add one
  `ERR-*` code for a malformed reference, mapped to `DocRef.parse`'s `CartaError`.
  Wire `DocRef.parse` (or the resolver) to raise the catalogued error.

### 3. Route prose scanning through `DocRef.SCAN`

- `carta_cli/rewriter.py` and the orphan-ref scan at `structure.py:125`: replace
  the inline `doc\d{2}(?:\.\d{2})*` patterns with `DocRef.SCAN`.
- `rewrite` command: parse each `old=new` via `DocRef.parse`, render canonical
  `str(DocRef)` for both sides, then substitute canonical occurrences in prose.

### 4. Update docs/spec and vendored copy to match shipped behavior

- `carta_cli/ai_skill.py` — reference text for refs/inputs reflects the three
  input forms + canonical output + the slug-is-not-load-bearing rule.
- `carta_cli/templates/03-conventions.md` — sync the seed conventions doc with the
  formal grammar (mirror the canonical/input split now in `.carta/` doc01.06).
- `.carta/04-product-strategy/03-glossary.md` — add a **slug** entry, and
  disambiguate it from **Title** (the numbered directory) and the **`title`**
  frontmatter field.
- `carta_cli/portable/` — propagate the grammar/resolver changes to the vendored
  copy so portable workspaces match the pip CLI.

### 5. Re-record snapshots

- Run the suite, review the `test_cli.ambr` diffs (help text, error strings),
  confirm each change is intended, and commit the re-recorded snapshots.

## Files to Modify

- `carta_cli/entries.py` — restrict resolution to ref + real path.
- `carta_cli/errors.py` + `.carta/.../05-actions`/`04-errors.md` (doc03.01.04) —
  malformed-ref error code.
- `carta_cli/rewriter.py` — use `DocRef.SCAN`.
- `carta_cli/commands/structure.py` — orphan scan via `DocRef.SCAN`.
- `carta_cli/commands/content.py` — `rewrite` normalizes `old=new` via `DocRef`.
- `carta_cli/ai_skill.py` — reference docs.
- `carta_cli/templates/03-conventions.md` — seed conventions sync.
- `.carta/04-product-strategy/03-glossary.md` — `slug` glossary entry.
- `carta_cli/portable/` — vendored sync.
- `tests/__snapshots__/test_cli.ambr` — re-recorded.

## Verification

```bash
make test
# fuzzy resolution is gone (only the error-hint helper may remain):
python3 -m carta_cli rewrite "d04.08=04.09" --dry-run   # canonicalizes both sides
# no inline ref grammar left outside docref.py:
! grep -rn "doc\\\\d{2}" carta_cli/rewriter.py carta_cli/commands/ && echo "prose scan via SCAN: ok"
```

## Out of Scope

- `carta make` (create+group merge).
- Any change to the `DocRef`/`EntryName`/`DocEntry` value objects beyond what the
  cutover requires (their grammar is settled in the module).

## Notes

- This is the snapshot-churning task; keep it last so A and B stay clean,
  reviewable, behavior-preserving merges.
- Verify the `templates/03-conventions.md` sync against the already-updated
  `.carta/` doc01.06 / doc01.03 so the seed scaffolding and the canonical docs do
  not diverge again.
- The init-template numbering inconsistency (`carta init` scaffolds `00-codex`
  while this workspace uses `01-codex`) is a separate issue — do not fix it here.
