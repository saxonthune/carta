# mdapi Phase 2 — Read-side CLI (outline, read, locate)

## Motivation

Phase 2 of `rhidoc mdapi`. Read-side operations are the safer, cheaper investment per doc03.08.12 (Structured Authoring and the Format Tax) — they cost the model nothing at authoring time and let an agent pull partial context (a subtree, or a depth-truncated skim) instead of the whole doc. Built on Phase 1's `MdTree`.

## Do NOT

- Do NOT implement any mutation verb (insert/set-body/move/delete/hoist) — that is Phase 3.
- Do NOT add lint — that is Phase 3.
- Do NOT modify the Phase 1 tree model. Consume `rhidoc/mdtree.py` exactly as its Surface declares (`MdTree.parse/render/resolve/walk`, `MdNode` fields).
- Do NOT add anchors / `{#slug}` — addressing is positional only.

## Plan

Reads have two orthogonal selectors: **range** (which nodes, horizontally) and **depth** (how deep into each, vertically). They compose and do not interfere.

### 1. Command module

Create `rhidoc/commands/mdapi.py` with handlers `cmd_mdapi_outline`, `cmd_mdapi_read`, `cmd_mdapi_locate` (follow the `rhidoc/commands/content.py` pattern: `(args, rhidoc_root)`, resolve the doc with `resolve_arg`, raise `RhidocError`). Resolve `DOC` (doc ref or path) exactly as `cmd_cat` does, read its text, build the tree via `MdTree.parse`.

- `outline` — print every node as `ADDRESS  <marker_text>` (markers only, no bodies). Use `for_stream(sys.stdout)` glyphs if connectors are wanted (mirror `cmd_tree`).
- `read` — select nodes, then print them:
  - `--range A:B` — contiguous sibling span A..B inclusive, plus their subtrees. Omit = whole doc.
  - `--at ADDR` — sugar for `--range ADDR:ADDR` (single node + subtree). `--range` and `--at` are mutually exclusive.
  - `--depth N` — descend at most N levels into each selected node, including each node's preamble (`body_text` before its first child).
- `locate --text "…"` — find the first node whose `marker_text`/`body_text` matches and print its positional address.

### 2. Parser wiring

In `rhidoc/commands/_parser.py::build_parser`, add a `mdapi` subparser with a nested subcommand (`outline`/`read`/`locate`) — either a second `add_subparsers` level or an `mdapi <verb>` positional. Add the flags above. Register `mdapi` in the `dispatch` table and the `known_subcommands` set; dispatch to the right handler by verb.

### 3. AI-skill docs

Add an `mdapi` entry to `_COMMAND_DOCS` in `rhidoc/ai_skill.py` documenting the read verbs, the range×depth model, and that `DOC` is a doc ref or path.

### 4. Tests

Add `tests/test_mdapi_read.py`: outline addresses, depth truncation, range sibling-span selection, range+depth composition, single-node `--at`, locate by text.

## Files to Modify

- `rhidoc/commands/mdapi.py` — NEW: read handlers
- `rhidoc/commands/_parser.py` — `mdapi` subparser group + dispatch + `known_subcommands`
- `rhidoc/ai_skill.py` — `_COMMAND_DOCS["mdapi"]`
- `tests/test_mdapi_read.py` — NEW

## Verification

```bash
pip install -e . --quiet
make test
rhidoc mdapi outline doc00.02
rhidoc mdapi read doc00.02 --depth 1
rhidoc mdapi read doc00.02 --at 2 --depth 2
```

## Out of Scope

- Mutation verbs and lint (Phase 3).
- Anchors (deferred entirely).

## Notes

- Triage against Phase 1's `## Surface after this phase` (`MdTree`/`MdNode`), not live code — Phase 1 will not have merged.
- Follow existing arg/dispatch conventions in `_parser.py` and `commands/content.py`.

## Surface after this phase

- `rhidoc mdapi` subcommand group exists with read verbs:
  - `rhidoc mdapi outline DOC`
  - `rhidoc mdapi read DOC [--range A:B | --at ADDR] [--depth N]`
  - `rhidoc mdapi locate DOC --text "…"`
- `rhidoc/commands/mdapi.py` exists and is the home for mdapi handlers (Phase 3 extends it).
- `mdapi` is registered in `_parser.py` `dispatch` + `known_subcommands`, and documented in `ai_skill.py` `_COMMAND_DOCS`.
- `--at ADDR` ≡ `--range ADDR:ADDR`; the two are mutually exclusive.
- Negative space: no write/mutation verb exists yet; no lint exists yet.
