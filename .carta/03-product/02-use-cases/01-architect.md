---
title: Software Architect
status: active
---

# Software Architect

## Persona

A software architect designing a new system or documenting an existing one. Works in a repository with a `.carta/` workspace. Wants to produce structured specifications that AI tools can consume to generate code.

## Goals

- Visually lay out system components and their relationships on canvases
- Define custom construct types (schemas) that match the project's domain
- Organize specifications into groups (directories) by concern or abstraction level
- Compile the architecture into AI-readable output
- Iterate on the design as requirements evolve, versioning with git

## Workflow

- Runs `carta serve .` in their project repository
- Opens `http://localhost:51234` in a browser
- Creates spec groups (directories) for different concerns: `01-domain-model/`, `02-api-contract/`, etc.
- Creates canvases within groups, adds constructs, connects them
- AI agents (Claude Code, Cursor) read `.carta/` files directly for context
- Uses the AI sidebar for canvas-aware chat and MCP tool access
- Compiles canvases to AI-readable output for code generation
- Commits changes with git alongside source code

## Features Used

- doc03.01.01.01 (Canvas) — primary workspace
- doc03.01.01.02 (Constructs) — modeling software components
- doc03.01.01.03 (Ports and Connections) — defining relationships
- doc03.01.01.06 (Schema Editor) — creating domain-specific construct types
- doc03.01.02.01 (Compilation) — producing AI-consumable output
- doc03.01.03.03 (AI Assistant) — sidebar chat, MCP tools
