# Regenerate / MANIFEST — Attachments Column + Orphan Warnings

## Motivation

MANIFEST.md is Carta's machine-readable index. With bundles now first-class (tasks 01–04), MANIFEST must advertise attachments so AI agents can discover sidecar artifacts from the manifest alone, and `regenerate` must warn about orphans (attachments whose root is missing or whose prefix corresponds to a subdirectory). See `sidecars.epic.md`.

**Requires**: task 01 (`sidecars-01-bundle-resolver`). Independent of tasks 02–04, but benefits from those landing first (so real bundles exist when this runs).

## Do NOT

- Do NOT parse attachment contents. The attachment column is pure filesystem metadata (filename and optionally filesize).
- Do NOT add a `kind` column. No kind concept in v0.2.0.
- Do NOT fail regeneration on orphans; emit warnings to stderr and continue. Regeneration must stay idempotent and non-destructive.
- Do NOT store orphans separately in MANIFEST.md. Orphans show up in a regeneration warnings section (stderr print) and optionally as a plain-text "Orphans" list at the bottom of MANIFEST; pick one (recommend stderr-only for v0.2.0 — keep MANIFEST clean).
- Do NOT change the existing MANIFEST table columns or their ordering.

## Plan

### 1. Locate MANIFEST generation

Logic lives in `carta_cli/regenerate_core.py` (and a preamble lives in `carta_cli/manifest-preamble.md`). The generator walks the workspace, reads frontmatter, and emits a table per title section with columns: Ref, File, Summary, Tags, Deps, Refs.

### 2. Add an "Attachments" column

Extend the table-rendering step in `regenerate_core.py` to:
- For each doc row, call `bundle.find_bundle(doc_path)`.
- Render attachments as a compact cell: comma-separated basenames (e.g. `xstate.json, mockup.png`). Truncate the prefix: `01-game.xstate.json` becomes `xstate.json` for readability (slug segment + extension, no prefix).
- If no attachments: render `—` (matching existing empty-cell convention).
- If the doc *is* an `00-index.md` and the group (directory) it heads has any attachments at `00-` prefix inside, include those too — they're attachments of the index.

Update the column definitions section in `MANIFEST.md`'s preamble (`manifest-preamble.md`) to describe the new column.

### 3. Orphan detection + warnings

At the end of regeneration:
- Walk every directory in the workspace via `bundle.list_bundles` and collect all `is_orphan=True` bundles via `bundle.detect_orphans`.
- If any exist, print a warning block to stderr:
  ```
  Warning: 3 orphaned attachment(s) found:
    .carta/01-.../03-leftover.json  (no root NN-<slug>.md at prefix 03-)
    .carta/02-.../05-stale.yaml     (prefix 05- is a subdirectory; directories cannot own attachments)
    ...
  ```
- Never raise. Regeneration continues and writes MANIFEST.md normally.

### 4. Consider: orphan-awareness in `delete`

Task 02's `cmd_delete` doesn't emit orphan warnings. It could — but `regenerate` runs at the end of every delete anyway, so orphans surface there. Decision: leave `delete` alone; let `regenerate`'s warning be the single source.

### 5. Column Definitions in preamble

Update `carta_cli/manifest-preamble.md` to add:

```
- **Attachments**: Non-md files sharing the doc's numeric prefix. Sidecar artifacts that travel with the doc during structural operations. Purely filesystem-derived; not a frontmatter field.
```

### 6. Tests: extend `tests/test_regenerate.py`

Add cases:
- MANIFEST includes an Attachments column in the header row.
- A doc with no attachments renders `—`.
- A doc with one attachment renders its slug+ext (`xstate.json`).
- A doc with multiple attachments renders a comma-separated list, sorted alphabetically.
- An `00-index.md` whose directory has a sibling `00-foo.json` attachment renders `foo.json` in the attachments cell.
- Orphan detection: a directory with `03-foo.json` and no `03-*.md` → warning printed to stderr; MANIFEST still written; MANIFEST does *not* include the orphan in any row.
- Orphan detection: a directory with `03-bar/` subdir and `03-baz.yaml` alongside → warning printed about the yaml; the subdir is not flagged.

### 7. Regenerate the Carta workspace's own MANIFEST

Not in this task — task 06 owns the self-regeneration of `.carta/MANIFEST.md`. This task only lands the code changes.

## Files to Modify

- `carta_cli/regenerate_core.py` — attachments column + orphan collection (~60-90 line delta).
- `carta_cli/manifest-preamble.md` — add the Attachments column definition + note about orphan warnings on stderr (~10 lines).
- `tests/test_regenerate.py` — new cases (~200 lines).

## Verification

- `make test` passes.
- Running `carta regenerate` on a test workspace with bundles produces a MANIFEST with the Attachments column populated correctly.
- Running `carta regenerate` on a workspace with a deliberately planted orphan prints the warning to stderr and still writes MANIFEST.
- Running `carta regenerate` on a workspace with no attachments produces MANIFEST identical in content to the previous format except for the added column with `—` cells.

## Out of Scope

- Attachment filesize/mtime in MANIFEST (future).
- Kind-aware rendering (future, depends on reconciliation).
- Updating Carta's own `.carta/MANIFEST.md` — task 06.
- Changes to tag index or reverse-deps logic.

## Notes

- Keep the attachments cell compact. If a doc has many attachments, truncate at 5 with an ellipsis: `xstate.json, mockup.png, rules.yaml, flowchart.mmd, schema.json, …`.
- Orphan warnings should be stable across runs — alphabetize by path so the output is diff-friendly.
- If MANIFEST regeneration is run from a pre-bundle workspace (no attachments anywhere), the column cells are all `—` and no warnings appear; this is the zero-impact path.
- The `Refs` column (reverse deps) is unchanged; it operates on doc refs, not attachments.
