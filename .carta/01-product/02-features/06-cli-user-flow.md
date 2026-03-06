---
title: CLI User Flow
status: draft
summary: How users install the carta CLI, hydrate a repo, and use it for workspace operations
tags: [cli, workflow, installation, use-case]
deps: [doc01.02.02]
---

# CLI User Flow

Two-phase workflow: hydrate a repo with a `.carta/` workspace, then operate on it.

## Phase 1: Hydrate

A user (or their AI agent) installs the CLI and initializes a workspace in their project.

```
pip install carta-cli
cd my-project
carta init
```

`carta init` creates:
```
my-project/
  .carta/
    workspace.json      <- workspace metadata
    MANIFEST.md         <- auto-generated index (empty)
    00-codex/
      00-index.md       <- how to read this workspace
```

The `.carta/` directory is committed to version control alongside the project's source code.

## Phase 2: Operate

The CLI is a multiplexed command that performs deterministic structural operations on the workspace. Users and AI agents invoke it the same way.

### Common operations

```bash
# Add a new doc
carta create 01-product my-feature --title "My Feature"

# Expand a leaf file into a directory with children
carta punch 01-product/03-my-feature

# Move/reorder a doc
carta move 01-product/03-my-feature 01-product --order 1

# Delete with automatic gap-closing and ref rewriting
carta delete 01-product/02-old-feature

# Dissolve a directory, hoisting children into parent
carta flatten 01-product/03-my-feature

# Rebuild MANIFEST.md from frontmatter
carta regenerate
```

### Workspace discovery

The CLI finds the `.carta/` directory by walking up from the current working directory, similar to how `git` finds `.git/`. An explicit `--workspace` flag overrides this.

```bash
# From anywhere inside the project
carta regenerate

# Explicit path
carta --workspace /path/to/.carta regenerate
```

### AI agent usage

AI agents invoke the same CLI commands. The deterministic nature of structural operations (numbering, gap-closing, ref rewriting) means agents don't need to reason about filesystem bookkeeping — the CLI handles it.

```
Agent reads MANIFEST.md -> understands workspace structure
Agent calls `carta create` -> CLI handles numbering, frontmatter, manifest rebuild
Agent writes doc content -> standard file write
```

## Design Constraints

- **Deterministic**: Same input produces same output. No interactive prompts.
- **Ref-safe**: All structural operations rewrite cross-references in surviving documents.
- **Manifest-synced**: Operations that change structure auto-regenerate MANIFEST.md.
- **Workspace-portable**: The CLI operates on any `.carta/` workspace, not just Carta's own.
