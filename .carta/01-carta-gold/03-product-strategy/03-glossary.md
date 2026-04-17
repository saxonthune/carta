---
title: Glossary
summary: Canonical vocabulary: products, workspace, spec, shape
tags: [glossary, terms]
deps: []
---

# Glossary

Canonical definitions for domain terms used throughout Carta. Use these terms consistently — don't invent synonyms.

**AI agent note:** This glossary is intentionally incomplete and grows at the user's pace. If you encounter a concept that needs a term but isn't defined here, do not invent terminology — prompt the user to decide how to name it. Do not extrapolate taxonomy beyond what is explicitly listed.

## Products

A **product** corresponds to a single, distinct thing that a user installs, opens, or runs. Carta has three products:

- **Carta Docs API** — Deterministic Python operations for manipulating `.carta/` workspace documents (create, delete, move, punch, flatten, regenerate). Designed primarily for AI agents. Delivered as an installable CLI (`pip install carta-cli`) or as portable scripts dumped into `.carta/` so the workspace carries its own tooling.
- **Typed Canvas Editor** — VS Code extension for viewing and editing canvas diagrams. Visual modeling of constructs, ports, connections, and organizers.
- **Web Client** — Browser-based spec editor for nontechnical users. Includes conversational AI flows, direct editing, and automatic git operations. (Future — not yet under development.)

These are delivery surfaces for overlapping capabilities, not isolated systems. The same workspace format (`.carta/`) and specification concepts underpin all three.

## Specification Concepts

**Workspace**: A `.carta/` directory containing a project's specifications, documentation, and architecture diagrams. Workspaces follow a standard directory structure (numbered titles) and are the canonical source of truth for a project's design. A workspace can be authored manually, via the visual editor, or via AI agents through MCP.

**Format Spec**: The set of conventions that define a valid `.carta/` workspace — directory structure, file naming, cross-reference syntax, front matter format, and MANIFEST.md structure. The format spec is what `carta init` scaffolds and what tooling validates against.

**Instance**: A specific project's `.carta/` workspace, as opposed to the format spec that defines the structure. Carta's own `.carta/` directory is an instance — it follows the format spec while containing Carta-specific content.

**Shape File**: A specification document with typed YAML frontmatter that describes a module, component, or subsystem. Shape files contain enough structural information (types, interfaces, dependencies, constraints) to drive code generation.

**Cross-Reference**: A `docXX.YY.ZZ` identifier that links between documents in a workspace. Cross-references are rewritten automatically by workspace tools when documents are moved or renumbered.

**MANIFEST.md**: The machine-readable index at the root of a `.carta/` workspace. Contains a table of all documents with their refs, file paths, summaries, tags, and dependency chains. Regenerated from document frontmatter by `carta regenerate`.

**Title**: A numbered directory in a `.carta/` workspace (e.g., `01-product/`, `02-architecture/`). Titles are the primary organizational unit — each groups related documents under a common theme.

## Canvas Concepts

See doc01.02.07 for canvas-specific vocabulary (construct, schema, port, polarity, edge, organizer, LOD band, etc.).

## System Concepts

**Document Adapter**: The interface through which all canvas state operations are performed. The Yjs adapter is the current implementation.

**Configuration**: Two build-time environment variables set by the operator: `VITE_SYNC_URL` (server to connect to; absent = single-document browser mode) and `VITE_AI_MODE` (how AI chat gets credentials: `none`, `user-key`, `server-proxy`). Desktop mode is runtime-detected via Electron API.
