---
title: Enterprise Self-Hosted
status: active
---

# Enterprise Self-Hosted

## Scenario

An enterprise hosts an internal Carta server for all employees. Users connect via the official desktop app or a company-hosted web URL.

## Deployment Configuration

| Flag | Value |
|------|-------|
| `STORAGE_BACKENDS` | `server` |
| `AI_MODE` | `server-proxy` |
| `COLLABORATION` | `enabled` |

The enterprise disables local storage — all documents live on the server. AI chat is routed through the server, which proxies to the enterprise's AI provider (e.g., AWS Bedrock). The UI does not offer a "use your own key" option.

## User Flows

- User opens the desktop app or navigates to the company URL
- User browses server-hosted portfolios and documents
- User creates or opens a document; collaboration is automatic with other connected users
- User uses AI chat, which routes through the server to Bedrock — no API key needed
- User's desktop app runs a local MCP server for AI tool integration (reads the local Yjs doc, which syncs with the server)
- Remote MCP server reads the server's copy of the document directly via REST API

## AI Access

The enterprise configures their server with Bedrock credentials. The `AI_MODE=server-proxy` flag means the web UI only shows the server-managed chat option. Users never see or provide API keys.

**Can the enterprise block employees from using outside AI?** Not technically — nothing stops someone from copy-pasting into ChatGPT. But the Carta UI simply doesn't offer a "bring your own key" option when `AI_MODE=server-proxy`. This is a UX boundary, not a security guarantee.

## MCP

Two paths, same document:

- **Desktop MCP** (local): Reads the local Yjs doc, which is synced with the server via CRDT. Works offline with unsynced changes.
- **Remote MCP** (server HTTP): Reads the server's copy directly via REST API. Preferred for AI assistants that are online, since the server copy is canonical.

Both paths return the same data in practice — Yjs guarantees convergence. The only divergence window is when a user is offline with unsynced local changes.

## Features Used

- doc03.01.09 (Collaboration) — real-time sync via server
- doc03.01.10 (AI Assistant) — server-proxied chat
- doc03.01.01 (Canvas) — primary workspace
- doc03.01.07 (Compilation) — AI-readable output
