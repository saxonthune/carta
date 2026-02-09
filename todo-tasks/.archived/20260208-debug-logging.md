# Add `debug` Package for Structured Logging

## Motivation

Replace ad-hoc `console.log` calls with the `debug` package for namespaced, env-controlled logging. Enables selective logging via `DEBUG=carta:*`, zero overhead when disabled.

## Files to Modify

1. `packages/server/package.json` — add `debug` + `@types/debug` dependencies
2. `packages/desktop/package.json` — add `debug` + `@types/debug` dependencies
3. `packages/server/src/document-server-core.ts` — replace console calls with debug loggers, remove `logPrefix` from config interface
4. `packages/server/src/document-server.ts` — replace console calls with debug loggers, remove `logPrefix` from config
5. `packages/server/src/mcp/stdio.ts` — replace `console.error` calls with debug logger
6. `packages/desktop/src/main/server.ts` — replace console calls with debug loggers, remove `logPrefix` from config
7. `packages/desktop/src/main/index.ts` — replace console calls with debug logger
8. `packages/server/tests/document-server-core.test.ts` — remove `logPrefix` from test config

## Implementation Steps

### Step 1: Install dependencies

```bash
cd packages/server && pnpm add debug && pnpm add -D @types/debug
cd packages/desktop && pnpm add debug && pnpm add -D @types/debug
```

### Step 2: Remove `logPrefix` from DocumentServerConfig

In `packages/server/src/document-server-core.ts`:

- Remove the `logPrefix: string;` field from the `DocumentServerConfig` interface (line 75)
- Remove `const { logPrefix } = config;` destructure (line 197)

### Step 3: Create debug loggers in document-server-core.ts

At the top of `packages/server/src/document-server-core.ts`, add:

```typescript
import createDebug from 'debug';

const log = createDebug('carta:server');
const logWs = createDebug('carta:server:ws');
const logPages = createDebug('carta:server:pages');
```

Replace console calls with the appropriate logger:

| Line | Current | Replacement |
|------|---------|-------------|
| 260 | `console.error(\`${logPrefix} Error handling message:\`, err)` | `logWs('Error handling message: %O', err)` |
| 269 | `console.log(\`${logPrefix} Client connected to room: ${docName} (${docState.conns.size} clients)\`)` | `logWs('Client connected to room: %s (%d clients)', docName, docState.conns.size)` |
| 297 | `console.log(\`${logPrefix} Client disconnected from room: ${docName} (${docState.conns.size} clients)\`)` | `logWs('Client disconnected from room: %s (%d clients)', docName, docState.conns.size)` |
| 301 | `console.error(\`${logPrefix} WebSocket error in room ${docName}:\`, err)` | `logWs('WebSocket error in room %s: %O', docName, err)` |
| 377 | `console.log(\`${logPrefix} [pages] Created default Main page for new document\`, { pageId, roomId })` | `logPages('Created default Main page for new document pageId=%s roomId=%s', pageId, roomId)` |
| 1144 | `console.error(\`${logPrefix} HTTP error:\`, err)` | `log('HTTP error: %O', err)` |

### Step 4: Create debug loggers in document-server.ts

At the top of `packages/server/src/document-server.ts`, add:

```typescript
import createDebug from 'debug';

const log = createDebug('carta:server');
```

Replace all `console.log('[Server] ...')` and `console.error('[Server] ...')` and `console.warn('[Server] ...')` calls with `log(...)`. Use `%s`, `%d`, `%O` formatters instead of template literals.

Remove `logPrefix: '[Server]'` from the config object (around line 143).

### Step 5: Create debug loggers in mcp/stdio.ts

At the top of `packages/server/src/mcp/stdio.ts`, add:

```typescript
import createDebug from 'debug';

const log = createDebug('carta:mcp');
```

Replace `console.error(...)` calls with `log(...)`. Note: `debug` writes to stderr by default, so MCP protocol compatibility (stdout for protocol, stderr for diagnostics) is preserved.

The `console.error('Fatal error:', error)` at line 195 should remain as `console.error` since it's a crash handler that must always print.

### Step 6: Create debug loggers in desktop/server.ts

At the top of `packages/desktop/src/main/server.ts`, add:

```typescript
import createDebug from 'debug';

const log = createDebug('carta:desktop-server');
```

Replace all `console.log('[Desktop Server] ...')` and `console.error('[Desktop Server] ...')` with `log(...)`.

Remove `logPrefix: '[Desktop Server]'` from the config object (around line 332).

### Step 7: Create debug loggers in desktop/index.ts

At the top of `packages/desktop/src/main/index.ts`, add:

```typescript
import createDebug from 'debug';

const log = createDebug('carta:desktop');
```

Replace all `console.log('[Desktop] ...')` and `console.error('[Desktop] ...')` with `log(...)`.

### Step 8: Fix test config

In `packages/server/tests/document-server-core.test.ts`, remove `logPrefix: '[Test]'` from the `makeConfig` function (line 29).

### Step 9: Ignore build scripts

Do NOT touch `packages/desktop/scripts/copy-renderer.mjs` — those `console.log` calls are build script output, not app logging.

## Constraints

- **`erasableSyntaxOnly`**: No `private`/`protected`/`public` constructor parameter shorthand
- **Barrel exports**: Use `.js` extensions in imports
- **Import style**: Use `import createDebug from 'debug'` (default import — the `debug` package exports a default function)
- `@types/debug` provides the type declarations
- The `debug` package uses `process.stderr` by default which is correct for MCP stdio compatibility
- Keep `console.error` for fatal/crash handlers that must always print regardless of DEBUG env var

## Verification

```bash
pnpm build    # TypeScript compiles, no logPrefix type errors
pnpm test     # Tests pass (test config no longer has logPrefix)
```

Manual verification: `DEBUG=carta:* node packages/server/dist/document-server-cli.js` should show colored, namespaced log output.
