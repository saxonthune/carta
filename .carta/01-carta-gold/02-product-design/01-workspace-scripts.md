---
title: Carta Docs API — Design
status: active
summary: Design details for the Carta Docs API — command semantics, delivery mechanisms, scope boundary
tags: [docs-api, workspace, tools, scripts]
deps: [doc01.03.06.01]
---

# Carta Docs API — Design

Design details for the Carta Docs API (doc01.03.06.01). For product description and motivation, see doc01.03.06.01.

## Command Semantics

All command logic lives in a single `commands.py` module using relative imports. This enables both the installed `carta` CLI and the portable `carta.py` script to share one implementation with no duplication.

| Command | Purpose |
|---------|---------|
| `init` | Initialize a new `.carta/` workspace |
| `create` | Create a new doc entry with blank frontmatter |
| `delete` | Delete entries with automatic gap-closing and ref rewriting |
| `move` | Move/reorder entries with automatic ref renumbering. `--no-regen` skips MANIFEST regeneration. |
| `group` | Create a new numbered group directory with `00-index.md` |
| `rename` | Rename a directory or file slug in-place without changing its position. `--no-regen` skips MANIFEST regeneration. |
| `punch` | Expand a leaf file into a directory (NN-slug.md → NN-slug/00-index.md) |
| `flatten` | Dissolve a directory, hoisting children into the parent |
| `attach` | Attach a non-md file as a sidecar to an existing doc, giving it the doc's numeric prefix |
| `copy` | Copy a file into the workspace at a given position |
| `rewrite` | Rewrite doc refs using user-supplied mappings |
| `regenerate` | Rebuild MANIFEST.md from document frontmatter |
| `portable` | Dump editable scripts into workspace for pip-free usage |
| `ai-skill` | Generate comprehensive context for AI agents — command semantics, side effects, sequencing rules, and workspace state |
| `cat` | Print document contents to stdout by doc ref or relative path |

All structural operations maintain cross-reference integrity — refs in surviving documents are rewritten to reflect new positions.

## Bundles

A **bundle** is the set of siblings in a directory that share a numeric prefix (`NN`). The bundle root is the `NN-<slug>.md` file; attachments are all other `NN-*.<ext>` siblings.

Every structural operation (`move`, `delete`, `rename`, `punch`, `flatten`) operates on bundles as a unit — the root and all its attachments travel together without requiring explicit declaration.

Scope: the Docs API owns the bundle as a structural unit. Kind-awareness and content interpretation of attachment files are reconciliation's concern (doc01.03.07).

## Scope Boundary

The Docs API operates on the `.carta/` directory's physical layout — files, directories, numbering, frontmatter, and cross-references.

Spec-code reconciliation — comparing specifications against source code, extracting code shapes, detecting drift — is a separate product concern (doc01.03.07). The Docs API does not parse source code or reason about spec-code alignment.
