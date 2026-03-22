---
title: Workspace Scripts
status: active
summary: CLI tools for managing .carta/ workspace structure — create, delete, move, punch, flatten, regenerate, portable, group, rename
tags: [cli, workspace, tools, scripts]
deps: [doc01.05]
---

# Workspace Scripts

The `carta` CLI manages the physical structure of a `.carta/` workspace. It handles numbering, gap-closing, and cross-reference rewriting so that users and AI agents can focus on content.

All command logic lives in a single `commands.py` module using relative imports. This enables both the installed `carta` CLI and the portable `carta.py` script to share one implementation with no duplication.

## Commands

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
| `copy` | Copy a file into the workspace at a given position |
| `rewrite` | Rewrite doc refs using user-supplied mappings |
| `regenerate` | Rebuild MANIFEST.md from document frontmatter |
| `portable` | Dump editable scripts into workspace for pip-free usage |
| `ai-skill` | Generate comprehensive context for AI agents — command semantics, side effects, sequencing rules, and workspace state |

> **Note:** `migrate-frontmatter` has been removed. It was a one-time operation and is no longer included.

All structural operations maintain cross-reference integrity — refs in surviving documents are rewritten to reflect new positions.

## Scope Boundary

The `carta` CLI is a **workspace structure tool**. It operates on the `.carta/` directory's physical layout — files, directories, numbering, frontmatter, and cross-references.

Spec-code reconciliation — comparing specifications against source code, extracting code shapes, detecting drift — is a separate product concern (doc01.07). The CLI does not parse source code or reason about spec-code alignment.
