---
title: Web Platform
status: draft
summary: Web client for nontechnical spec editing — conversational AI and direct editing flows
tags: [web, server, collaboration, git, ai, specs]
deps: [doc01.06.02, doc01.05, doc01.02]
---

# Web Platform

A hosted web client where nontechnical users — product managers, founders, domain experts — browse and edit `.carta/` workspaces through a browser. These users know that specs help build the codebase but aren't expected to understand the codebase itself.

The server handles git operations (commit, push, pull) on the user's behalf. Review steps and merge logic exist, but the user never writes git commands — their work flows into the team's repository through the platform.

## Inspirations

- **VS Code**: Sidebar file tree + editor pane layout, workspace concept
- **Confluence**: Collaborative document editing for nontechnical teams
- **Obsidian**: Markdown-first, local-file-backed, interlinked document navigation

## Two Interaction Flavors

Both flavors operate on the same workspace and the same spec files. Users can switch between them freely within a session. See doc03.04 and doc03.09 for details.

## Interface Structure

- **Sidebar**: File tree showing the `.carta/` workspace, grouped by spec directory. Click to open files.
- **Editor pane**: Markdown editor for the selected spec file. Real-time sync via WebSocket.
- **AI panel**: Chat interface for conversational mode. Contextual to the current file or workspace.

## What the Web Client Does NOT Do

- Require users to understand git, CLI, or the codebase
- Make implicit judgments about how specs should be arranged (see doc01.02, "Spec Agnosticism")
- Gate access by spec level — product-side specs are the common case, but architecture and code-shape specs are accessible too

## Architecture

See doc03.09 for web platform architecture details.
