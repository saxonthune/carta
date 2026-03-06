---
title: Workspace Scripts
status: active
summary: CLI tools for workspace structure and spec-code reconciliation
tags: [cli, workspace, tools, reconciliation, scripts]
deps: [doc01.02.01]
---

# Workspace Scripts

Command-line tools for managing `.carta/` workspace structure and keeping specifications synchronized with code.

## Structural Operations (carta CLI)

The `carta` CLI manages the physical structure of a workspace:

| Command | Purpose |
|---------|---------|
| `create` | Create a new doc entry with blank frontmatter |
| `delete` | Delete entries with automatic gap-closing and ref rewriting |
| `move` | Move/reorder entries with automatic ref renumbering |
| `punch` | Expand a leaf file into a directory (NN-slug.md → NN-slug/00-index.md) |
| `flatten` | Dissolve a directory, hoisting children into the parent |
| `regenerate` | Rebuild MANIFEST.md from document frontmatter |
| `init` | Initialize workspace.json |

All structural operations maintain cross-reference integrity — refs in surviving documents are rewritten to reflect new positions.

## Reconciliation Scripts

Reconciliation scripts compare workspace specifications against code artifacts, detecting drift and generating patches. The five-stage pipeline:

1. **Extract**: Parse code into an intermediate representation
2. **Compare**: Diff spec shapes against the intermediate
3. **Propose**: Generate patches (spec→code or code→spec)
4. **Apply**: Write changes to the target (code or spec files)
5. **Verify**: Confirm consistency after application

See doc02.02 for the architecture of the script pipeline.
