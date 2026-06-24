# mdapi Phase 1 — Markdown tree model, addressing, content-fidelity round-trip

## Motivation

The `rhidoc mdapi` subsystem lets an agent edit a single markdown doc as an addressable tree — the intra-document analog of rhidoc's inter-document `make`/`move`/`delete`. Grounded by doc03.08.12 (Structured Authoring and the Format Tax): the API is a placement/normalization layer, NOT a generation channel — the agent drafts freely, then commits through the API.

This phase builds the pure core library: parse a doc's markdown body into a unified heading+list tree with computed positional addresses, and render it back without losing content. No CLI — every later phase depends on this module.

## Do NOT

- Do NOT add stable anchors / `{#slug}` IDs. Addressing is positional ONLY. Do not parse, store, or emit attribute syntax. (Deferred entirely until a sub-document cross-ref need appears.)
- Do NOT make paragraphs addressable nodes. Only headings and list items are nodes; prose is `body_text` on its enclosing node.
- Do NOT round-trip through an AST-renderer (mistletoe/marko/mdformat) — they normalize aggressively. Identify with markdown-it-py, render from original line spans.
- Do NOT build any CLI command, argparse wiring, mutation, or lint — those are Phases 2 and 3.
- Do NOT require byte-exact output. The invariant is content fidelity (nothing dropped/duplicated/reordered; frontmatter verbatim); whitespace may normalize.

## Plan

### 1. Add the dependency

Add `markdown-it-py` to `[project].dependencies` in `pyproject.toml` (currently only `click`, `pyyaml`). It is already installed in-env; this just declares it.

### 2. The node + tree model

Create `rhidoc/mdtree.py`:

- `MdNode` dataclass:
  - `marker_kind: str` — one of `h1`,`h2`,`h3`,`h4`,`h5`,`h6`,`ol`,`ul`
  - `marker_text: str` — the heading's inline text, or a list item's own first-line text (marker syntax stripped)
  - `body_text: str` — prose between this node's marker line and its first child, excluding children (may be empty)
  - `children: list[MdNode]`
  - `address: str` — dotted positional address (e.g. `2.3.1`), computed during parse
  - `depth: int` — 1-based nesting depth
- `MdTree` dataclass/class holding `frontmatter: str` (raw text incl. delimiters, or empty) and `roots: list[MdNode]` (top-level forest of the body).

### 3. Parse

- `MdTree.parse(text: str) -> MdTree`. Split frontmatter via `rhidoc/frontmatter.py::read_frontmatter` (preserve raw frontmatter verbatim for re-emit). Tokenize the body with markdown-it-py; use token `.map` line spans and heading levels / `list_item` nesting to build the unified tree. Headings nest by level; a heading's children are the headings and lists under it until the next equal-or-shallower heading; a list item's children are its sub-items. Code fences are opaque — a `#`/`-` inside a ``` / `~~~` fence is body content, never a marker.
- Compute `address` for every node from its position among siblings (`1`-based, dotted).

### 4. Resolve + walk

- `MdTree.resolve(address: str) -> MdNode | None` — positional lookup.
- `MdTree.walk() -> Iterator[MdNode]` — pre-order traversal (used by later read commands).

### 5. Render

- `MdTree.render() -> str` — reattach frontmatter verbatim, then emit the body. Prefer slicing original source by each node's line span for unchanged nodes so diffs stay minimal; re-serialize only where necessary. Output need not be byte-identical but MUST preserve all content and structure.

### 6. Tests

Create `tests/test_mdtree.py` covering: addressing (mixed heading/list nesting), `resolve`, prose-as-`body_text`, code fences containing `#`/`-` treated as opaque, empty bodies, frontmatter passthrough. Add a `hypothesis` property test asserting structural idempotence `parse(render(parse(t))) == parse(t)` over generated conformant markdown.

## Files to Modify

- `pyproject.toml` — add `markdown-it-py` to `dependencies`
- `rhidoc/mdtree.py` — NEW: `MdNode`, `MdTree`, parse/resolve/walk/render
- `tests/test_mdtree.py` — NEW: unit + hypothesis property tests

## Verification

```bash
pip install -e . --quiet
make test
python -c "from rhidoc.mdtree import MdTree; t=MdTree.parse('# A\n\nlede\n\n## B\n\n- x\n  - y\n'); print([n.address for n in t.walk()]); assert t.resolve('1.1') is not None; assert t.resolve('1.1.1') is not None"
```

## Out of Scope

- CLI / argparse (Phase 2), mutation + lint (Phase 3), cross-file MANIFEST/ref rewriting.
- Stable anchors / IDs (deferred entirely).

## Notes

- Reuse `rhidoc/frontmatter.py` (`read_frontmatter`) and `rhidoc/errors.py` (`RhidocError`).
- markdown-it-py tokens carry `.map = [start_line, end_line]` — the basis for line-span slicing.

## Surface after this phase

- New module `rhidoc/mdtree.py` exporting:
  - `MdNode` dataclass with fields `marker_kind` (`h1`..`h6`|`ol`|`ul`), `marker_text: str`, `body_text: str`, `children: list[MdNode]`, `address: str`, `depth: int`.
  - `MdTree` with attributes `frontmatter: str`, `roots: list[MdNode]`, and methods `parse(text: str) -> MdTree` (classmethod/staticmethod), `render() -> str`, `resolve(address: str) -> MdNode | None`, `walk() -> Iterator[MdNode]`.
- Addressing is positional dotted strings (`2.3.1`), 1-based, computed — NO stored counters, NO anchors.
- Only headings and list items are nodes; paragraphs/prose live in `body_text`.
- Round-trip is content-fidelity (not byte-exact); `parse(render(parse(t))) == parse(t)` holds.
- `markdown-it-py` is a declared runtime dependency.
- Negative space: no CLI command exists yet; no mutation or lint exists yet.
