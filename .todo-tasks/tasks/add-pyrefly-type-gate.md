# Add a Pyrefly type-check gate to the test pipeline

## Motivation

The codebase is AI-authored end to end. Type annotations exist throughout but nothing
enforces them, so they are decoration a future session can silently violate. A type
checker is a deterministic, zero-token oracle: it verifies every line (including the
~12% pytest never executes), catches stale call sites instantly during refactors, and
carries conventions like "refs travel as `DocRef`, not `str`" across sessions without
relying on prose instructions. Pyrefly (Meta, stable 1.0 since May 2026) is the chosen
checker: fast, strict by default, 87.8% typing-spec conformance, first-party AI-agent
workflow docs.

## Do NOT

- Do NOT run `pip install -e .` (editable install) from the worktree — it repoints the
  global install's `.pth` at the worktree, which is deleted after merge, breaking the
  user's environment. Install pyrefly plainly: `python3 -m pip install pyrefly`.
- Do NOT refactor `argparse.Namespace` into typed dataclasses — that is a separate
  follow-up task. If Namespace access produces errors, use targeted per-line
  suppressions with the specific error code and a short reason.
- Do NOT enable strict mode or add annotations wholesale to internals beyond what a
  clean default-mode check requires.
- Do NOT silence errors with file-level ignores or by excluding modules from the check
  to reach green. Per-line, code-specific suppressions only, each justified.
- Do NOT touch `rhidoc/templates/` or `.rhidoc/00-codex/` — hydrated content is out of
  scope.
- Do NOT add editor/IDE configuration (.vscode, extensions).
- Do NOT switch to a different checker (pyright, ty, mypy) if pyrefly misbehaves —
  record the failure in the result notes and stop.

## Plan

### 1. Add pyrefly as a test dependency

In `pyproject.toml`, add `"pyrefly"` to `[project.optional-dependencies] test`. In
`justfile`, update the `reinstall` recipe to install the test extras:
`python3 -m pip install -e "{{justfile_directory()}}[test]"`.

### 2. Configure pyrefly

Add a `[tool.pyrefly]` block to `pyproject.toml` scoping the check to the `rhidoc/`
package (exclude `tests/` for now). Consult `pyrefly --help` / `pyrefly init` for the
exact config keys rather than guessing — the docs are at pyrefly.org. Default
(non-strict) mode.

### 3. Wire the gate into `just test`

In `justfile`, add a `check` recipe running `python3 -m pyrefly check`, and make the
`test` recipe run the type check before pytest, so `just test` (the pre-commit gate
named in CLAUDE.md) fails on type errors. Keep `check` callable on its own.

### 4. Fix what the checker flags

Install pyrefly (`python3 -m pip install pyrefly`), run `python3 -m pyrefly check`,
and fix every violation in `rhidoc/`. Prefer real fixes: missing annotations, `None`
guards, narrowed returns. While in `rhidoc/mdlint.py`, promote `Violation.kind` from
`str` (legal values listed only in a comment) to a
`Literal["word-cap", "line-cap", "banned-pattern", "duplicate-body"]` alias.

### 5. Record the gate in the docs

- `CLAUDE.md` Build & Test section: note that `just test` now runs the pyrefly type
  check before pytest.
- `.rhidoc/02-architecture/02-design-patterns/01-python-for-ai.md` (doc02.02.01): add
  a short section stating the type gate exists and the direction of travel — values
  parsed into types at boundaries (`DocRef`/`EntryName` pattern), `Literal` for fixed
  vocabularies, typed command args as a future step. Body edit only; keep it sparse.

## Files to Modify

- `pyproject.toml` — pyrefly dependency + `[tool.pyrefly]` config
- `justfile` — `check` recipe, `test` runs it first, `reinstall` installs `[test]` extras
- `rhidoc/mdlint.py` — `Violation.kind` becomes a `Literal` alias
- `rhidoc/*.py`, `rhidoc/commands/*.py` — whatever `pyrefly check` flags
- `CLAUDE.md` — one line in Build & Test
- `.rhidoc/02-architecture/02-design-patterns/01-python-for-ai.md` — short typing section

## Verification

```bash
python3 -m pip install pyrefly
python3 -m pyrefly check
python3 -m pytest tests/ -v
```

## Out of Scope

- Migrating `argparse.Namespace` to typed per-command dataclasses (follow-up task).
- Spreading `DocRef` through `planning.py`/`rewriter.py` call sites (follow-up task).
- Strict mode, `Any`-boundary policing, and annotation completeness.
- CI configuration — the gate lives in `just test`.

## Notes

- `rhidoc/docref.py` already holds the value objects (`DocRef`, `EntryName`,
  `DocEntry`) the typing direction builds on; nothing there should need changes.
- The suite currently passes 430 tests; pytest behavior must not change.
- If pyrefly's default mode reports nothing at all, verify the config actually
  includes `rhidoc/` (an empty-include config passing vacuously is the easiest wrong
  implementation).
