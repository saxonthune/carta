---
title: Deployment Targets
status: active
---

# Deployment Targets

## Data Abstraction

Two levels of data organization:

1. **Portfolio**: A collection of Carta documents. User flows: mental collection for a project, navigating lists of documents, permissions and ownership, descriptions and tagging. Portfolios can be hosted via the filesystem or by a server API.
2. **Carta (document)**: A scoped mental domain. User edits a map and metamap, manipulating instances, schema, and ports.

## Three Deployment Modes

| Deployment | Filesystem portfolio | Server portfolio |
|---|---|---|
| Static PWA | no | no |
| Web client | yes | yes |
| Desktop client | yes | yes |

**Static PWA**: Single-user offline-first. No portfolio, no server. Single document persisted in IndexedDB. Current default for development.

**Web client**: Connects to a server for collaboration, document management, and portfolio browsing. Server is the source of truth.

**Desktop client**: Electron app with both filesystem and server access. Can work offline with local portfolios and sync when connected.

## Server Role

Users connect to a server to: get source of truth, collaborate and share documents and portfolios, access data from multiple devices. A server has many portfolios, and portfolios have many Carta documents.

## AI Access Modes

| Deployment | Chat + API key | Server-managed chat | MCP local | MCP remote |
|---|---|---|---|---|
| Static PWA | yes | no | no | no |
| Web client | yes | yes | no | yes |
| Desktop client | yes | yes | yes | yes |

**Chat + API key**: User provides an OpenRouter key or similar. Requests go directly to AI provider. AI has access to Carta document state.

**Server-managed chat**: User prompts are routed through the server.

**MCP local**: Desktop client can run a local MCP server for AI tool integration (e.g., Claude Code).

**MCP remote**: Server exposes an MCP endpoint for remote AI tool access.

## Monorepo Package Status

| Package | Status |
|---------|--------|
| `@carta/domain` | Done — types, ports, schemas, utils extracted |
| `@carta/compiler` | Done — extracted from `src/constructs/compiler/` |
| `@carta/storage` | Not started — `yjsAdapter.ts` still in `src/stores/`. Portfolio support lands here |
| `@carta/web-client` | Not started — still in root `src/` |
| `@carta/server` | Exists — needs imports updated from stale `@carta/core` to `@carta/domain` + `@carta/compiler` |
| `@carta/desktop` | Future |
| `@carta/cli` | Future |
