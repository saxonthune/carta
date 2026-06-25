# mdtree: list-item bodies lose multi-line content; hr blocks dropped

## Motivation

The `mdtree` parser captures heading bodies with full fidelity (raw source lines, fenced
code preserved) but captures **list-item** bodies through a lossy inline path. Reproduced
against the live parser:

- A **fenced code block inside a list item is silently dropped** entirely.
- A multi-paragraph / table body inside a list item **loses its indentation** and renders
  flush-left, so on round-trip it *detaches from the bullet* and becomes a separate
  top-level block — the document structure changes.
- Consequently `parse(render(x)) != parse(x)` for any list item with a block-level body,
  violating the structural-idempotence property the hypothesis test
  (`tests/test_mdtree.py:293`) guarantees for simpler docs.

Separately, an **`hr` thematic break (`---`) is dropped** anywhere it appears (the
top-level parse loop's `else: self.i += 1` fallthrough eats the `hr` token). Blockquotes at
heading level already survive (their inner paragraph's raw lines carry the `>` prefix), so
they are not a defect — but inside list items they go through the same lossy path as
everything else and must be fixed there.

Root cause: `_parse_list_item` (mdtree.py:220) uses `_parse_paragraph_inline` (inline
content, no indentation, no fence/hr handling) for body content, whereas `_parse_heading`'s
body goes through the top-level loop's `_parse_paragraph_raw` / `_block_raw` (raw source
lines, fences handled).

## Do NOT

- Do NOT enable GFM tables in `MarkdownIt()`. Tables stay opaque prose captured verbatim as
  body_text; they are NOT addressable nodes. This task is about *fidelity*, not a richer
  node model.
- Do NOT add new node kinds. The node model stays **headings + list items only**.
- Do NOT change the `mdapi` write verbs, lint, or any command surface. This is a pure
  `mdtree.py` parse/render fidelity fix.
- Do NOT regress heading-level body capture or the existing idempotence test. The current
  passing behavior (heading bodies, blockquotes at heading level) must stay green.
- Do NOT special-case tables. The fix is generic raw-source capture of block-level content
  inside list items; tables ride along for free.

## Plan

### 1. Capture list-item block bodies as raw source lines (`_parse_list_item`)

In `mdtree.py:220`, the body branch currently calls `_parse_paragraph_inline` and the
`else` clause drops everything it doesn't recognize. Change body capture so that, after the
first paragraph (which still yields `marker_text` via its inline first line):

- subsequent `paragraph_open` blocks append their **raw source lines** (reuse the
  `_parse_paragraph_raw` mechanism — `self.body_lines[map[0]:map[1]]`), preserving the
  source indentation;
- `fence` / `code_block` / `hr` tokens append their raw source lines (reuse `_block_raw`)
  instead of being dropped;
- `blockquote_open` content is preserved (raw-line capture of its inner blocks, same as the
  heading path achieves);
- nested `bullet_list_open` / `ordered_list_open` continue to become `children`.

The captured raw lines carry their source indentation (2 spaces per list level), which is
exactly what render must emit back (see step 3).

### 2. Stop dropping `hr` at the top level (`_Parser.parse`)

In the top-level loop (mdtree.py:144), add `hr` to the opaque-block branch alongside
`fence` and `code_block` so a `---` thematic break is captured into the current heading's
body_text (or preamble) via `_block_raw` rather than skipped.

### 3. Render list-item bodies so structure round-trips (`_render_node`)

`_render_node` (mdtree.py:333) emits a list marker then `body_text` as-is. Two requirements
for idempotence:

- A **blank line must separate the marker from a block-level body**, or markdown-it reads
  the body as a lazy continuation of the marker's paragraph and folds it into `marker_text`
  on reparse. Emit the separating blank line when a list node has a non-empty body_text.
- The body_text's captured indentation must survive render unchanged (do not strip or
  re-indent — it already carries the correct per-level indentation from raw capture).

Verify nested list items (depth ≥ 2) round-trip: their source indentation is deeper, and
raw capture + verbatim emit should keep it self-consistent.

### 4. Tests (`tests/test_mdtree.py`)

- Add explicit round-trip cases asserting `parse(render(parse(src))) == parse(src)` AND that
  the rendered text preserves the content, for: (a) a list item with a second paragraph,
  (b) a list item containing a markdown table, (c) a list item containing a fenced code
  block, (d) a top-level `hr`, (e) a blockquote inside a list item, (f) a nested (depth-2)
  list item with a multi-line body.
- Extend the `conformant_markdown` hypothesis strategy (or add a second strategy) to emit
  list items with optional multi-line bodies / fenced code, so
  `test_hypothesis_structural_idempotence` covers the newly-supported content. This property
  is the acceptance gate.
- Add a direct assertion that a fenced code block inside a list item is present in
  `body_text` after parse (regression guard for the silent-drop bug).

## Files to Modify

- `rhidoc/mdtree.py` — `_parse_list_item` (raw body capture + fence/hr/blockquote), the
  top-level `parse` loop (`hr`), and `_render_node` (blank line before list-item body).
- `tests/test_mdtree.py` — explicit round-trip cases + extended hypothesis strategy +
  fence-not-dropped regression test.

## Verification

```bash
make test
python3 -c "
from rhidoc.mdtree import MdTree
src = '# H\n\n- item one\n\n  Second paragraph.\n\n  \`\`\`python\n  code_in_item()\n  \`\`\`\n- item two\n'
t1 = MdTree.parse(src); t2 = MdTree.parse(t1.render())
assert t1 == t2, 'round-trip not idempotent'
assert 'code_in_item()' in t1.roots[0].children[0].body_text, 'fence dropped'
print('OK')
"
```

`make test` (including the hypothesis idempotence property) must pass, and the inline check
must print `OK` — proving the fence survives and the round-trip is idempotent.

## Out of Scope

- Enabling GFM tables as a block grammar or as addressable nodes.
- The `mdapi lint` verb and authoring-grain steering — Phase 2 of this chain
  (`mdapi-lint-preflight-and-grain-steering`), which documents the behavior this phase
  establishes.
- Frontmatter editing — Phase 3 (`mdapi-frontmatter-editing`).

## Notes

- Blockquotes at heading level already round-trip (verified); the fix only needs to extend
  that same raw-line fidelity into list-item bodies.
- The hard part is render's blank-line-before-body rule for list items; the hypothesis
  idempotence property is the surest guard that it is correct across nesting depths.

## Surface after this phase

- `rhidoc/mdtree.py`: `_parse_list_item` captures block-level body content inside list items
  — multi-paragraph prose, markdown tables, fenced code blocks, and blockquotes — as raw
  source lines with source indentation preserved. Fenced code inside a list item is no
  longer dropped.
- Top-level `hr` (`---`) thematic breaks are preserved in body_text / preamble (no longer
  dropped).
- `MdTree.render()` emits a separating blank line before a list node's body_text, so
  `parse(render(parse(x))) == parse(x)` holds for documents with multi-line list-item
  bodies, tables, fenced code, hr blocks, and blockquotes — at top level and nested.
- Negative space (later phases may rely on these staying true):
  - GFM tables are still NOT enabled. A table is still opaque prose captured as body_text on
    its nearest heading or list item — never its own addressable node.
  - The node model is still **headings + list items only**.
  - The `mdapi` command surface, write verbs, and lint behavior are unchanged by this phase.
  - `MdNode`/`MdTree` field shapes and `MdTree.parse`/`render`/`resolve`/`walk` signatures
    are unchanged.
