# mdapi Phase 3 — Write-side CLI (insert, set-body, move, delete, hoist) + folded lint

## Motivation

Phase 3 of `rhidoc mdapi` — the write layer. Per doc03.08.12 (Structured Authoring and the Format Tax), the agent drafts prose freely and these commands place the draft into the addressable tree; they are a placement/normalization channel, not a generation channel. The symmetry with the file-level Docs API is the point: `insert`/`move`/`delete`/`hoist` are `rhidoc make`/`move`/`delete`/`hoist` pushed down one level — from docs-in-a-workspace to nodes-in-a-doc, same auto-bump addressing.

## Do NOT

- Do NOT put any LLM call in the write or lint path — lint is deterministic and reproducible.
- Do NOT make lint a separate user-invoked command. It is folded INTO `insert`/`set-body`: one call lints and writes (or rejects). `--no-lint` bypasses.
- Do NOT add stable anchors / `{#slug}` IDs — deferred entirely; addressing is positional only.
- Do NOT touch cross-file MANIFEST / ref rewriting — mdapi is intra-document only.
- Do NOT add a `punch`/wrap inverse of hoist — out of scope.
- Do NOT modify the Phase 1 tree model or Phase 2 read verbs beyond what wiring requires; consume their Surfaces.

## Plan

Five mutation verbs over Phase 1's `MdTree`, each re-rendering the doc via `MdTree.render()` and writing it back. Extend `rhidoc/commands/mdapi.py` (created in Phase 2).

### 1. Mutations

- `insert DOC --at ADDR [--before|--after]` (draft on stdin) — place new node(s) at a position; siblings auto-renumber. The stdin draft carries BOTH marker and body, so insert is create-and-fill in one call.
- `set-body DOC --at ADDR` (prose on stdin) — overwrite one existing node's `body_text`; structure untouched; no renumber.
- `move DOC --from ADDR --to ADDR` — relocate a whole subtree (node + ALL descendants travel together); both ends renumber.
- `delete DOC --at ADDR` — remove node + entire subtree; siblings renumber.
- `hoist DOC --at ADDR` — dissolve one node, lifting its children up one level into its slot among its former siblings; siblings renumber. Decide where the dissolved node's own `body_text` goes: merge into the parent's body, or prepend to the first hoisted child — pick one, document it, test it.

Renumber semantics mirror `rhidoc/numbering.py` / `rhidoc/commands/structure.py` auto-bump, one level down.

### 2. Folded lint

Create `rhidoc/mdlint.py` (or `rhidoc/mdtree/lint.py`): a deterministic function returning structured violations for a node/draft:
- per-node word and line caps (set sensible defaults, e.g. ~200 words / ~40 lines per node — tune and document),
- doc00.02 banned-pattern check (future modals, phase/version language, deferral language, dated postscripts, retrospective framing, volatile snapshots) — factor the pattern list into one shared source,
- intra-doc duplicate-`body_text` detection.

`insert` and `set-body` run lint as part of the call and, on violation, exit non-zero leaving the doc UNCHANGED, printing the violations. `--no-lint` on both verbs skips the gate.

### 3. Parser + skill + tests

- Add the five verbs (and `--no-lint` on insert/set-body) to the `mdapi` subparser in `_parser.py`; dispatch them.
- Extend `rhidoc/ai_skill.py` `_COMMAND_DOCS["mdapi"]` with the write verbs and the folded-lint behavior.
- `tests/test_mdapi_write.py`: each verb's renumber behavior, move-takes-whole-subtree, hoist child-lifting + body disposition, lint rejection paths (each banned pattern + caps + dup), `--no-lint` bypass, and round-trip fidelity preserved after every mutation.

## Files to Modify

- `rhidoc/commands/mdapi.py` — add the five mutation handlers + `--no-lint`
- `rhidoc/mdlint.py` — NEW: deterministic lint (caps, banned patterns, dup)
- `rhidoc/commands/_parser.py` — write verbs + flags + dispatch
- `rhidoc/ai_skill.py` — write-verb + lint docs
- `tests/test_mdapi_write.py` — NEW

## Verification

```bash
pip install -e . --quiet
make test
printf '### New section\n\nbody text here\n' | rhidoc mdapi insert doc00.02 --at 3 --before
rhidoc mdapi outline doc00.02
```

## Out of Scope

- Read verbs (Phase 2).
- Smart/LLM structuring of a raw draft — placement is mechanical and verbatim.
- A doc-failure feedback log channel (separate, deferred task).
- Anchors (deferred entirely).

## Notes

- Triage against the Surfaces of Phase 1 (`mdapi-tree-model`) and Phase 2 (`mdapi-read`), not live code.
- The folded-lint reject path must leave the file byte-unchanged — validate before writing.

## Surface after this phase

- `rhidoc mdapi` has the full mutation surface: `insert`, `set-body` (both with `--no-lint`), `move`, `delete`, `hoist`.
- `rhidoc/mdlint.py` exists: deterministic caps + doc00.02 banned-pattern + duplicate-body checks, reused by the write verbs; the banned-pattern list is factored into one shared source.
- `move` relocates a whole subtree; `hoist` lifts children one level; both renumber siblings.
- Lint is folded into `insert`/`set-body` (reject leaves doc unchanged); `--no-lint` bypasses. No standalone lint command, no LLM in the write path.
- Negative space: anchors still do not exist; mdapi remains intra-document (no MANIFEST/ref-rewrite coupling).
