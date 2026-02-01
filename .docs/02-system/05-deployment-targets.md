---
title: Deployment Targets
status: active
---

# Deployment Targets

## Unified App Model

Carta has one unified application model. The app always works the same way: documents live in portfolios, users browse and edit documents, collaboration and AI are available. **Build-time feature flags** control which capabilities are enabled for a given deployment — they gate UI and functionality, not architectural branches.

There is no "static mode" vs "server mode" as distinct app concepts. The same codebase supports all deployment scenarios.

## Build-Time Feature Flags

| Flag | Values | Default | Controls |
|------|--------|---------|----------|
| `STORAGE_BACKENDS` | `local`, `server`, `both` | `both` | Which portfolio/storage providers are available |
| `AI_MODE` | `none`, `user-key`, `server-proxy`, `both` | `both` | How AI chat is configured |
| `COLLABORATION` | `enabled`, `disabled` | `enabled` | Whether real-time sync UI is available |

These are build configuration settings, not concepts in the app itself. The underlying code is identical — flags just hide UI elements and disable capability paths.

## Data Abstraction

Two levels of data organization:

1. **Portfolio**: A collection of Carta documents. User flows: browsing documents, creating/deleting, permissions and ownership, descriptions and tagging. Portfolios can be backed by IndexedDB (browser), the filesystem (desktop), or a server API.
2. **Carta (document)**: A scoped mental domain. User edits a map and metamap, manipulating instances, schemas, and ports.

## Storage Backends

| Backend | Platform | Persistence | Portfolio Browsing |
|---------|----------|------------|-------------------|
| IndexedDB | Browser | Local, per-browser | List/create/delete local docs |
| Filesystem | Desktop (Electron) | Local, user's filesystem | Browse `.carta` files in a directory |
| Server API | Any | Server database (MongoDB) | REST API for doc management |

When `STORAGE_BACKENDS=both`, the document browser shows documents from all available backends with labels indicating where each lives. When set to `local` or `server`, only that backend's documents appear.

## AI Access Modes

| Mode | API Key Source | Request Path | Use Case |
|------|---------------|-------------|----------|
| `none` | — | — | Demo builds, no AI |
| `user-key` | User provides key | Client → AI provider directly | Solo users, personal use |
| `server-proxy` | Server configured | Client → server → AI provider | Enterprise, SaaS (metered) |
| `both` | Either | Both paths available | Full-featured builds |

## MCP Access

| Platform | Local MCP | Remote MCP |
|----------|-----------|------------|
| Browser | No (cannot run server process) | Yes (if server available) |
| Desktop | Yes (local Yjs doc) | Yes (if server available) |

Local MCP reads the local Yjs document (synced via CRDT). Remote MCP reads the server's copy via REST API. Both return the same data in practice — Yjs guarantees convergence.

## Deployment Scenarios

| Scenario | `STORAGE_BACKENDS` | `AI_MODE` | `COLLABORATION` | Details |
|----------|--------------------|-----------|-----------------|---------|
| Demo site | `local` | `none` | `disabled` | Simplest deployment, no server needed |
| Personal use | `local` | `user-key` | `disabled` | Solo user, own API key |
| Enterprise | `server` | `server-proxy` | `enabled` | All docs on server, managed AI |
| SaaS provider | `server` | `server-proxy` | `enabled` | Multi-tenant, metered AI |
| Full (development) | `both` | `both` | `enabled` | Everything available |

See doc03.02.03 (Enterprise), doc03.02.04 (Solo User), doc03.02.05 (SaaS Provider) for detailed use case scenarios.

## Preferences

App preferences (last portfolio, last document, UI settings) are stored via an abstract `PreferencesProvider` interface:

| Platform | Implementation |
|----------|---------------|
| Browser | localStorage |
| Desktop | Filesystem (user config directory) |

The app remembers the most recent portfolio and document, and opens them automatically on launch.

## Integration Surface

Carta is the **editing platform**. The following concerns are integration surfaces — not built-in features:

- **Authentication**: Enterprise SSO, OAuth, provider accounts — external to Carta
- **Authorization**: Document/portfolio permissions — Carta provides hooks, consumers implement policy
- **Billing/metering**: Token counting, subscription tiers — provider wraps AI endpoint
- **User management**: Accounts, profiles, teams — external to Carta

This boundary keeps the core focused and lets different consumers (enterprise, SaaS, solo) build on top without bloating the platform.

## Monorepo Package Status

| Package | Status |
|---------|--------|
| `@carta/domain` | Done — types, ports, schemas, utils extracted |
| `@carta/document` | Done — Y.Doc operations, Yjs helpers, file format, migrations, level-aware CRUD |
| `@carta/compiler` | Done — compilation engine |
| `@carta/web-client` | Done — extracted to `packages/web-client/` |
| `@carta/server` | Done — collaboration server + MCP server, imports from `@carta/document` |
| `@carta/desktop` | Future |
