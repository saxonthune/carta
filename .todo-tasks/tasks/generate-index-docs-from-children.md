# Make `00-index.md` a generated artifact, derived from direct children

## Motivation

Today every `00-index.md` body is hand-authored. In a corpus where docs move,
split, and differentiate, an authored "what belongs here" boundary rots silently:
the prose keeps describing a partition the tree has outgrown. An inventory of 13
real workspaces found ~2/3 of index bodies carry either prescriptive scoping prose
(stale-prone) or a hand-maintained child-listing table (exactly what a manifest
generates).

The fix: an index stops being a file you edit and becomes a generated artifact,
like `MANIFEST.md`. `rhidoc regenerate` rewrites the **body** of every
`00-index.md` from **deterministically collectable facts of its direct children**.
A tree node (the directory) carries *structure*, never *meaning*; meaning lives in
leaf docs and the cross-reference graph.

## Do NOT

- **Do NOT run `rhidoc regenerate` against this repo's own `.rhidoc/` workspace.**
  Its index bodies still hold real prose that has not been migrated; regenerating
  would destroy it. Test ONLY against temporary/fixture workspaces (pytest tmp_path
  or the existing test fixtures). Migrating real workspaces is out of scope.
- **Do NOT make an index pull recursive / whole-subtree data.** An index reflects
  its DIRECT children only. For a direct child that is a subgroup, collect only that
  subgroup's own node facts (its title, its direct-child count) — never the
  subgroup's aggregated tags, summaries, or descendants. Nothing bubbles the whole
  subtree upward.
- **Do NOT write generated tags into the `00-index.md` frontmatter.** Keep index
  frontmatter `tags: []`. `collect_entries`/`build_tag_index` already include
  `00-index.md` rows; writing union-tags there would double-count every tag in the
  MANIFEST tag index. The Topics line is BODY-only, computed on the fly.
- **Do NOT touch leaf-doc authoring.** Leaf `title`/`summary`/`tags` stay authored;
  the index only *collects* them.
- **Do NOT edit any `.rhidoc/` doc** (invariants, conventions, etc.). Doc updates
  are a separate follow-up. This task is rhidoc CLI code + tests + the init
  template only.

## The index contract

For a directory `D` that contains a `00-index.md`, regenerate overwrites `D/00-index.md`:

- **Frontmatter**: preserve the existing authored `title` (fall back to the
  directory slug after `NN-`, hyphens→spaces, title-cased, if absent). Leave
  `summary: ""`, `tags: []`, `deps: []`. Only the body is generated.
- **Body** = `# {title}` heading, then a Contents table of direct children, then a
  Topics line.

A **direct child** of `D` is any `NN-*` entry in `D` other than `00-index.md`:

