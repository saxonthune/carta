# Rename file-level `rhidoc flatten` → `rhidoc hoist`

## Motivation

The `rhidoc mdapi` subsystem introduces an intra-document `hoist` verb (dissolve a node, lift its children up one level). The existing file-level command that does the structurally identical thing — dissolve a directory, hoist its children into the parent — is named `flatten`. Aligning the two on one verb (`hoist`) makes the file-level and intra-doc Docs APIs symmetric: `make`/`move`/`delete`/`hoist` mean the same operation at both levels. Backwards compatibility is NOT a concern in this repo (CLAUDE.md) — rename cleanly, remove the old name entirely.

## Description

Rename the `flatten` subcommand and its implementation to `hoist` everywhere: the CLI surface, the command function, the AI-skill reference, tests (including snapshots), and the `.rhidoc/` docs + shipped templates that mention it. No behavior change — pure rename.

## Do NOT

- Do NOT keep `flatten` as a deprecated alias. Remove it completely (per CLAUDE.md: no backwards-compat code paths).
- Do NOT change the command's behavior, flags, or output beyond the name (`--keep-index`, `--force`, `--before`, `--dry-run` all stay).
- Do NOT edit `.rhidoc/00-codex/*` workspace copies directly — those are GENERATED from `rhidoc/templates/`. Edit the template source, then the workspace copy is rehydrated separately. (The `00-codex/00-index.md` hit is a generated file; fix it via its template if one exists, else note it for rehydrate.)

## Plan

### 1. CLI surface
- `rhidoc/commands/_parser.py`: rename the `flatten` subparser to `hoist` (parser var, `add_parser("flatten")` → `"hoist"`, help text), update the `known_subcommands` set, and the `dispatch` table key + imported function name.

### 2. Implementation
- `rhidoc/commands/transform.py`: rename `cmd_flatten` → `cmd_hoist` (and any internal "flatten" naming/messages). Update the import in `_parser.py`.

### 3. AI-skill reference
- `rhidoc/ai_skill.py`: rename the `flatten` entry/key in `_COMMAND_DOCS` and any prose to `hoist`.

### 4. Tests
- `tests/test_cli.py`, `tests/test_properties.py`: rename invocations and assertions.
- `tests/__snapshots__/test_cli.ambr`: regenerate/update the snapshot for the renamed command (`pytest --snapshot-update` via syrupy, then review the diff).

### 5. Docs + templates
- Templates (shipped to other projects): `rhidoc/templates/AGENTS.md`, `rhidoc/templates/skill.md`, `rhidoc/templates/00-index.md`.
- Workspace `.rhidoc/` docs: `.rhidoc/03-product-strategy/03-glossary.md`, `.../08-research/06-spec-format-vocabulary.md`, `.rhidoc/02-product-design/02-cli-user-flow.md`, `.../01-workspace-scripts/01-workspace-scripts.md`, `.rhidoc/AGENTS.md`. The `00-codex/00-index.md` mention is generated — fix via the template (`rhidoc/templates/00-index.md`).

## Files to Modify

- `rhidoc/commands/_parser.py`, `rhidoc/commands/transform.py`, `rhidoc/ai_skill.py`
- `tests/test_cli.py`, `tests/test_properties.py`, `tests/__snapshots__/test_cli.ambr`
- `rhidoc/templates/AGENTS.md`, `rhidoc/templates/skill.md`, `rhidoc/templates/00-index.md`
- `.rhidoc/03-product-strategy/03-glossary.md`, `.rhidoc/03-product-strategy/08-research/06-spec-format-vocabulary.md`, `.rhidoc/02-product-design/02-cli-user-flow.md`, `.rhidoc/02-product-design/01-workspace-scripts/01-workspace-scripts.md`, `.rhidoc/AGENTS.md`

## Verification

```bash
make test
rhidoc hoist --help
! rhidoc flatten --help 2>/dev/null && echo "FAIL: flatten still exists" || echo "OK: flatten removed"
grep -rn "flatten" rhidoc/ && echo "FAIL: flatten refs remain in source" || echo "OK: no flatten in source"
```

## Out of Scope

- Any mdapi tree/read/write work (the other chain phases).
- Behavior changes to the hoist operation itself.

## Notes

- Independent of the mdapi tree phases — shares no code, only vocabulary. Sequence it so "hoist" is established before/alongside the mdapi `hoist` verb.
- The `00-codex/00-index.md` workspace hit is a generated rehydrate target; the canonical fix is in `rhidoc/templates/00-index.md`, then `rhidoc init --rehydrate`.

## Surface after this phase

- File-level command is `rhidoc hoist` (was `flatten`); `cmd_hoist` in `rhidoc/commands/transform.py`; `flatten` no longer exists anywhere in source.
- mdapi's `hoist` verb (other ticket) shares the vocabulary but not the code path.
