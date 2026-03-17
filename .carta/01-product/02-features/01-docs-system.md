---
title: Documentation System
status: active
summary: The .carta/ workspace format — hierarchical docs, frontmatter, cross-references, MANIFEST
tags: [docs, workspace, format]
deps: [doc01.01.01]
---

# Documentation System

The `.carta/` workspace format is Carta's primary product. It defines a standard directory structure for software project specifications that is readable by both humans and AI agents.

## What It Provides

- **Numbered titles**: Directories use `NN-slug/` naming for stable ordering
- **YAML frontmatter**: Each document has typed metadata (title, status, summary, tags, deps)
- **Cross-references**: `docXX.YY.ZZ` syntax for linking between documents, automatically rewritten on structural changes
- **MANIFEST.md**: Machine-readable index regenerated from frontmatter, enabling AI retrieval without reading every file
- **Tag index**: Keyword-to-doc mapping for fast file-path→doc lookup

## Design Principles

1. **Human-first, machine-readable**: Documents are plain Markdown files that read naturally. Frontmatter and cross-references add structure without sacrificing readability.
2. **Stable references**: Document refs survive renames and reordering. The `carta` CLI handles gap-closing and ref rewriting automatically.
3. **Hierarchical organization**: Titles nest arbitrarily deep. A document can be "punched" into a directory when it needs children.
4. **Instance vs format**: The format spec (conventions, structure) is separate from any specific workspace instance. Carta's own `.carta/` is an instance.

## Relationship to Other Features

- **Workspace Scripts** (doc01.02.02): CLI tools that manage workspace structure
- **VS Code Extension** (doc01.02.03): Visual browsing and editing of workspace documents
- **Canvas** (doc01.02.04): Visual editor that can embed diagrams as `.canvas.json` files within the workspace

See the 00-codex title for the full format specification (doc00.01 through doc00.06).
