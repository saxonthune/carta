---
title: Deployment Targets
status: active
---

# Deployment Targets

## Unified App Model

Carta is one static web application. The same build supports all deployment scenarios — demo sites, personal use, enterprise, and SaaS. **Build-time configuration** controls which capabilities are pre-wired for a given deployment.

There is no "static mode" vs "server mode." The web client is always a static bundle of HTML/JS/CSS. A server, when present, is a separate backend that the static bundle connects to via REST and WebSocket.

## Build-Time Configuration

Two environment variables, set by the **operator** (the person deploying Carta):

| Env var | Values | Default | Purpose |
|---------|--------|---------|---------|
| `VITE_SYNC_URL` | URL string or absent | absent | Server to connect to. Presence enables server mode. |
| `VITE_AI_MODE` | `none`, `user-key`, `server-proxy` | `none` | How AI chat gets credentials |
| `VITE_DEBUG` | `true`, `false`, or absent | `import.meta.env.DEV` | Shows debug badges in header (DEV, SERVER, AI mode) |

Everything else is derived:

| Derived property | Logic |
|------------------|-------|
| `hasSync` | `!!serverUrl` |
| `collaboration` | `hasSync` (WebSocket sync requires a server) |
| `documentBrowser` | `hasSync` (single-document mode otherwise) |
| `singleDocument` | `!hasSync` |
| `hasAI` | `aiMode !== 'none'` |
| `syncWsUrl` | `syncUrl` with `http` → `ws` |

### Why two variables, not three or five

`STORAGE_BACKENDS` and `COLLABORATION` were previously independent flags, but they encoded the same underlying decision: **is there a server?** If a server is present, it handles persistence and enables WebSocket sync. If not, IndexedDB is the only option and collaboration is impossible. The `both` value for storage backends was a developer convenience that leaked complexity into the product model.

The simplified model: if `VITE_SYNC_URL` is set (or the VS Code extension injects it via `__CARTA_CONFIG__`), you have server storage and collaboration. If not, you don't.

`AI_MODE` remains independent because it genuinely varies separately — `carta serve .` users typically use `user-key`; enterprise uses `server-proxy`.

## Document Sources

A **document source** is where documents live. The app supports two source types:

| Source | Platform | Persistence | Document listing |
|--------|----------|------------|-----------------|
| **Browser** | Any web browser | IndexedDB | Local registry in IndexedDB |
| **Server** | Any (requires server URL) | Server database | REST API `GET /api/documents` |

### Source availability by deployment

| Deployment | Browser source | Server source |
|------------|---------------|---------------|
| Demo site | Yes (single document) | No |
| Solo browser user | Yes (single document) | No |
| Enterprise web | No | Yes |
| SaaS web | No | Yes |
| VS Code extension | No | Yes (embedded) |
| Workspace CLI | No | Yes (embedded) |

### Demo site / solo browser: single-document mode

When no server URL is configured and the app runs in a browser, it operates in **single-document mode** — like Excalidraw. One document auto-created in IndexedDB, no document browser, no multi-document management. The user edits directly.

On first visit (no existing documents in IndexedDB), the app injects `?example=software-architecture` into the URL. The `useExampleLoader` hook fetches the example file and imports it into the blank document. To change the default example, update `DEFAULT_EXAMPLE` in `main.tsx`.

### Server-connected: multi-document mode

When a server URL is present, the **document browser** is available. Users can list, create, and select documents. The server is the source of truth; IndexedDB is not used in server mode.

## Storage Hosts

A **storage host** is the operator running a Carta server — an enterprise IT department, a SaaS provider, or the embedded server in the VS Code extension or `carta serve .`. The storage host controls:

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
| `user-key` | User provides key | Client → AI provider directly | Solo users, VS Code extension |
| `server-proxy` | Server configured | Client → server → AI provider | Enterprise, SaaS (metered) |

## MCP Access

