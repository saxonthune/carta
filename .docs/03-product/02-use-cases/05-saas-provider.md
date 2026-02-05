---
title: SaaS Provider
status: active
---

# SaaS Provider

## Scenario

A business operates a Carta **storage host** — a hosted service where users sign up for accounts. Users get documents, can share them with others at varying access levels, and optionally pay for AI features.

## Deployment Configuration

| Setting | Value |
|---------|-------|
| `VITE_SERVER_URL` | `https://api.carta.io` (provider's server) |
| `VITE_AI_MODE` | `server-proxy` |

## User Flows

- User signs up for the provider's service (auth is the provider's concern)
- User opens the document browser, which shows documents organized however the provider structures them (folders, projects, tags — all metadata managed by the storage host)
- User creates or opens a document; collaboration is automatic with other users who have access
- AI chat is available on higher subscription tiers; the provider meters token usage per user
- Users can connect via the standard desktop app or the provider's web URL
- Desktop users get local MCP that reads the locally-synced Y.Doc — fast AI tool access

## What Carta Owns vs. What the Provider Builds

### Carta provides (the editing platform):

- Document model, editing, collaboration protocol (Yjs sync)
- Document browser UI that renders whatever grouping metadata the server provides
- AI chat UI that routes to a configurable server endpoint
- MCP server (local on desktop, remote via REST API)
- Import/export (.carta files)
- Build configuration (`VITE_SERVER_URL`, `VITE_AI_MODE`)
- Document-level permission **hooks** — the server calls out to check "can user X do Y?" but does not implement the policy

### The provider builds (business logic):

- User authentication and accounts (OAuth, SSO, etc.)
- Document ownership and permissions policy
- Document organization (folders, tags, projects — metadata on documents)
- Billing, token metering, subscription tiers
- Rate limiting and usage dashboards
- Custom branding and onboarding
- Backing store implementation (MongoDB, DynamoDB, S3, etc.)

## Document Organization

The provider decides how to organize documents — Carta doesn't prescribe this. Options include:

- **Folders**: `folder: "/Project Alpha/Sprint 3"` metadata, rendered as a tree in the document browser
- **Tags**: `tags: ["architecture", "team-alpha"]`, rendered as filters
- **Flat list**: No grouping, just search and sort

Carta's document browser consumes whatever grouping metadata the server provides. The provider maps this to their backing store (e.g., a DynamoDB partition key, an S3 prefix, a Postgres column).

## AI Access

The provider wraps Carta's AI chat endpoint with their metering layer. When a user sends a prompt, the request flows: Carta UI → provider's API gateway (checks subscription tier, logs tokens) → AI provider (OpenAI, Anthropic, etc.) → response back through the chain.

`AI_MODE=server-proxy` ensures the UI only routes through the server. The provider controls who gets access and how much.

## MCP

- **Desktop MCP**: Reads local synced Y.Doc — fast, works offline with last-synced state
- **Remote MCP**: Server exposes MCP via REST API — provider can gate access behind their auth layer

## Integration Surface

Carta is the **editing platform**. Auth, billing, permissions, and document organization are integration surfaces, not built-in features. This keeps the core codebase focused and lets providers build differentiated products on top.

## Features Used

- doc03.01.03.02 (Collaboration) — real-time sync, sharing
- doc03.01.03.03 (AI Assistant) — server-proxied, metered chat
- doc03.01.01.01 (Canvas) — primary workspace
- doc03.01.02.01 (Compilation) — AI-readable output
- doc03.01.02.02 (Import/Export) — data portability
