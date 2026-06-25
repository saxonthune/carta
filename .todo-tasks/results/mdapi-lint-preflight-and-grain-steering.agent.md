# Agent Result: mdapi-lint-preflight-and-grain-steering

date: 2026-06-25T19:12:25-04:00
session: completed
verification: passed
commits: 1
branch: chain-mdapi-authoring_claude_mdapi-lint-preflight-and-grain-steering
surface deviations: none
turns: 27/100
cost: $0.9002858999999998/$5.00
uncommitted: none
session id: 5e23df7c-72a8-4bcc-b38c-e966ad4b2670


## Summary

- `insert`/`set-body` abort-on-violation behavior unchanged; no `--dry-run` added; lint rules untouched; parser untouched.

## Commits

```
1e71953f feat: mdapi lint pre-flight + grain-not-mechanism authoring steering
```

## Build & Test Output (last 30 lines)

```
    Relocate the node at --from (and its entire subtree) to the position before --to.
    Use --to N+1 to append after the last sibling at that level.
    Siblings at both ends renumber.  Moving a node into its own subtree is an error.

  delete DOC --at ADDR
    Remove the node and its entire subtree.  Siblings renumber.

  hoist DOC --at ADDR
    Dissolve the node, lifting its children one level into its slot among its former siblings.
    Body disposition: the dissolved node's body_text is prepended to the first hoisted
    child's body_text.  If there are no children (leaf hoist), the body is appended to the
    parent node's body_text (or tree preamble for root-level nodes).
    Siblings renumber.

Folded lint (insert and set-body only):
  Lint is a deterministic gate with no LLM involvement.  It checks:
    - word cap: body_text ≤ 200 words
    - line cap: body_text ≤ 40 lines
    - doc00.02 banned patterns: future modals (will/shall), phase/version language,
      deferral language (TODO/TBD), dated postscripts (as of YYYY-MM),
      retrospective framing (we decided/chose), volatile snapshots (currently)
    - duplicate body_text: the same body_text must not appear in another node
  Violations are printed to stderr; the file is left byte-unchanged.
  --no-lint on insert or set-body skips all checks.

Side effects:
  - Read verbs (outline, read, locate, lint): none.
  - Write verbs: overwrite the target file in place.  MANIFEST is NOT updated (mdapi is
    intra-document; cross-file ref rewriting is out of scope).
  - Anchors do not exist; addressing is positional only.
```
