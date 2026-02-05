---
title: Solo User
status: active
---

# Solo User

## Scenario

A user works on a personal project without a server. They use either the hosted demo/static site or the desktop app.

## Deployment Configuration

### Browser (static site)

| Setting | Value |
|---------|-------|
| `VITE_SERVER_URL` | absent |
| `VITE_AI_MODE` | `none` or `user-key` |

### Desktop app (standalone)

| Setting | Value |
|---------|-------|
| `VITE_SERVER_URL` | auto (embedded server) |
| `VITE_AI_MODE` | `user-key` |

## User Flows

### Browser (Static Site) — Single-Document Mode

- User visits the hosted static site (e.g., `carta.dev`)
- A single document is auto-created in IndexedDB — no document browser, no multi-document management
- User edits directly, like Excalidraw
- If `AI_MODE=user-key`, user can enter an API key for AI chat (requests go directly to provider)
- MCP is not available — browsers cannot run a server process
- User can export `.carta` files for backup or sharing, import files to replace current document

### Desktop App (Standalone)

- User opens the desktop app
- Embedded server provides multi-document management
- User can open `.carta` files from folders on their filesystem
- User provides their own API key for AI chat
- Local MCP server runs automatically for AI tool integration (e.g., Claude Desktop)
- User can also connect to a remote server later if they want collaboration

### Desktop App (Connected to Server)

- User opens the desktop app and connects to a server URL (enterprise, SaaS, or self-hosted)
- Gets multi-document management via the server, plus local folder access
- Local MCP reads the locally-synced Y.Doc — fast access regardless of server latency

## AI Access

`AI_MODE=user-key` means the UI shows an option to enter an API key (OpenRouter, Anthropic, etc.). Requests go directly from the client to the AI provider. No server involvement.

`AI_MODE=none` (demo site) hides AI features entirely.

## MCP

- **Browser**: Not available. MCP requires a server process; browsers cannot spawn one.
- **Desktop**: Always available. The local MCP server reads the currently-open Y.Doc in memory, regardless of whether the document came from a local folder or a remote server.

## Features Used

- doc03.01.01.01 (Canvas) — primary workspace
- doc03.01.01.02 (Constructs) — modeling components
- doc03.01.01.06 (Schema Editor) — custom types
- doc03.01.02.01 (Compilation) — AI-readable output
- doc03.01.02.02 (Import/Export) — backup and sharing
- doc03.01.03.03 (AI Assistant) — user-key chat (optional)
