---
title: Workspace Tools
status: draft
summary: Operations for managing .carta/ workspace structure
tags: workspace, tools, cli, manifest
deps: []
---

# Workspace Tools

> Operations for managing `.carta/` workspace structure — moving, renaming, restructuring, and regenerating the manifest.

These tools live in `.carta/utils/` and operate on the numbered directory/file convention (`NN-slug`). All structural operations rewrite cross-references (`docXX.YY`) across the workspace.

**Unified CLI**: All workspace operations are available via a single `carta` entry point. An AI agent discovers all operations with `python3 .carta/utils/carta --help`.

```bash
python3 .carta/utils/carta --help            # list all commands
python3 .carta/utils/carta <command> --help  # command-specific help
```

## Operations

### move

Move and/or rename a doc entry. Combines relocation and slug renaming in a single operation, like `mv`.

```
carta move <source> <destination> [--order N] [--rename <slug>] [--dry-run]
```

**Capabilities**:
- Move an entry to a different parent directory (cross-dir)
- Reorder an entry within its current directory (same-dir)
- Rename an entry's slug without moving it (`--rename` only)
- Combined move + rename in one operation

**Mechanics**:
- Bumps destination siblings to make room at the insertion point
- Gap-closes source siblings to fill the vacated slot
- Rewrites all `docXX.YY` refs across the workspace

**Examples**:
```bash
carta move doc01.02.01 doc01 --order 2           # promote modeling into product at position 2
carta move doc01.02.01 . --rename diagramming    # rename slug in place
carta move doc01.02.01 doc01 --order 2 --rename diagramming  # move + rename
carta move doc01.02 . --order 5                  # reorder within same directory
```

**Status**: Implemented (`carta move`).

### punch

Turn a leaf file into a directory, expanding the tree. The original file's content becomes the `00-index.md` of the new directory.

```
punch <source> [--dry-run]
```

Named because you're punching a hole in the flat surface and expanding into a new dimension of depth.

**Mechanics**:
1. `NN-slug.md` becomes `NN-slug/00-index.md`
2. Content is preserved as the new directory's index
3. The doc ref (`docXX.YY`) remains stable — it now resolves to a directory instead of a file
4. Child refs (`docXX.YY.01`, etc.) become available for new entries

**Example**:
```bash
carta punch doc01.02.01.01    # 01-canvas.md → 01-canvas/00-index.md
```

**Status**: Implemented (`carta punch`).

### flatten

Remove an intermediary directory, hoisting its children into the parent. The inverse of `punch`.

```
flatten <source> [--keep-index] [--at <position>] [--dry-run]
```

Named for the most common programming term for reducing nesting by one level.

**Open design decisions**:

**00-index handling**: When flattening a directory, what happens to its `00-index.md`?
- `--keep-index`: Demote the index to a regular numbered file in the parent (preserves content, needs a slot)
- Default (discard): The index is deleted. Appropriate when the index was boilerplate. Risky if it contained meaningful content.
- Possible safety measure: refuse to discard if the index exceeds some line threshold, require `--force` or `--keep-index`

**Insertion position**: Where do the hoisted children land among existing parent siblings?
- `--at N`: Insert starting at position N (bumps existing siblings)
- Default: The flattened directory occupied slot M. Its children replace it starting at M, bumping later siblings. This preserves the "position in the story" of the content.
- Alternative default: Append to end (safest, no renumbering of existing siblings)

**Renumbering**: Children arrive with their own `NN-` prefixes which are meaningless in the new context. All children get renumbered sequentially starting from the insertion position.

**Example**:
```bash
carta flatten doc01.02               # dissolve features/, promote children into product
carta flatten doc01.02 --keep-index  # same, but 00-index.md becomes a numbered sibling
carta flatten doc01.02 --at 5        # append children starting at position 5
```

**Status**: Stub only (`carta flatten` exists but exits with error).

### regenerate

