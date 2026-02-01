---
title: "Unified deployment model with build-time feature flags"
status: active
---

# Decision 004: Unified Deployment Model with Build-Time Feature Flags

## Context

Carta previously distinguished between "static mode" (`VITE_STATIC_MODE=true`) and "server mode" as architectural branches. Static mode was a single-document, no-server, no-collaboration experience. Server mode required MongoDB, a collab server, and URL-based document selection. These were treated as fundamentally different app configurations with separate code paths, UI visibility rules, and mental models.

This created several problems:

1. Static mode was artificially limited — single document, no portfolio browsing, no document management
2. The distinction leaked into the architecture (conditional rendering, mode-specific components)
3. Three deployment scenarios (enterprise, solo, SaaS) couldn't be cleanly expressed as either "static" or "server"
4. Adding features required asking "does this work in both modes?" for every change

## Decision

Replace the static/server mode distinction with a unified app model controlled by **build-time feature flags**:

| Flag | Values | Controls |
|------|--------|----------|
| `STORAGE_BACKENDS` | `local`, `server`, `both` | Available storage providers |
| `AI_MODE` | `none`, `user-key`, `server-proxy`, `both` | AI chat configuration |
| `COLLABORATION` | `enabled`, `disabled` | Real-time sync availability |

The app itself has one model: documents live in portfolios, users browse and edit them. Flags gate which capabilities are available in the UI — they are build configuration, not concepts in the app.

## Consequences

- `VITE_STATIC_MODE` is removed entirely
- The app always supports multiple documents and portfolio browsing
- Local storage (IndexedDB) becomes a first-class portfolio backend, not a "degraded mode"
- A document can optionally sync to a server — this is a per-document or per-portfolio property
- The same build can work standalone or connected, depending on configuration
- Auth, billing, and permissions are integration surfaces — Carta provides hooks, consumers implement policy
- MCP availability is determined by platform (browser vs desktop), not by mode
