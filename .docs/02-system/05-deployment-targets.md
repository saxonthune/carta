---
title: Deployment Targets
status: active
---

# Deployment Targets

## Unified App Model

Carta is one static web application. The same build supports all deployment scenarios — demo sites, personal use, enterprise, SaaS, and desktop. **Build-time configuration** controls which capabilities are pre-wired for a given deployment.

There is no "static mode" vs "server mode." The web client is always a static bundle of HTML/JS/CSS. A server, when present, is a separate backend that the static bundle connects to via REST and WebSocket. Desktop is the same web client loaded in Electron, with an embedded server process.

## Build-Time Configuration

Two environment variables, set by the **operator** (the person deploying Carta):

| Env var | Values | Default | Purpose |
|---------|--------|---------|---------|
| `VITE_SERVER_URL` | URL string or absent | absent | Server to connect to. Presence enables server mode. |
| `VITE_AI_MODE` | `none`, `user-key`, `server-proxy` | `none` | How AI chat gets credentials |

One runtime-detected property:

| Property | Detection | Effect |
|----------|-----------|--------|
| `isDesktop` | `window.electronAPI?.isDesktop` | Auto-sets server URL to embedded server |

Everything else is derived:

| Derived property | Logic |
|------------------|-------|
| `hasServer` | `!!serverUrl` |
| `collaboration` | `hasServer` (WebSocket sync requires a server) |
| `wsUrl` | `serverUrl` with `http` → `ws` |
| `documentBrowser` | `hasServer` (single-document mode otherwise) |

### Why two variables, not three or five

`STORAGE_BACKENDS` and `COLLABORATION` were previously independent flags, but they encoded the same underlying decision: **is there a server?** If a server is present, it handles persistence and enables WebSocket sync. If not, IndexedDB is the only option and collaboration is impossible. The `both` value for storage backends was a developer convenience that leaked complexity into the product model.

The simplified model: if `VITE_SERVER_URL` is set (or desktop auto-detects its embedded server), you have server storage and collaboration. If not, you don't.

`AI_MODE` remains independent because it genuinely varies separately — desktop has a server but uses `user-key`; enterprise has a server and uses `server-proxy`.

## Document Sources

A **document source** is where documents live. The app supports three source types:

| Source | Platform | Persistence | Document listing |
|--------|----------|------------|-----------------|
| **Browser** | Any web browser | IndexedDB | Local registry in IndexedDB |
| **Server** | Any (requires server URL) | Server database | REST API `GET /api/documents` |
| **Folder** | Desktop (Electron) or Chromium (File System Access API) | Filesystem `.carta` files | Directory listing |

### Source availability by deployment

| Deployment | Browser source | Server source | Folder source |
|------------|---------------|---------------|---------------|
| Demo site | Yes (single document) | No | No |
| Solo browser user | Yes (single document) | No | No |
| Enterprise web | No | Yes | No |
| SaaS web | No | Yes | No |
| Desktop (standalone) | No | Yes (embedded) | Yes |
| Desktop (connected) | No | Yes (remote + embedded) | Yes |

### Demo site / solo browser: single-document mode

When no server URL is configured and the app runs in a browser, it operates in **single-document mode** — like Excalidraw. One document auto-created in IndexedDB, no document browser, no multi-document management. The user edits directly.

### Server-connected: multi-document mode

When a server URL is present, the **document browser** is available. Users can list, create, and select documents. The server is the source of truth. IndexedDB may cache the Y.Doc locally for faster loads, but this is an implementation detail — not a user-facing "local storage" option.

## Storage Hosts

A **storage host** is the operator running a Carta server — an enterprise IT department, a SaaS provider, or the embedded server in the desktop app. The storage host controls:

- Where documents are persisted (MongoDB, DynamoDB, S3, filesystem, etc.)
- How documents are organized (folders, tags, projects — via metadata on documents)
- Who can access what (auth, permissions — integration surfaces)
- AI access (API keys, metering, rate limits)

Carta's contract with storage hosts is minimal: "give me documents with optional grouping metadata." The host maps that to their infrastructure. For example, a SaaS provider might use DynamoDB with a `folder` metadata field that the document browser renders as a tree view.

