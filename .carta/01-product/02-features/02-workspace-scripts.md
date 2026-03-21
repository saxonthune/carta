---
title: Workspace Scripts
status: active
summary: CLI tools for managing .carta/ workspace structure — create, delete, move, punch, flatten, regenerate, portable
tags: [cli, workspace, tools, scripts]
deps: [doc01.02.01]
---

# Workspace Scripts

The `carta` CLI manages the physical structure of a `.carta/` workspace. It handles numbering, gap-closing, and cross-reference rewriting so that users and AI agents can focus on content.

## Commands

| Command | Purpose |
|---------|---------|
| `init` | Initialize a new `.carta/` workspace |
| `create` | Create a new doc entry with blank frontmatter |
| `delete` | Delete entries with automatic gap-closing and ref rewriting |
| `move` | Move/reorder entries with automatic ref renumbering |
| `punch` | Expand a leaf file into a directory (NN-slug.md → NN-slug/00-index.md) |
| `flatten` | Dissolve a directory, hoisting children into the parent |
| `copy` | Copy a file into the workspace at a given position |
| `rewrite` | Rewrite doc refs using user-supplied mappings |
| `regenerate` | Rebuild MANIFEST.md from document frontmatter |
| `portable` | Dump editable scripts into workspace for pip-free usage |

All structural operations maintain cross-reference integrity — refs in surviving documents are rewritten to reflect new positions.

## Scope Boundary

The `carta` CLI is a **workspace structure tool**. It operates on the `.carta/` directory's physical layout — files, directories, numbering, frontmatter, and cross-references.

Spec-code reconciliation — comparing specifications against source code, extracting code shapes, detecting drift — is a separate product concern (doc01.02.07). The CLI does not parse source code or reason about spec-code alignment.
