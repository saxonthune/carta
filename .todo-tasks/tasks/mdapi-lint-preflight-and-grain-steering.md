# mdapi lint pre-flight + grain-not-mechanism authoring steering

## Motivation

Two gaps in the mdapi authoring loop, discovered in the same 2026-06-25 doc-authoring
session, both about letting an agent compose dense structured nodes well:

1. **No read-only lint.** `mdlint` is folded into `insert`/`set-body` and is "NOT a
   standalone command", so the only way to learn whether a draft passes the caps +
   banned-pattern + duplicate checks is to *attempt the write* and have it abort. The
   structured-generation pattern that works is draft-free-text → validate → revise, with
   the validator's rejection as the feedback signal. That loop needs a fast,
   side-effect-free validate step; right now validate and write are welded together, so
   every iteration costs a write-and-rollback.

2. **The stdin help doesn't model the right grain.** The help describes stdin generically
   ("read a markdown draft from stdin") and the originating draft proposed steering agents
   toward "inline `printf`, one node per pipe, never a temp file." Investigation of
   `mdtree.py` showed that advice is partly wrong: the node model is **headings + list
   items only** — paragraphs, code fences, and tables are all `body_text` on the nearest
   node, never their own addressable nodes. And inline `printf` is escaping-hell for the
   exact multi-line content (tables, code) that a heredoc handles cleanly. The right lesson
   is **decouple grain from mechanism**.

This is **Phase 2 of a chain**. Phase 1 (`mdapi-list-item-body-fidelity`) makes multi-line
bodies, tables, and fenced code round-trip with fidelity inside list items too (not just
under headings). Triage the grain note against Phase 1's Surface: document that tables/code
ride as body_text on the nearest node — heading *or* list item — without the old
"mangled in a list item" caveat.

## Do NOT

- Do NOT add any new lint rules or change the existing checks. Expose the *current*
  `lint_node` + `check_duplicate_body` path read-only; nothing more.
- Do NOT change the abort-on-violation behavior of the real `insert`/`set-body`, or add a
  `--dry-run` flag to them. The pre-flight is a **standalone `mdapi lint` verb only**.
- Do NOT make `mdapi lint` read or check an existing node by address. It reads a candidate
  draft from **stdin only** (mirrors the insert pre-write path).
- Do NOT touch the parser (`mdtree.py`). Phase 1 already fixed list-item body fidelity; this
  phase only *documents* the result. This task is lint + docs only.
- Do NOT re-introduce the "table nested in a list item is mangled" caveat — Phase 1 fixed it.
  Document the corrected behavior (tables/code round-trip as heading *or* list-item body).
- Do NOT keep the draft's "always inline printf, never a temp file" framing. That steers
  agents away from heredocs, which are better for tables/code. Frame around grain.
- Do NOT run this task in parallel with sibling chain phases — they all edit `mdapi.py`,
  `_parser.py`, and `ai_skill.py`. The chain sequences them.

## Plan

### 1. Add `cmd_mdapi_lint` in `rhidoc/commands/mdapi.py`

Add a verb that mirrors `cmd_mdapi_insert`'s lint path minus the write. It parses a draft
from stdin into nodes, runs the same `_run_lint(new_nodes, tree)` against the resolved
doc's existing tree (so duplicate-body detection works against the real document), prints
violations to stderr via `_print_violations`, and exits non-zero on any violation while
writing nothing.

```python
def cmd_mdapi_lint(args: argparse.Namespace, rhidoc_root: Path) -> None:
    """Lint a candidate draft from stdin against DOC's tree; write nothing.

    Same checks insert runs pre-write (caps, banned patterns, duplicate body vs the
    existing doc). Exits non-zero on any violation; the doc is never touched.
    """
    _, tree = _resolve_doc(args, rhidoc_root)
    draft = sys.stdin.read()

    new_nodes = MdTree.parse(draft).roots
    if not new_nodes:
        raise RhidocError("lint: stdin produced no nodes (marker line required)")

    # Address the draft nodes as if appended, so duplicate detection sees real addresses.
    assign_addresses(new_nodes)

    violations = _run_lint(new_nodes, tree)
    if violations:
        _print_violations(violations)
        raise RhidocError("lint: violations found")
```

Note `_run_lint` walks `tree` for duplicate comparison; the draft nodes are not inserted
into the tree, so call `assign_addresses(new_nodes)` to give them addresses for violation
messages (insert assigns addresses post-insertion; here they are standalone). Verify
`LintViolation.address` reads sensibly in the output — if standalone addressing looks
confusing, addressing the draft roots as `1, 2, …` is acceptable and is what
`MdTree.parse` already does, so the explicit `assign_addresses` call may be redundant;
keep it only if needed.

Add the dispatch branch in `cmd_mdapi`:

```python
    elif verb == "lint":
        cmd_mdapi_lint(args, rhidoc_root)
```

and add `"lint"` to the usage string's verb list.

### 2. Add the `lint` subparser in `rhidoc/commands/_parser.py`

Under `mdapi_subs`, mirroring `outline`'s minimal shape:

```python
    # mdapi lint
    p_lint = mdapi_subs.add_parser(
        "lint",
        help="Run the insert/set-body lint on a stdin draft without writing; exit non-zero on violations",
    )
    p_lint.add_argument("doc", help="Doc ref or path (duplicate-body is checked against this doc)")
```

### 3. Reframe the insert steering in `rhidoc/commands/_parser.py`

