---
title: Glossary
summary: Canonical vocabulary: products, workspace, spec, shape
tags: [glossary, terms]
deps: []
---

# Glossary

Canonical definitions for domain terms used throughout Rhidoc. Use these terms consistently — don't invent synonyms.

**AI agent note:** This glossary is intentionally incomplete and grows at the user's pace. If you encounter a concept that needs a term but isn't defined here, do not invent terminology — prompt the user to decide how to name it. Do not extrapolate taxonomy beyond what is explicitly listed.

## Products

A **product** corresponds to a single, distinct thing that a user installs, opens, or runs.

- **Rhidoc Docs API** — Deterministic Python operations for manipulating `.rhidoc/` workspace documents (create, delete, move, punch, flatten, regenerate). Designed primarily for AI agents. Delivered as an installable CLI (`pip install rhidoc`) or as portable scripts dumped into `.rhidoc/` so the workspace carries its own tooling.

## Specification Concepts

**Workspace**: A `.rhidoc/` directory containing a project's specifications and documentation. Workspaces follow a standard directory structure (numbered titles) and are the canonical source of truth for a project's design. A workspace can be authored manually or via AI agents.

**Format Spec**: The set of conventions that define a valid `.rhidoc/` workspace — directory structure, file naming, cross-reference syntax, front matter format, and MANIFEST.md structure. The format spec is what `rhidoc init` scaffolds and what tooling validates against.

**Instance**: A specific project's `.rhidoc/` workspace, as opposed to the format spec that defines the structure. Rhidoc's own `.rhidoc/` directory is an instance — it follows the format spec while containing Rhidoc-specific content.

**Shape File**: A specification document with typed YAML frontmatter that describes a module, component, or subsystem. Shape files contain enough structural information (types, interfaces, dependencies, constraints) to drive code generation.

**Cross-Reference**: A `docXX.YY.ZZ` identifier that links between documents in a workspace. Cross-references are rewritten automatically by workspace tools when documents are moved or renumbered.

**MANIFEST.md**: The machine-readable index at the root of a `.rhidoc/` workspace. Contains a table of all documents with their refs, file paths, summaries, tags, and dependency chains. Regenerated from document frontmatter by `rhidoc regenerate`.

**Title**: A numbered directory in a `.rhidoc/` workspace (e.g., `01-product/`, `02-architecture/`). Titles are the primary organizational unit — each groups related documents under a common theme.

**Slug**: The human-readable name segment in a file or directory entry, following the `NN-` prefix — for example, `mission` in `01-mission.md`. Slugs are descriptive text only and play no role in addressing: a doc reference (`docXX.YY`) is derived from the `NN` prefix alone. Renaming a slug never changes a reference. Distinct from **Title** (the numbered directory grouping docs by theme) and from the **`title`** frontmatter field (the display name stored inside the file's YAML front matter).

