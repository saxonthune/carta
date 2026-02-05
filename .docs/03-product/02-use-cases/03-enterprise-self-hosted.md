---
title: Enterprise Self-Hosted
status: active
---

# Enterprise Self-Hosted

## Scenario

An enterprise hosts an internal Carta server (the **storage host**) for all employees. Users connect via the official desktop app or a company-hosted web URL.

## Deployment Configuration

| Setting | Value |
|---------|-------|
| `VITE_SERVER_URL` | `https://carta.internal` (company's server) |
| `VITE_AI_MODE` | `server-proxy` |

The server handles document persistence, collaboration sync, and AI proxying. The enterprise chooses their backing store (MongoDB, DynamoDB, etc.) and AI provider (AWS Bedrock, Azure OpenAI, etc.).

## User Flows

### Web client

- User navigates to the company URL (e.g., `https://carta.internal`)
- Auth is handled by the enterprise's SSO/OAuth layer (integration surface)
- Document browser shows server-hosted documents, organized by whatever grouping the storage host provides (folders, tags, projects — all metadata on documents)
- User creates or opens a document; collaboration is automatic with other connected users
- AI chat routes through the server to the enterprise's AI provider — no API key needed

### Desktop app

- User opens the desktop app and connects to the company server URL
- Same document browser and collaboration as the web client
- **Local MCP**: Desktop runs a local MCP server that reads the locally-synced Y.Doc — zero-latency AI tool access for Claude Desktop, even when working with server-hosted documents
- **Remote MCP**: Server also exposes MCP via REST API for AI assistants that are online

### Why local MCP matters for enterprise

An enterprise user working with server-hosted documents still benefits from local MCP. The desktop app syncs the Y.Doc locally via Yjs CRDT. The local MCP server reads this replica, providing:
- Fast reads without server round-trips
- Offline access to the last-synced state
- Same data as the server (Yjs guarantees convergence)

The only divergence window is when a user is offline with unsynced local changes.

## Document Organization

The enterprise's storage host manages document organization — not Carta. The server might organize documents by team, project, or folder. This is metadata on documents (e.g., `folder: "/Team Alpha/Q1 Planning"`), rendered by Carta's document browser as a navigable structure.

## AI Access

The enterprise configures their server with AI provider credentials. `AI_MODE=server-proxy` means the UI only shows the server-managed chat option. Users never see or provide API keys.

**Can the enterprise block employees from using outside AI?** Not technically — the Carta UI simply doesn't offer a "bring your own key" option. This is a UX boundary, not a security guarantee.

## Features Used

- doc03.01.03.02 (Collaboration) — real-time sync via server
- doc03.01.03.03 (AI Assistant) — server-proxied chat
- doc03.01.01.01 (Canvas) — primary workspace
- doc03.01.02.01 (Compilation) — AI-readable output
