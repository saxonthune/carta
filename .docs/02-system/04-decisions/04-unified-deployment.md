---
title: "Simplified deployment configuration"
status: active
supersedes: "Unified deployment model with build-time feature flags (original)"
---

# Decision 004: Simplified Deployment Configuration

## Context

Carta previously used three independent build-time feature flags:

| Flag | Values |
|------|--------|
| `STORAGE_BACKENDS` | `local`, `server`, `both` |
| `AI_MODE` | `none`, `user-key`, `server-proxy`, `both` |
| `COLLABORATION` | `enabled`, `disabled` |

This created a 3×4×2 matrix of 24 theoretical combinations, most of which were nonsensical. `STORAGE_BACKENDS` and `COLLABORATION` encoded the same underlying decision — **is there a server?** — with false independence. Having `collaboration=enabled` without a server is meaningless. Having `storageBackends=local` with `collaboration=enabled` is contradictory. The `both` value on storage backends was a developer convenience that leaked complexity into the product model and created a confusing "Local" vs "Server" document list in the browser.

The "portfolio" concept (a collection of documents as a first-class domain object) added further confusion. In practice, document organization is the concern of the storage host (folders, tags, projects as metadata), not Carta's domain model.

## Decision

Replace three flags with two environment variables:

| Env var | Values | Default | Purpose |
|---------|--------|---------|---------|
| `VITE_SERVER_URL` | URL string or absent | absent | Server to connect to. Presence = server mode. |
| `VITE_AI_MODE` | `none`, `user-key`, `server-proxy` | `none` | How AI chat gets credentials |

Desktop mode (`isDesktop`) is runtime-detected and auto-sets the server URL to the embedded server.

Everything else is derived:
- `hasServer` = `!!serverUrl`
- `collaboration` = `hasServer`
- `wsUrl` = `serverUrl` with `http` → `ws`
- `documentBrowser` = `hasServer`

Drop the `both` value from AI_MODE. Drop the "portfolio" concept entirely — document grouping is metadata managed by the storage host.

## Consequences

- The app has two modes: **single-document** (no server, browser-only) and **multi-document** (server present, document browser available)
- `VITE_STATIC_MODE`, `STORAGE_BACKENDS`, and `COLLABORATION` are all removed
- No "portfolio" in the domain model — document organization is the storage host's concern
- Desktop MCP server is separated from document server — MCP always reads local Y.Doc replica regardless of document source
- The same web build can work standalone or connected, depending on whether a server URL is configured
- Auth, billing, permissions, and document organization remain integration surfaces
