# Replace scattered argparse.Namespace access with typed per-command args

## Motivation

`argparse.Namespace` is opaque to pyrefly, so the command layer is uncheckable end to
end — every `args.foo` access is unverified, and the type gate (already merged) had to
route around it. Converting each command's Namespace into a typed dataclass at the top
of the command function moves the unchecked seam to one line per command and makes
everything below it checkable.

## Do NOT

- Do NOT change the CLI surface: no flag, argument, subcommand, help-text, or output
  changes. `tests/` must pass unmodified (except where a test imports an internal
  symbol that moved).
- Do NOT change the dispatch wiring in `rhidoc/commands/_parser.py` — `cmd_*` functions
  keep their current signatures (`args: argparse.Namespace`, plus `rhidoc_root` where
  present).
- Do NOT do a partial conversion. The easiest wrong implementation is converting the
  obvious fields and leaving stray `args.foo` reads scattered below — every attribute
  access inside a command body must go through the typed object.
- Do NOT use `getattr(ns, "field", default)` in `from_namespace` to paper over fields
  the parser doesn't define — a missing field is a wiring bug and must raise, not
  default.
- Do NOT touch `rhidoc/rewriter.py`, `rhidoc/planning.py` ref handling, or
  `rhidoc/entries.py` resolution signatures — that is the next phase's territory.
- Do NOT run `pip install -e .` from the worktree (breaks the global editable install).

## Plan

### 1. Establish the pattern

For each `cmd_*` entry point, define a frozen dataclass named `<Verb>Args` (e.g.
`MakeArgs`, `MoveArgs`), colocated in the command's module, whose fields mirror
exactly the parser-defined attributes that command reads, with precise types
(`str | None`, `bool`, `list[str]`, etc. — check the `add_parser` blocks in
`rhidoc/commands/_parser.py` for each field's shape). Give each a
`@classmethod from_namespace(cls, ns: argparse.Namespace) -> Self` that reads the
fields once. The first statement of each `cmd_*` converts:
`a = MakeArgs.from_namespace(args)`; all subsequent access uses `a.<field>`.

### 2. Convert each module

- `rhidoc/commands/structure.py` — `cmd_make`, `cmd_delete`, `cmd_move`, `cmd_rename`
- `rhidoc/commands/transform.py` — `cmd_punch`, `cmd_hoist`, `cmd_copy`
- `rhidoc/commands/content.py` — `cmd_cat`, `cmd_tree`, `cmd_rewrite`,
  `cmd_regenerate`, `cmd_attach`, `cmd_ls`, `cmd_bundle`, `cmd_orphans`
- `rhidoc/commands/setup.py` — `cmd_init`, `cmd_init_rehydrate`, `cmd_portable`
- `rhidoc/commands/mdapi.py` — `cmd_mdapi` and each mdapi subcommand handler
  (outline, read, locate, insert, set-body, mv, del, hoist, lint, frontmatter,
  set-frontmatter), same pattern per handler
- `rhidoc/ai_skill.py` — `cmd_ai_skill`

### 3. Clean up gate-era suppressions

Search `rhidoc/` for pyrefly suppression comments added by the type-gate task around
Namespace access and remove any the conversion makes unnecessary. (The
portable-script import suppression in `planning.py` is unrelated — leave it.)

## Files to Modify

- `rhidoc/commands/structure.py`, `transform.py`, `content.py`, `setup.py`,
  `mdapi.py` — per-command dataclasses + conversion lines
- `rhidoc/ai_skill.py` — same for `cmd_ai_skill`

## Verification

```bash
python3 -m pyrefly check
python3 -m pytest tests/ -v
```

## Out of Scope

- DocRef migration through `rewriter.py`/`planning.py` (next phase).
- Any parser/dispatch restructuring.
- Strict-mode pyrefly settings.

## Notes

- The parser defines defaults for optional flags, so `from_namespace` should read
  attributes directly (`ns.dry_run`), letting a genuinely absent attribute raise
  `AttributeError`.
- 430 tests currently pass; `just test` (pyrefly + pytest) is the gate.

## Surface after this phase

- Every `cmd_*` function keeps its current signature and dispatch entry — callers and
  `_parser.py` are byte-compatible with before.
- Each command module holds frozen `<Verb>Args` dataclasses with
  `from_namespace(ns)`; no `args.<field>` attribute access remains inside command
  bodies below the conversion line.
- `python3 -m pyrefly check` exits clean; the full pytest suite passes unchanged.
- Negative space: `entries.resolve_arg` / `resolve_and_validate` still take `str` and
  return `DocEntry`; `rewriter.rewrite_refs` / `apply_rename_to_text` still take
  `dict[str, str]`; `planning.py` still builds string rename maps. The next phase may
  rely on these being untouched.
