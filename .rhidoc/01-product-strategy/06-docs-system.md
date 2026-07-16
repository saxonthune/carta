---
title: Documentation System
summary: The .rhidoc/ workspace format — hierarchical docs, frontmatter, cross-references, MANIFEST
tags: [docs, workspace, format]
deps: [doc01.01]
---

# Documentation System

The `.rhidoc/` workspace format is Rhidoc's primary product. It defines a standard directory structure for software project specifications that is readable by both humans and AI agents.

## What It Provides

- **Numbered titles**: Directories use `NN-slug/` naming for stable ordering
- **YAML frontmatter**: Each document has typed metadata (title, status, summary, tags, deps)
- **Cross-references**: `docXX.YY.ZZ` syntax for linking between documents, automatically rewritten on structural changes
- **MANIFEST.md**: Machine-readable index regenerated from frontmatter, enabling AI retrieval without reading every file
- **Tag index**: Keyword-to-doc mapping for fast file-path→doc lookup

## Design Principles

1. **Human-first, machine-readable**: Documents are plain Markdown files that read naturally. Frontmatter and cross-references add structure without sacrificing readability.
2. **Stable references**: Document refs survive renames and reordering. The `rhidoc` CLI handles gap-closing and ref rewriting automatically.
3. **Hierarchical organization**: Titles nest arbitrarily deep. A document can be "punched" into a directory when it needs children.
4. **Instance vs format**: The format spec (conventions, structure) is separate from any specific workspace instance. Rhidoc's own `.rhidoc/` is an instance.

## Relationship to Other Features

- **Rhidoc Docs API** (doc01.07.01): Deterministic Python operations for manipulating workspace documents

See the codex (doc00.00 through doc00.06) for usage and conventions, and the docs syntax reference (doc01.10) for the full formal grammar.