Rebuild MANIFEST.md from the filesystem and doc frontmatter. The manifest becomes a derived artifact — no hand-editing needed.

```
regenerate [--dry-run]
```

**Motivation**: The manifest currently contains data that must be kept in sync with docs manually. When `move`/`punch`/`flatten` restructure the tree, section headers go stale, rows end up under wrong sections, and the tag index drifts. Making the manifest fully generated eliminates this entire class of bugs and removes MANIFEST.md rewriting from every structural operation.

**How it works**:
1. Walk the `.carta/` directory tree in sorted order
2. For each `.md` file with a numeric prefix, read its YAML frontmatter
3. Compute the doc ref from the filesystem path
4. Compute the file path relative to the title directory
5. Emit the MANIFEST table, with section headers derived from `00-index.md` titles
6. Emit the tag index (inverted index of all per-doc tags)

**Frontmatter schema**: Each doc provides its own manifest metadata:

```yaml
---
title: Canvas
status: active
summary: Pan, zoom, LOD rendering, node manipulation
tags: canvas, lod, zoom
deps: [doc02.07]
---
```

| Field | Required | Source | Notes |
|-------|----------|--------|-------|
| `title` | yes | already exists | Used for section headers (from 00-index files) |
| `status` | yes | already exists | `active`, `draft`, `archived`, `implemented` |
| `summary` | yes | **new** | One-line description. Currently only in MANIFEST. |
| `tags` | yes | partially exists | Keywords for retrieval. Some research docs have this already. |
| `deps` | no | **new** | List of doc refs to check when this doc changes. Use `[]` or omit for none. |

**Section headers**: Generated from `00-index.md` files. Each title directory's index provides the `title` field, which becomes the `## NN-slug — {title}` header in the manifest. Subsection headers (`###`) come from subdirectory index files.

**Tag index**: Generated by inverting the per-doc `tags` fields. Each unique tag maps to the list of doc refs that declare it. Sorted alphabetically.

**What this changes for other operations**:
- `move`, `punch`, `flatten` no longer need to parse or rewrite MANIFEST.md
- They only need to: (1) move files, (2) rewrite `docXX.YY` refs in prose
- After any structural change, run `regenerate` to rebuild the manifest
- Or configure it as a pre-commit hook

**Example**:
```bash
carta regenerate              # rebuild MANIFEST.md from frontmatter
carta regenerate --dry-run    # print what would be generated without writing
```

**Status**: Implemented (`carta regenerate`).

## Frontmatter migration

To enable `regenerate`, every doc needs the full frontmatter schema. Current state:

| Field | Coverage | Migration needed |
|-------|----------|-----------------|
| `title` | ~100% of docs | None |
| `status` | ~100% of docs | None |
| `summary` | 0% — only in MANIFEST | Copy from MANIFEST into each doc |
| `tags` | ~10% — only some research docs | Copy from MANIFEST into each doc |
| `deps` | 0% — only in MANIFEST | Copy from MANIFEST into each doc |

This migration can itself be scripted: parse MANIFEST.md, match each row's ref to a filesystem path, inject `summary`, `tags`, and `deps` into that file's frontmatter.

## Planned workflow

Using these operations to complete the product restructuring:

```bash
# Rename feature groups to match the three first-class features
carta move doc01.02.01 . --rename diagramming    # modeling → diagramming
carta move doc01.02.02 . --rename standard       # output → standard
carta move doc01.02.03 . --rename hosted         # environment → hosted

# Move orphan features out of hosted before flatten
carta move doc01.02.03.03 doc01.02               # ai-assistant → features level
carta move doc01.02.03.04 doc01.02               # theming → features level
carta move doc01.02.03.05 doc01.02               # NUX → features level
carta move doc01.02.03.06 doc01.02               # keyboard → features level

# Flatten the features intermediary
carta flatten doc01.02                           # promote everything into 01-product

# Regenerate manifest from the new structure
carta regenerate
```