| Platform | Local MCP | Remote MCP |
|----------|-----------|------------|
| Browser | No (cannot run server process) | Yes (if server available) |
| VS Code extension | Yes (embedded server reads local Y.Doc) | Yes (if connected to remote server) |

## Deployment Scenarios

| Scenario | `VITE_SYNC_URL` | `VITE_AI_MODE` | Behavior |
|----------|-------------------|----------------|----------|
| Demo site | absent | `none` | Single document, browser-only, no AI |
| Solo browser | absent | `user-key` | Single document, browser-only, user provides API key |
| VS Code extension | injected via `__CARTA_CONFIG__` | `user-key` | Multi-document, embedded workspace server |
| Enterprise | `https://carta.internal` | `server-proxy` | Multi-document, server storage, managed AI |
| SaaS | `https://api.carta.io` | `server-proxy` | Multi-document, server storage, metered AI |
| Workspace CLI | injected via `__CARTA_CONFIG__` | `user-key` | Multi-document, workspace server, `carta serve .` |

See doc03.02.03 (Enterprise), doc03.02.04 (Solo User) for detailed use case scenarios.

## Preferences

App preferences (last document, UI settings) are stored via localStorage in the browser. The app remembers the most recent document and reopens it on launch.

## Integration Surface

Carta is the **editing platform**. The following concerns are integration surfaces — not built-in features:

- **Authentication**: Enterprise SSO, OAuth, provider accounts — external to Carta
- **Authorization**: Document permissions — Carta provides hooks, consumers implement policy
- **Billing/metering**: Token counting, subscription tiers — provider wraps AI endpoint
- **User management**: Accounts, profiles, teams — external to Carta
- **Document organization**: Folders, tags, projects — metadata managed by the storage host

This boundary keeps the core focused and lets different consumers (enterprise, SaaS, solo) build on top without bloating the platform.

## Workspace Server

The **workspace server** is a `DocumentServerConfig` implementation that serves a `.carta/` directory. One Y.Doc room per `.canvas.json` file. The room name is the canvas path relative to `.carta/`, without the `.canvas.json` extension.

Examples:
- `.carta/overview.canvas.json` → room `overview`
- `.carta/01-api/endpoint-map.canvas.json` → room `01-api/endpoint-map`

**Persistence model:**
- **JSON canonical**: `.carta/{path}.canvas.json` — human-readable, VCS-friendly
- **Binary sidecar cache**: `.carta/.state/{flat-name}.ystate` — fast reload via `Y.applyUpdate`
- On load: sidecar is preferred when its `mtime` is newer than the JSON file
- On update: changes are debounced (2 s) and flushed to both files
- On shutdown: `stopWorkspaceServer()` flushes all dirty docs synchronously before closing

**Entry point**: `startWorkspaceServer({ cartaDir, port?, host?, clientDir? })` in `packages/server/src/workspace-server.ts`.

**CLI entry point**: `carta serve [directory]` starts the workspace server for the `.carta/` directory in `[directory]` (defaults to `.`). It also serves the pre-built `@carta/web-client` bundle with runtime configuration injection — the server injects `window.__CARTA_CONFIG__ = { syncUrl }` into `index.html` so the client auto-connects to the server without a rebuild. Port defaults to 51234 with auto-increment if busy. Flags: `--port N`, `--host H`.

## Monorepo Package Status

| Package | Status |
|---------|--------|
| `@carta/geometry` | Done — geometry primitives and layout algorithms |
| `@carta/schema` | Done — types, ports, schemas, utils extracted; re-exports geometry via utils; exports CartaNode/CartaEdge graph types |
| `@carta/document` | Done — Y.Doc operations, Yjs helpers, file format, migrations, level-aware CRUD, compiler |
| `@carta/web-client` | Done — extracted to `packages/web-client/` |
| `@carta/server` | Done — document server + MCP server, imports from `@carta/document` |