- a **leaf** `NN-slug.md` → row: `ref`, `title`, kind `doc`, `summary`, `tags`
  (all read from the leaf's own frontmatter).
- a **subgroup** `NN-slug/` (a directory containing its own `00-index.md`) → row:
  `ref`, `title` (from the subgroup's `00-index` frontmatter), kind `group (N)`
  where N is the count of the subgroup's own direct children (its `NN-*` entries
  excluding its `00-index.md`), `summary` = `—`, `tags` = `—`.

Rows sorted by `NN` prefix.

**Topics line**: `Topics: ` followed by the sorted union of the `tags` of the
direct **leaf** children only (subgroups contribute none). Omit the line entirely
if there are no leaf children or the union is empty.

### Worked example — `02-product-design/00-index.md`

Direct children: `doc02.02` (leaf), `doc02.01` (subgroup, 4 direct children),
`doc02.03` (subgroup, 1 direct child).

```markdown
---
title: Product Design
summary: ""
tags: []
deps: []
---

# Product Design

| Ref | Item | Kind | Summary | Tags |
|-----|------|------|---------|------|
| doc02.01 | Workspace Scripts | group (4) | — | — |
| doc02.02 | CLI User Flow | doc | How users install the rhidoc CLI, hydrate a repo, and use it for workspace operations | cli, installation, use-case, workflow |
| doc02.03 | Decisions Index | group (1) | — | — |

Topics: cli, installation, use-case, workflow
```

Every cell is a function of the direct children. `group (4)` is `doc02.01`'s
own direct-child count — NOT a recursive walk.

## Plan

### 1. Index body generation in `regenerate_core.py`

Add a function that, given a directory path containing a `00-index.md`, builds the
generated body per the contract above. Reuse existing helpers: `DocRef.from_path`
for refs, `read_frontmatter` for child titles/summaries/tags, the `_NUMERIC_PREFIX_RE`
to identify `NN-*` entries. Enumerate **direct** children of the directory only
(`dir_path.iterdir()`, match `NN-`, exclude `00-index.md`); classify each as leaf
(`.md` file) or subgroup (directory with a `00-index.md`).

Then add a function `write_all_indexes(rhidoc_root)` that walks every directory in
the workspace that contains a `00-index.md` (top-level title dirs and nested
subgroups alike) and rewrites each one's body, preserving its authored frontmatter
title and the rest of the frontmatter shape. Use `frontmatter.write_frontmatter`
(or read + re-render) so the frontmatter block is preserved and only the body is
replaced. Ordering does not matter — only raw filesystem facts (titles, counts) are
read, never generated/aggregated child data.

Call `write_all_indexes(rhidoc_root)` from `do_regenerate` (alongside the existing
MANIFEST write). Respect `dry_run`: in dry-run, print what would be written, write
nothing.

### 2. `punch` becomes index-generating only (`commands/transform.py`)

The legacy default (leaf → `00-index.md`, content-as-index) is now illegal — the
index is generated, so content may not live there. Make the `--as-child` shape the
**only** behavior:

- A punch always produces `D/01-{slug}.md` (the content) + `D/00-index.md` (a
  generated index). Remove the non-as-child branch. The `--as-child` flag becomes
  the default; drop the flag or make it a no-op (prefer dropping it and updating the
  parser in `commands/_parser.py`).
- After moving content to `01-{slug}.md`, the content's ref changes from `docXX.YY`
  to `docXX.YY.01` while the new group takes `docXX.YY`. Rewrite inbound references
  from `docXX.YY` → `docXX.YY.01` so existing links point at the content, using the
  existing machinery (`compute_rename_map` from `planning`, `rewrite_refs` from
  `rewriter`, `collect_rewritable_files` from `workspace`) — mirror how
  `structure.py` / existing transforms rewrite refs.
- Call `do_regenerate(rhidoc_root, _load_preamble(rhidoc_root.name))` at the end so
  the new `00-index.md` body is generated and MANIFEST is rebuilt (honor
  `--no-regen` if punch has it; if not, always regenerate).

### 3. `make -g` and `init` stop authoring index bodies

- `structure.py` group creation already calls `do_regenerate` at the end. Verify
  that the seeded `00-index.md` (currently body `# {title}`) ends up regenerated
  into the contract shape. The seed body is fine — regenerate overwrites it. No
  behavior change needed beyond confirming the generated body appears.
- `init` (`commands/setup.py`): the codex `00-index.md` is seeded from
  `rhidoc/templates/00-index.md`, which currently carries NAV prose. Reduce
  `templates/00-index.md` to frontmatter only (`title`, `summary: ""`, `tags: []`,
  `deps: []`) plus a `# {{title}}` heading, and have `cmd_init` call
  `do_regenerate` at the end so the codex index is generated. The orientation prose
  that was in the codex index already has homes in `01-about`/`02-maintenance`/
  `03-conventions`; do not try to relocate it here.

### 4. `hoist` (`commands/transform.py`)

`hoist` dissolves a directory. With the new model the directory's `00-index.md` is
a generated artifact carrying no authored content, so it can be discarded as it
already is (the `--keep-index` path preserves it as a sibling). Confirm hoist still
works: the `01-{slug}.md` content (and other children) lift correctly and refs
rewrite. Adjust only if the generated-index assumption breaks an existing path.

### 5. `ai_skill.py`

Update the help text for `regenerate` (now rewrites every `00-index.md`, not just
MANIFEST), `punch` (always content→`01`, generated index; ref-shift to `.01`), and
the "Index files" behavioral-rules section (index bodies are generated, not
authored).

### 6. Tests

Update existing tests that assert the old punch default, the old seeded index body,
or hand-authored index content. Add tests covering: a generated index body for a
directory with mixed leaf + subgroup children (assert the table rows, `group (N)`
counts, Topics line, and that no subtree data leaks into a subgroup row); punch
producing `01-content` + generated index with inbound refs rewritten to `.01`;
`regenerate` rewriting a nested subgroup's `00-index.md`. Use tmp/fixture
workspaces only.

## Files to Modify

- `rhidoc/regenerate_core.py` — index-body generator + `write_all_indexes`, wired into `do_regenerate`
- `rhidoc/commands/transform.py` — `punch` index-only behavior + ref-shift + regenerate; verify `hoist`
- `rhidoc/commands/_parser.py` — drop/neutralize `--as-child` on punch if removed
- `rhidoc/commands/structure.py` — confirm `make -g` index ends up generated
- `rhidoc/commands/setup.py` — `init` calls `do_regenerate`; codex index generated
- `rhidoc/templates/00-index.md` — reduce to frontmatter + heading only
- `rhidoc/ai_skill.py` — update regenerate / punch / index-files help text
- `tests/` — update broken assertions; add coverage per Plan step 6

## Verification

```bash
make test
```

All tests must pass. Then a manual smoke test against a throwaway workspace (NOT
this repo's `.rhidoc/`):

```bash
tmp=$(mktemp -d) && cd "$tmp" && python -m rhidoc init && python -m rhidoc make 00-codex foo && python -m rhidoc regenerate && cat .rhidoc/00-codex/00-index.md
```

The codex `00-index.md` body should be the generated Contents table + Topics line,
not authored prose.

## Out of Scope

- Migrating real workspaces' index bodies (rhidoc's own `.rhidoc/` and the 13
  external workspaces). Separate follow-up; needs content-preservation judgment.
- Editing any `.rhidoc/` doc (invariants INV-6, conventions, etc.).
- An LLM-synthesized one-line summary for groups. Groups show `—`; only leaf
  summaries are collected.
- Deriving `title` from the slug as the sole source — `title` stays an authored
  frontmatter field on the index (the one fact a slug can't always reconstruct,
  e.g. acronym casing).

## Notes

- The non-recursion constraint is the load-bearing invariant: an index is a strict
  one-level reflection. A subgroup row shows the subgroup's own title and its
  direct-child count, never its descendants. This is what makes the artifact
  immune to staleness and cheap to regenerate (no ordering pass).
- Reviewer watch-points: (1) the punch ref-shift `docXX.YY → docXX.YY.01` — confirm
  inbound links resolve to the content, not the empty group; (2) no double-counting
  of tags in the MANIFEST tag index (index frontmatter `tags` stays `[]`); (3)
  `make test` covers nested subgroups, not just top-level sections.

## Surface after this phase

- `regenerate_core.py` exports an index-body generator and a `write_all_indexes`
  function; `do_regenerate` writes every `00-index.md` body in addition to MANIFEST.
- `00-index.md` bodies are generated artifacts (Contents table of direct children +
  Topics line); their authored frontmatter is `title` only (summary/tags/deps empty).
- `punch` always yields `01-{slug}.md` content + generated `00-index.md`, with
  inbound refs rewritten `docXX.YY → docXX.YY.01`.
- Leaf-doc authoring (title/summary/tags) is unchanged; only index *bodies* changed.
- This repo's own `.rhidoc/` index bodies are NOT migrated and still hold authored
  prose — a downstream migration task must handle them before regenerate is run
  against this workspace.
