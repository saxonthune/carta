---
title: SaaS Provider
status: active
---

# SaaS Provider

## Scenario

A business operates a "Carta provider" — a hosted service where users sign up for accounts. Users get portfolios, can share documents with others at varying access levels, and optionally pay for AI features.

## Deployment Configuration

| Flag | Value |
|------|-------|
| `STORAGE_BACKENDS` | `server` |
| `AI_MODE` | `server-proxy` |
| `COLLABORATION` | `enabled` |

## User Flows

- User signs up for the provider's service
- User creates portfolios and documents; portfolios belong to the user
- User shares portfolios or individual documents with other users (read or edit access)
- Users collaborate in real-time on shared documents
- AI chat is available on higher subscription tiers; the provider meters token usage per user
- Users can connect via the standard desktop app or the provider's web URL
- MCP access via server HTTP endpoint; desktop users also get local MCP

## What Carta Owns vs. What the Provider Builds

### Carta provides (the editing platform):

- Document model, editing, collaboration protocol (Yjs sync)
- Portfolio structure (list, create, delete, metadata)
- AI chat UI that routes to a configurable server endpoint
- MCP server (local and remote)
- Import/export (.carta files)
- Build configuration (feature flags)
- Document-level and portfolio-level permission **hooks** — the server calls out to check "can user X do Y?" but does not implement the policy

### The provider builds (business logic):

- User authentication and accounts (OAuth, SSO, etc.)
- Portfolio ownership and permissions policy
- Billing, token metering, subscription tiers
- Rate limiting and usage dashboards
- Custom branding and onboarding

## AI Access

The provider wraps Carta's AI chat endpoint with their metering layer. When a user sends a prompt, the request flows: Carta UI → provider's API gateway (checks subscription tier, logs tokens) → AI provider (OpenAI, Anthropic, etc.) → response back through the chain.

`AI_MODE=server-proxy` ensures the UI only routes through the server. The provider controls who gets access and how much.

## MCP

Same as enterprise (doc03.02.03): desktop MCP reads local synced doc, remote MCP reads server copy via REST API. The provider can gate MCP access behind their auth layer.

## Integration Surface

Carta is the **editing platform**. Auth, billing, and permissions are integration surfaces, not built-in features. This keeps the core codebase focused and lets providers build differentiated products on top.

## Features Used

- doc03.01.09 (Collaboration) — real-time sync, sharing
- doc03.01.10 (AI Assistant) — server-proxied, metered chat
- doc03.01.01 (Canvas) — primary workspace
- doc03.01.07 (Compilation) — AI-readable output
- doc03.01.08 (Import/Export) — data portability