Give the `insert` subparser a `RawDescriptionHelpFormatter` epilog that teaches grain, not
mechanism. Concise — one short example each for the one-liner and multi-line cases:

```
Examples (grain: one addressable node — a heading or a bullet — per write):
  printf '%s\n' '- **term** — short definition.' | rhidoc mdapi insert doc01.02 --at 3
  rhidoc mdapi insert doc01.02 --at 3 <<'EOF'
  ## Heading

  Multi-line prose, a table, or a code fence goes here as the heading's body.
  EOF

Mechanism follows content: printf for a one-line bullet; a quoted heredoc for
multi-line bodies, tables, or code fences; a temp file is fine for large blocks.
```

### 4. Document `lint` and the grain model in `rhidoc/ai_skill.py`

In the `"mdapi"` block (starts ~line 576):

- Add to the synopsis fence: `rhidoc mdapi lint DOC                              # stdin: draft markdown — checks, no write`
- Add a `lint` entry under the read/utility verbs describing: runs the exact
  insert/set-body lint on a stdin draft, duplicate-body checked against DOC, prints
  violations to stderr, exits non-zero, writes nothing. Note its purpose: pre-flight a
  draft so the draft→validate→revise loop costs no write+rollback.
- Add a short **Authoring grain** note near the write verbs stating the node model
  honestly: only headings (h1–h6) and list items are addressable nodes; paragraphs, code
  fences, and tables are `body_text` on the nearest node, not nodes themselves. Therefore
  write one addressable node (heading or bullet) per call, and let mechanism follow content
  — `printf` for one-line bullets, a quoted heredoc for multi-line bodies / tables / code, a
  temp file for large blocks. Note the parser reality (post Phase 1): tables and fenced code
  round-trip verbatim as body_text on either a heading or a list item, and count against the
  40-line / 200-word caps. GFM tables are not enabled, so a table is opaque prose, never its
  own addressable node.

### 5. Tests in `tests/test_mdapi_write.py`

Add a `_run_lint_cmd(doc_file, draft)` helper mirroring `_run_insert` (patch `sys.stdin`
with `io.StringIO(draft)`, build args via `_args`, call `cmd_mdapi_lint`). Import
`cmd_mdapi_lint`. Cover:

- clean draft → no exception, **doc file byte-unchanged** (read text before/after).
- banned-pattern draft (e.g. body containing "will") → raises `RhidocError`, doc unchanged.
- word-cap / line-cap violation → raises, doc unchanged.
- duplicate-body draft (body equal to an existing node's body in `DOC_TEXT`) → raises.
- empty stdin (no marker) → raises `RhidocError` ("no nodes").

The defining assertion for every case is **the doc file is never written** — that is what
separates `lint` from `insert`.

## Files to Modify

- `rhidoc/commands/mdapi.py` — add `cmd_mdapi_lint`, dispatch branch, usage string.
- `rhidoc/commands/_parser.py` — add `lint` subparser; add grain epilog to `insert`.
- `rhidoc/ai_skill.py` — document `lint`; add the authoring-grain / mechanism note.
- `tests/test_mdapi_write.py` — add `cmd_mdapi_lint` tests asserting no write.

## Verification

```bash
make test
printf '%s\n\n%s\n' '# Probe' 'This will fail lint.' | python -m rhidoc mdapi lint .rhidoc/MANIFEST.md; echo "exit=$?"
printf '%s\n\n%s\n' '# Probe' 'A clean declarative body.' | python -m rhidoc mdapi lint .rhidoc/MANIFEST.md; echo "exit=$?"
python -m rhidoc mdapi insert --help
python -m rhidoc ai-skill mdapi
```

The first probe must print a `banned-pattern` violation and exit non-zero; the second must
exit zero with no output. Neither touches MANIFEST.md.

## Out of Scope

- Frontmatter editing via CLI — Phase 3 (`mdapi-frontmatter-editing`).
- New lint rules (deontic-modal register, near-duplicate detection).
- `--dry-run` on insert/set-body; linting an existing node by address.
- Parser changes — Phase 1 (`mdapi-list-item-body-fidelity`) owns those; this phase only
  documents the behavior Phase 1 establishes.

## Notes

- `_run_lint` (mdapi.py:109) already returns the same `LintViolation` list a failed write
  prints, so the verb is a thin reuse — most of the work is the steering docs and tests.
- The grain reframing is a deliberate correction of the originating draft
  (`mdapi-coax-small-chunk-piping`), which proposed "always inline printf, never a temp
  file." That conflated grain with mechanism and would steer agents away from heredocs.
- A reviewer should confirm the `lint` verb's violation addresses read sensibly for a
  standalone draft (the draft is not inserted, so addresses are `1, 2, …` of the draft
  itself, not positions in DOC).

## Surface after this phase

- `rhidoc/commands/mdapi.py`: `cmd_mdapi_lint(args, rhidoc_root)` exists — a read-only verb
  that lints a stdin draft against DOC (caps, banned patterns, duplicate-body vs the doc),
  prints `LintViolation`s to stderr, exits non-zero on any violation, and writes nothing.
- `rhidoc/commands/_parser.py`: `mdapi lint DOC` subcommand exists; the `insert` subparser
  carries a grain-not-mechanism epilog.
- `rhidoc/ai_skill.py`: the `mdapi` block documents `lint` and an Authoring-grain note
  (one addressable node per write; mechanism follows content).
- Negative space: `insert` / `set-body` abort-on-violation behavior is unchanged; no
  `--dry-run` was added; lint rules in `mdlint.py` are unchanged; the parser is untouched.
