# Bundle Resolver Foundation

## Motivation

Every other v0.2.0 sidecar task depends on a single, pure-function module that can answer: "given a directory, what are the bundles, what's each bundle's root, and which attachments belong to it?" Centralizing this here keeps the structural commands thin and makes the rules testable in isolation. See `sidecars.epic.md` for the full design.

## Do NOT

- Do NOT modify any command files (`commands/structure.py`, `commands/transform.py`, etc.) in this task. The resolver stands alone.
- Do NOT introduce a `kind` concept, attachment frontmatter, or any parsing of sidecar file contents. Bundling is purely filesystem-structural.
- Do NOT touch `planning.py` yet; the renumber-with-bundles integration happens in task 02.
- Do NOT special-case `.md.json` or other pathological names — treat anything that's not `NN-<slug>.md` as an attachment at the structural level; don't try to outsmart user naming.
- Do NOT rely on frontmatter for bundle membership. Filesystem is the sole source of truth.

## Plan

### 1. New module: `carta_cli/bundle.py`

Introduce a module with dataclasses and pure functions. No I/O beyond `Path.iterdir()`.

Types:
- `Bundle` dataclass: `prefix: int`, `root: Path | None` (the `NN-<slug>.md`, or `None` if orphan), `attachments: list[Path]` (all non-root siblings at this prefix, sorted by filename), `is_orphan: bool` property (True when `root is None` or when the prefix corresponds to a subdirectory), `slug: str | None` property (derived from `root.name` if present).

Functions:
- `list_bundles(directory: Path) -> list[Bundle]` — groups `directory.iterdir()` by numeric prefix (using existing `numbering.get_numeric_prefix`). For each group, identifies the single `.md` file with that prefix as root; all others are attachments. A directory at that prefix makes the group an orphan if there are any non-dir siblings at the same prefix; the directory itself is returned as its own single-member "structural" bundle (root=None, attachments=[dir], is_orphan=False but marked as a directory bundle — include a `is_directory_bundle` flag).
- `find_bundle(path: Path) -> Bundle | None` — given a path to an `NN-<slug>.md`, return the Bundle it roots. Returns None if the path isn't a numbered md file.
- `bundle_members(md_path: Path) -> list[Path]` — convenience: returns `[md_path, *attachments]` in deterministic order (md first, attachments sorted alphabetically). This is what `move`/`delete` will iterate over.
- `slug_matched_attachments(bundle: Bundle, slug: str) -> list[Path]` — attachments whose basename begins with `f"{bundle.prefix:02d}-{slug}."` (the slug-rename matcher). Used by `rename` in task 02.
- `detect_orphans(directory: Path) -> list[Bundle]` — convenience filter over `list_bundles`. Used by `regenerate` in task 05.

Edge cases to handle inside the resolver (each deserves its own test):
- A bundle with only a root and no attachments (the common case today).
- A bundle with root + multiple attachments.
- A bundle prefix with no root `.md` but one or more non-md siblings → `is_orphan=True`.
- A bundle prefix that is a subdirectory (e.g. `01-foo/`) with siblings `01-foo.json` in the same parent → the subdir is its own bundle (`is_directory_bundle=True`); the `.json` is an orphan in a separate `is_orphan=True` bundle. Note: they share a prefix but we model them as two bundles since directories can't own attachments.
- Two `.md` files at the same prefix → already illegal elsewhere in Carta; raise a clear `CartaError` from the resolver ("bundle at prefix NN has multiple root candidates: [...]"). Don't try to pick one.
- Non-numbered files (no `NN-` prefix) → ignored, do not appear in any bundle.

### 2. Small extension to `carta_cli/entries.py`

Keep `list_numbered_entries` untouched. Optionally add a one-liner `list_bundles_in` that delegates to `bundle.list_bundles`, but skip if not needed — prefer callers importing from `bundle` directly.

### 2b. Register `bundle.py` in the portable manifest

File: `carta_cli/commands/setup.py` — the `_LIBRARY_MODULES` list (around lines 26-44) is the explicit allowlist of Python files that `carta portable` copies into a workspace's `_scripts/` directory. Add `"bundle.py"` to the list next to `entries.py` / `numbering.py`. Without this, `carta portable` produces a workspace whose copy of the tooling is broken when tasks 02–05 start importing the resolver.

### 3. Tests: `tests/test_bundle.py` (new file)

Create a pytest module targeting `bundle.py`. Use `tmp_path` fixtures, construct files with `Path.touch()`. Cover:
- `list_bundles` on an empty dir → `[]`.
- `list_bundles` with one root, no attachments.
- `list_bundles` with root + 2 attachments (mixed extensions).
- `list_bundles` with an orphan group (no md root).
- `list_bundles` with a directory bundle + attachments at the same prefix → two Bundle entries, one directory bundle, one orphan.
- `list_bundles` raises `CartaError` on two `.md` roots at same prefix.
- `find_bundle` given a valid md path → returns the bundle.
- `find_bundle` given a non-numbered file → returns `None`.
- `bundle_members` ordering: root first, attachments alphabetical.
- `slug_matched_attachments` selects only attachments starting with `NN-<slug>.` and skips prefix-shared-but-differently-slugged files.
- `detect_orphans` returns only `is_orphan=True` bundles.

### 4. No wiring in existing commands

This task lands the module and tests only. Existing behavior is unchanged. `pytest` must pass unchanged; `make test` baseline stays green.

## Files to Modify

- `carta_cli/bundle.py` — new, ~120-180 lines.
- `carta_cli/entries.py` — optional pass-through helper; skip if it adds nothing.
- `carta_cli/commands/setup.py` — add `"bundle.py"` to `_LIBRARY_MODULES`.
- `tests/test_bundle.py` — new, ~200 lines across the cases above.

## Verification

- `make test` passes with no regressions.
- New `tests/test_bundle.py` has full coverage of the cases listed above.
- Import smoke test: `python -c "from carta_cli.bundle import list_bundles, find_bundle, bundle_members, slug_matched_attachments, detect_orphans"` succeeds.
- No behavioral change to any `carta` CLI command (by construction — nothing wires in yet).

## Out of Scope

- Command integration (tasks 02–04).
- MANIFEST rendering (task 05).
- Orphan *reporting output* shape (defined in task 05); this task only exposes `detect_orphans`.
- Any changes to frontmatter, `carta copy`, or `carta cat`.

## Notes

- Use plain `@dataclass(frozen=True)` for `Bundle`; no inheritance.
- Sort attachments by filename for deterministic MANIFEST output.
- The `is_directory_bundle` flag vs `is_orphan` distinction matters because directory bundles are legitimate and not warning-worthy, while orphaned attachments are. Task 05 uses this distinction for the orphan report.
- The single source of the `NN-` regex is `numbering.get_numeric_prefix` — don't duplicate it in `bundle.py`.
