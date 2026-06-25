# mdapi frontmatter get/set — a CLI path so authoring never needs a raw YAML edit

## Motivation

Authoring a doc end-to-end through rhidoc currently forces a drop-out to a raw file editor
for one step. `rhidoc make` seeds `summary:` empty and `tags: []` and tells you to fill them
in the body pass; `mdapi` scopes itself to the heading+list tree *below* the frontmatter and
never touches it. So the one required-but-empty part of a fresh doc can only be filled by a
raw YAML edit — exactly the "direct file write bypasses the CLI" move the workspace warns
against, forced by a gap rather than chosen.

This task adds an in-toolset path to read and replace a doc's frontmatter block.

## Do NOT

- Do NOT add typed per-field flags (`--summary`, `--tags`, `--deps`, `--title`). The set verb
  takes the **raw frontmatter block from stdin** and replaces it wholesale. We are
  deliberately NOT maintaining a per-field contract or schema right now.
- Do NOT validate the input, enforce required fields, or check YAML well-formedness. Pure
  get/set. The agent owns what it writes.
- Do NOT auto-regenerate MANIFEST. Follow mdapi's existing "MANIFEST is NOT updated" contract
  — the user runs `rhidoc regenerate` afterward. (Do document that they must.)
- Do NOT touch the body tree, preamble, or node structure. Only the frontmatter block
  changes; everything after the closing `---` is preserved byte-for-byte.
- Do NOT run this task in parallel with sibling chain phases — they all edit `mdapi.py`,
  `_parser.py`, and `ai_skill.py`. This is **Phase 3 of a chain**; the chain sequences it
  after the lint/steering phase.

## Plan

Both verbs operate on the **inner YAML** (the text between the `---` fences, fences
excluded), so `rhidoc mdapi frontmatter DOC | … | rhidoc mdapi set-frontmatter DOC` round-trips.
The tool owns the `---` delimiters.

`MdTree` already carries the raw frontmatter and reconstructs the file on render: `_resolve_doc`
returns `(path, MdTree)`; `tree.frontmatter` is the raw block as `"---\n<inner>\n---"`
(mdtree.py:120), and `tree.render()` re-emits frontmatter + preamble + nodes, managing the blank
line after the closing fence (mdtree.py:82-92). So set is: swap `tree.frontmatter`, re-render.

### 1. `cmd_mdapi_frontmatter` (get) in `rhidoc/commands/mdapi.py`

```python
def cmd_mdapi_frontmatter(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Print the doc's frontmatter inner YAML (between the --- fences, fences excluded)."""
    _, tree = _resolve_doc(args, rhidoc_root)
    fm = tree.frontmatter
    if not fm:
        return
    inner = fm
    if inner.startswith("---\n"):
        inner = inner[4:]
    if inner.endswith("\n---"):
        inner = inner[:-4]
    sys.stdout.write(inner + "\n")
```

### 2. `cmd_mdapi_set_frontmatter` (set) in `rhidoc/commands/mdapi.py`

```python
def cmd_mdapi_set_frontmatter(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Replace the doc's frontmatter block with inner YAML read from stdin; body unchanged."""
    path, tree = _resolve_doc(args, rhidoc_root)
    inner = sys.stdin.read().strip("\n")
    tree.frontmatter = "---\n" + inner + "\n---"
    path.write_text(tree.render(), encoding="utf-8")
```

Add dispatch branches in `cmd_mdapi` for `"frontmatter"` and `"set-frontmatter"`, and add both
to the usage string's verb list.

### 3. Subparsers in `rhidoc/commands/_parser.py`

```python
    # mdapi frontmatter
    p_fm = mdapi_subs.add_parser(
        "frontmatter",
        help="Print the doc's frontmatter inner YAML (fences excluded)",
    )
    p_fm.add_argument("doc", help="Doc ref or path")

    # mdapi set-frontmatter
    p_set_fm = mdapi_subs.add_parser(
        "set-frontmatter",
        help="Replace the doc's frontmatter block with inner YAML from stdin; body unchanged",
    )
    p_set_fm.add_argument("doc", help="Doc ref or path")
```

### 4. Document in `rhidoc/ai_skill.py`

