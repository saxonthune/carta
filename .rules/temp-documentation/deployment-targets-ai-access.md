# 

## Data abstraction

1. Portfolio. User flows: mental collection for user; show cartas connected to project; user navigates around lists of cartas; users make their own spaces; hosted projects have permissions, owners, etc; cartas have descriptions and tagging
2. Carta. User works in a scoped mental domain; user edits a map and metamap, manipulating instances, schema, and ports.

## Three deployments
Portfolios can be hosted via the filesystem, or by an api + server. The server just implements the api operations

| deployment | filesystem portfolio? | server portfolio? |
| --- | --- | --- |
| 1. Static PWA | no | no |
| 2. web client | yes | yes |
| 3. desktop client | yes | yes |

## Server

User connects to a server to: get source of truth; collaborate and share Cartas and portfolios; access data from multiple devices.
Server has many portfolios, and portfolios have many Cartas

## AI Access

- chat + api key: user inputs an openrouter key or similar, requests go to ai provider. AI has access to Carta state
- server-managed chat: user prompts are sent to server

| deployment | chat + api key | server-managed | mcp local | mcp remote
| --- | --- | --- |
| 1. Static PWA | yes | no | no | no |
| 2. web client | yes | yes | no | yes |
| 3. desktop client | yes | yes | yes | yes |

## Monorepo Target Architecture

8 packages organized by dependency layers:

```
                    @carta/types (merged into @carta/domain)
                         ↓
                    @carta/domain
                    ↙    ↓    ↘
           @carta/storage  @carta/compiler
                ↓               ↓
         @carta/web-client   @carta/server
                ↓               ↓
         @carta/desktop      @carta/cli
```

| Package | Purpose |
|---------|---------|
| `@carta/domain` | Domain model, types, ports, schemas, utils, guides. Platform-agnostic, no React/Yjs deps |
| `@carta/compiler` | Compilation engine (Carta graph -> AI-readable output) |
| `@carta/storage` | StorageProvider interface + implementations (IndexedDB, Filesystem, MongoDB). Portfolio lives here |
| `@carta/web-client` | React web app (currently root `src/`) |
| `@carta/server` | Collaboration server + MCP server |
| `@carta/desktop` | Electron desktop app |
| `@carta/cli` | CLI tools (init, compile, validate) |

### Current progress

| Package | Status |
|---------|--------|
| `@carta/domain` | Done - types, ports, schemas, utils, guides extracted |
| `@carta/compiler` | Done - extracted from `src/constructs/compiler/` |
| `@carta/storage` | Not started - `yjsAdapter.ts` still in `src/stores/`. Portfolio support lands here |
| `@carta/web-client` | Not started - still in root `src/` |
| `@carta/server` | Exists - needs imports updated from stale `@carta/core` to `@carta/domain` + `@carta/compiler` |
| `@carta/desktop` | Future |
| `@carta/cli` | Future |

Cleanup done: `packages/app/` (dead code) and `packages/core/` (stale) deleted. `src/constructs/` reduced to single React-specific file (`ports.ts` with `getHandleStyle`).