Document grouping (folders, projects, tags) is **document metadata managed by the storage host**, not a first-class concept in Carta's domain model.

## AI Access Modes

| Mode | API Key Source | Request Path | Use Case |
|------|---------------|-------------|----------|
| `none` | — | — | Demo builds, no AI |
| `user-key` | User provides key | Client → AI provider directly | Solo users, desktop app |
| `server-proxy` | Server configured | Client → server → AI provider | Enterprise, SaaS (metered) |

## MCP Access

| Platform | Local MCP | Remote MCP |
|----------|-----------|------------|
| Browser | No (cannot run server process) | Yes (if server available) |
| Desktop | Yes (always — reads local Y.Doc replica) | Yes (if connected to remote server) |

### Desktop MCP architecture

The desktop app separates two concerns that were previously conflated in the embedded server:

1. **MCP server** (always runs locally): Reads the currently-open Y.Doc in memory. Works regardless of where the document came from — local folder or remote server. Provides zero-latency AI tool access.

2. **Document server** (source-dependent): Either the embedded local server (for folder sources) or the remote server (when connected to a storage host). Handles persistence and collaboration sync.

```
Claude Desktop ──stdio──▶ MCP binary ──HTTP──▶ Local MCP Server
                                                    │
                                              reads Y.Doc in memory
                                                    │
                                          ┌─────────┴─────────┐
                                          │                    │
                                    Folder source         Remote server
                                    (embedded server,     (WebSocket sync,
                                     filesystem I/O)       server is SoT)
```

This means an enterprise user can work with server-hosted documents while their local Claude Desktop gets fast MCP access to the locally-synced Y.Doc — no round-trip to the server for AI tool reads.

**MCP auto-discovery:** The MCP server writes `server.json` to `{userData}/` containing its URL and PID. The MCP stdio binary reads this file automatically, enabling zero-config integration with Claude Desktop.

## Deployment Scenarios

| Scenario | `VITE_SERVER_URL` | `VITE_AI_MODE` | `isDesktop` | Behavior |
|----------|-------------------|----------------|-------------|----------|
| Demo site | absent | `none` | false | Single document, browser-only, no AI |
| Solo browser | absent | `user-key` | false | Single document, browser-only, user provides API key |
| Desktop (standalone) | auto (embedded) | `user-key` | true | Multi-document, folder + embedded server, local MCP |
| Desktop (connected) | remote URL | `user-key` | true | Multi-document, remote server + folder + local MCP |
| Enterprise | `https://carta.internal` | `server-proxy` | false | Multi-document, server storage, managed AI |
| SaaS | `https://api.carta.io` | `server-proxy` | false | Multi-document, server storage, metered AI |

See doc03.02.03 (Enterprise), doc03.02.04 (Solo User), doc03.02.05 (SaaS Provider) for detailed use case scenarios.

## Preferences

App preferences (last document, UI settings) are stored via localStorage in the browser and filesystem in the desktop app. The app remembers the most recent document and reopens it on launch.

## Integration Surface

Carta is the **editing platform**. The following concerns are integration surfaces — not built-in features:

- **Authentication**: Enterprise SSO, OAuth, provider accounts — external to Carta
- **Authorization**: Document permissions — Carta provides hooks, consumers implement policy
- **Billing/metering**: Token counting, subscription tiers — provider wraps AI endpoint
- **User management**: Accounts, profiles, teams — external to Carta
- **Document organization**: Folders, tags, projects — metadata managed by the storage host

This boundary keeps the core focused and lets different consumers (enterprise, SaaS, solo) build on top without bloating the platform.

## Monorepo Package Status

| Package | Status |
|---------|--------|
| `@carta/domain` | Done — types, ports, schemas, utils extracted |
| `@carta/document` | Done — Y.Doc operations, Yjs helpers, file format, migrations, level-aware CRUD |
| `@carta/compiler` | Done — compilation engine |
| `@carta/web-client` | Done — extracted to `packages/web-client/` |
| `@carta/server` | Done — collaboration server + MCP server, imports from `@carta/document` |
| `@carta/desktop` | Done — Electron app with embedded document server, MCP bundling |
