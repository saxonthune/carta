---
title: Solo User
status: active
---

# Solo User

## Scenario

A user exploring Carta without a repository or server. Two paths: the browser playground for quick experimentation, or a local workspace for real projects.

## Browser Playground (Demo Site)

| Setting | Value |
|---------|-------|
| `VITE_SYNC_URL` | absent |
| `VITE_AI_MODE` | `none` or `user-key` |

- User visits the hosted site (e.g., `carta.dev`)
- A single canvas is auto-created in IndexedDB — no workspace features, no navigator, no spec groups
- User edits directly, like Excalidraw
- If `AI_MODE=user-key`, user can enter an API key for AI chat
- User can export `.carta` files for backup or sharing
- MCP is not available — browsers cannot run a server process

This is the "try it" experience. No setup, no git, no server. One canvas to see what Carta does.

## Local Workspace

| Setting | Value |
|---------|-------|
| `VITE_SYNC_URL` | `http://localhost:51234` |
| `VITE_AI_MODE` | `user-key` |

- User runs `carta init` in a project directory, then `carta serve .`
- Opens `http://localhost:51234` in a browser
- Full workspace: spec groups, multiple canvases, schemas, AI sidebar
- Versions changes with git
- AI agents (Claude Code, Cursor) read `.carta/` files directly

This is the same architecture as the Software Architect (doc03.02.01) and Team Workspace (doc03.02.03) use cases, just single-user.

## Features Used

- doc03.01.01.01 (Canvas) — primary workspace
- doc03.01.01.02 (Constructs) — modeling components
- doc03.01.01.06 (Schema Editor) — custom types
- doc03.01.02.01 (Compilation) — AI-readable output
- doc03.01.02.02 (Import/Export) — backup and sharing (playground mode)
- doc03.01.03.03 (AI Assistant) — user-key chat (optional)
