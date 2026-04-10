---
title: Carta Docs API
status: active
summary: Deterministic Python operations on .carta/ workspace documents — designed primarily for AI agents
tags: [docs-api, workspace, tools, scripts, ai]
deps: [doc01.03.05]
---

# Carta Docs API

The Carta Docs API is a set of deterministic Python operations for manipulating `.carta/` workspace documents. It is designed primarily for AI agents — providing reliable, scriptable workspace mutations that agents can call without ambiguity.

## Operations

| Operation | What it does |
|-----------|-------------|
| `init` | Initialize a new `.carta/` workspace |
| `create` | Create a new doc entry with blank frontmatter |
| `delete` | Delete entries with automatic gap-closing and ref rewriting |
| `move` | Move/reorder entries with automatic ref renumbering |
| `group` | Create a new numbered group directory with `00-index.md` |
| `rename` | Rename a directory or file slug without changing position |
| `punch` | Expand a leaf file into a directory (NN-slug.md → NN-slug/00-index.md) |
| `flatten` | Dissolve a directory, hoisting children into parent |
| `copy` | Copy a file into the workspace at a given position |
| `rewrite` | Rewrite doc refs using user-supplied mappings |
| `regenerate` | Rebuild MANIFEST.md from document frontmatter |
| `cat` | Print document contents to stdout by doc ref |

All structural operations maintain cross-reference integrity — refs in surviving documents are rewritten to reflect new positions.

## Delivery

The API is delivered two ways:

- **`pip install carta-cli`** — Installed CLI (`carta create`, `carta move`, etc.)
- **`carta portable`** — Dumps raw, editable Python scripts into `.carta/` so the workspace carries its own tooling with no external installation

Both invoke the same `commands.py` implementation. The portable form is the default for new workspaces — it embodies the right-to-repair principle (doc01.03.01).

## Scope Boundary

The Docs API operates on workspace structure — files, directories, numbering, frontmatter, and cross-references. Spec-code reconciliation (doc01.03.07) is a separate concern that may *use* the Docs API but is not part of it.