In the `"mdapi"` block (~line 576):

- Add to the synopsis fence:
  ```
  rhidoc mdapi frontmatter DOC                         # print inner YAML (fences excluded)
  rhidoc mdapi set-frontmatter DOC                     # stdin: inner YAML — replaces block, body unchanged
  ```
- Add a short prose entry: these are the in-toolset path for frontmatter, so authoring never
  needs a raw YAML edit. Both operate on inner YAML (fences excluded) so output pipes back into
  input. `set-frontmatter` replaces the whole block verbatim — no per-field flags, no validation.
  State that frontmatter feeds the MANIFEST, so **run `rhidoc regenerate` after** changing
  `summary`/`tags`/`deps` (mdapi does not regenerate).

### 5. Tests — `tests/test_mdapi_frontmatter.py` (new)

Mirror the helper/fixture style of `tests/test_mdapi_write.py` (`_doc` writes a tmp file;
`_args` builds the namespace; patch `sys.stdin` with `io.StringIO`). Cover:

- get prints the inner YAML of a doc with frontmatter (no `---` fences in output).
- get on a doc with no frontmatter prints nothing.
- set replaces the block; re-reading shows the new fields; **the body after `---` is
  unchanged** (assert on the post-fence body text).
- round-trip: capture get output, feed it to set, file is structurally unchanged (parse both
  with `MdTree` and compare, or compare rendered text).
- set on a doc with no prior frontmatter adds a block and preserves the body.

## Files to Modify

- `rhidoc/commands/mdapi.py` — add `cmd_mdapi_frontmatter`, `cmd_mdapi_set_frontmatter`,
  dispatch branches, usage string.
- `rhidoc/commands/_parser.py` — add `frontmatter` and `set-frontmatter` subparsers.
- `rhidoc/ai_skill.py` — document both verbs + the regenerate reminder.
- `tests/test_mdapi_frontmatter.py` — new test file.

## Verification

```bash
make test
python -m rhidoc mdapi frontmatter .rhidoc/MANIFEST.md
python -m rhidoc make doc00 fm-probe --no-regen
python -m rhidoc mdapi frontmatter doc00.04
printf '%s\n' 'title: FM Probe' 'summary: a test summary' 'tags: [a, b]' | python -m rhidoc mdapi set-frontmatter doc00.04
python -m rhidoc mdapi frontmatter doc00.04
python -m rhidoc delete doc00.04
```

The `set-frontmatter` round must change the printed frontmatter to the piped fields while the
doc's body is untouched. Clean up the probe doc with `delete`. Confirm `make test` passes.

## Out of Scope

- Typed field flags / a frontmatter schema / required-field validation.
- Auto-regeneration of MANIFEST.
- Lint pre-flight and authoring-grain steering — separate task
  `mdapi-lint-preflight-and-grain-steering`.
- Changing how `make` seeds the skeleton.

## Notes

- `frontmatter.py` (typed `read_frontmatter`/`write_frontmatter`) is intentionally NOT used —
  the raw-block approach sidesteps its per-field parsing, which is the point of "I don't want
  to maintain the contract right now."
- `tree.render()` already manages the blank line between the closing `---` and the body
  (mdtree.py:82-92); the round-trip test is the guard that newline handling is correct.
- `delete doc00.04` in verification assumes the probe lands at slot 04 under `00-codex`; adjust
  the ref to whatever `make` reports if the codex has more docs.

## Surface after this phase

- `rhidoc/commands/mdapi.py`: `cmd_mdapi_frontmatter` (get) prints a doc's inner-YAML
  frontmatter; `cmd_mdapi_set_frontmatter` (set) replaces the frontmatter block wholesale
  from stdin, leaving the body byte-unchanged.
- `rhidoc/commands/_parser.py`: `mdapi frontmatter DOC` and `mdapi set-frontmatter DOC`
  subcommands exist; both operate on inner YAML (fences excluded) so output pipes into input.
- `rhidoc/ai_skill.py`: the `mdapi` block documents both verbs and the "run `regenerate`
  after" reminder.
- Negative space: no typed field flags, schema, validation, or auto-regen were added;
  `frontmatter.py` is untouched; the body tree and `make` skeleton are unchanged.
