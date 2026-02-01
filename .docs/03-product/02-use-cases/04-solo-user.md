---
title: Solo User
status: active
---

# Solo User

## Scenario

A user visits the hosted static site or uses the desktop app to work on a personal project. No server involved.

## Deployment Configuration

| Flag | Value |
|------|-------|
| `STORAGE_BACKENDS` | `local` |
| `AI_MODE` | `user-key` |
| `COLLABORATION` | `disabled` |

## User Flows

### Browser (Static Site)

- User visits the hosted static site
- User creates a new document in their portfolio (stored in IndexedDB)
- User provides their own API key for AI chat (requests go directly to provider)
- MCP is not available — browsers cannot run a server process
- User can export `.carta` files for backup or sharing

### Desktop App

- User opens the desktop app
- User creates a new document in a local portfolio (stored on the filesystem, e.g., user's Documents folder)
- User provides their own API key for AI chat
- Desktop app can run a local MCP server for AI tool integration (e.g., Claude Code)
- User can also work with IndexedDB-backed portfolios

## AI Access

`AI_MODE=user-key` means the UI shows an option to enter an API key (OpenRouter, Anthropic, etc.). Requests go directly from the client to the AI provider. No server involvement.

## MCP

- **Browser**: Not available. MCP requires a server process; browsers cannot spawn one.
- **Desktop**: Available. The desktop app runs a local MCP server that reads the local Yjs doc.

## Features Used

- doc03.01.01 (Canvas) — primary workspace
- doc03.01.02 (Constructs) — modeling components
- doc03.01.06 (Schema Editor) — custom types
- doc03.01.07 (Compilation) — AI-readable output
- doc03.01.08 (Import/Export) — backup and sharing
- doc03.01.10 (AI Assistant) — user-key chat (optional)
