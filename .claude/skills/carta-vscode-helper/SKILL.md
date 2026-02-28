---
name: carta-vscode-helper
description: Developing Carta's VS Code extension. Use when working on packages/vscode/, planning extension features, or debugging the extension.
---

# Carta VS Code Helper

Context-aware assistant for developing Carta's VS Code extension. For general VS Code extension patterns (WebView API, CSP, testing pyramid, etc.), read the `vscode-extension-dev` skill first.

## What We're Building

A VS Code extension that lets users interact with a `.carta/` workspace directory entirely from VS Code — no terminal commands, no separate browser window. Double-click a `.canvas.json` file, get a full canvas editor.

## Product Context

| Doc | What It Tells You |
|-----|-------------------|
| doc02.04.09 | **Workspace model.** `.carta/` is a directory vault: `.canvas.json` files, `schemas/schemas.json`, spec group directories, `.state/` binary cache. JSON is canonical; Y.Doc binary is for real-time sync. |
| doc02.05 | **Deployment config.** Extension is a server-backed deployment. Inject `VITE_SYNC_URL` via `__CARTA_CONFIG__` at WebView load. |
| doc03.02.01 | **Primary persona.** Software architect with workspace in a git repo. |
| doc02.03 | **Interfaces.** REST endpoints, WebSocket rooms, MCP tools the embedded server must provide. |

## Extension Architecture

```
.carta/workspace.json  ←── extension discovers this on activation
       │
       ▼
  EmbeddedHost         ←── starts workspace server (REST + WebSocket)
       │
       ▼
  CartaCanvasEditorProvider  ←── CustomReadonlyEditorProvider for *.canvas.json
       │
       ▼
  WebView (iframe or bundled HTML)
       │
       ▼
  Carta web-client (React app, connects to embedded server via WebSocket)
```

**Key files:**

| File | Role |
|------|------|
| `packages/vscode/src/extension.ts` | Activation, server lifecycle, command registration |
| `packages/vscode/src/canvas-editor-provider.ts` | WebView HTML generation (dev mode + bundled mode) |
| `packages/vscode/src/find-carta-workspace.ts` | `.carta/` discovery, room name derivation |
| `packages/server/src/embedded-host.ts` | `startEmbeddedHost` — server + discovery file |
| `packages/server/src/workspace-server.ts` | HTTP + WebSocket server for `.carta/` directory |

## Dev Workflow

Two launch configs in `.vscode/launch.json`:

**Dev Mode** (hot reload): F5 with "Carta Extension (Dev Mode)" selected. Requires `pnpm dev` running separately. Set `carta.devMode: true` in EDH settings.

**Bundled Mode** (production-like): F5 with "Carta Extension (Bundled)" selected. No Vite server needed.

**Viewing raw JSON**: Right-click a `.canvas.json` tab → "Reopen Editor With..." → "Text Editor". Or in explorer: right-click → "Open With..." → "Text Editor". This is built-in VS Code behavior for any file with a custom editor.

## Document Loading Flow (Extension → Canvas)

```
VS Code opens .canvas.json
  ↓
canvas-editor-provider.ts: deriveRoomName(cartaDir, filePath)
  → e.g., "02-system/architecture" (strips .canvas.json, normalizes separators)
  ↓
Dev mode: buildDevModeHtml(roomName, serverUrl)
  → <iframe src="http://localhost:5173?doc=ROOM&embedded=true&syncUrl=URL">
Bundled mode: buildWebviewHtml(webview, serverInfo, roomName)
  → Injects __CARTA_CONFIG__ + history.replaceState(?doc=ROOM) before </head>
  ↓
featureFlags.ts: getRuntimeConfig()
  → URL params override __CARTA_CONFIG__ (embedded, syncUrl)
  → config.embedded = true, config.hasSync = !!syncUrl
  ↓
main.tsx: boot()
  → documentId = urlParams.get('doc')  // room name
  → <DocumentProvider documentId={documentId}> (NO workspaceCanvas prop)
  ↓
DocumentContext.tsx: non-workspace path
  → deferDefaultPage = true (config.hasSync)
  → skipPersistence = true (config.hasSync)
  → Adapter created, initialized (empty Y.Doc)
  → Migration runs (on empty doc, harmless)
  → setIsReady(true) — UI renders immediately
  → connectToRoom(documentId, syncWsUrl) — async, non-blocking
  ↓
y-websocket: WebsocketProvider(syncUrl, roomId, ydoc)
  → WebSocket URL = ws://127.0.0.1:PORT/02-system/architecture
  ↓
workspace-server.ts: wss.on('connection')
  → roomName = url.pathname.slice(1)  // "02-system/architecture"
  → getDoc(roomName) → loadCanvasDoc(cartaDir, roomName)
  ↓
loadCanvasDoc:
  → Try .state/02-system--architecture.ystate (binary, fast)
  → Fallback: 02-system/architecture.canvas.json → parseCanvasFile → hydrateYDocFromCanvasFile
  ↓
hydrateYDocFromCanvasFile (workspace-hydrate.ts):
  → Creates synthetic page: id='canvas' (WORKSPACE_CANVAS_PAGE_ID)
  → ymeta.set('activePage', 'canvas')
  → ynodes.set('canvas', pageNodesMap)  // all nodes under 'canvas' page
  → yedges.set('canvas', pageEdgesMap)
  ↓
Yjs sync protocol: server sends full Y.Doc state to client
  ↓
Client Y.Doc updated → observers fire:
  → onMetaChange → notifyNodeListeners (active page changed)
  → onNodesChange → notifyNodeListeners
  → onPagesChange → notifyPageListeners
  ↓
usePages: activePage = 'canvas', pages = [{id: 'canvas', name: 'Canvas'}]
useNodes: adapter.getNodes() → getActivePageNodes('canvas') → nodes[]
  ↓
App.tsx: EmbeddedContent renders CanvasContainer with activeView={page:'canvas'}
  → MapV2 renders nodes on canvas
```

### Key Differences: Embedded vs Browser Workspace Mode

| Aspect | Browser (`WorkspaceAppLayout`) | VS Code (`EmbeddedContent`) |
|--------|-------------------------------|----------------------------|
| Schema source | `useWorkspaceMode()` fetches from `/api/workspace/schemas` | **Not fetched** — no `workspaceCanvas` prop |
| DocumentProvider | `workspaceCanvas={schemas}` prop set | No `workspaceCanvas` prop — takes non-workspace adapter path |
| Active page | Hardcoded `{ pageId: 'canvas' }` | Dynamic from `usePages()` |
| App chrome | Workspace navigator, header | Canvas only |

### Open Issues

**CSP blocks inline scripts in bundled mode.** `buildWebviewHtml` injects inline `<script>` tags but CSP `script-src` only allows `${cspSource}` (no `'unsafe-inline'`). Both config scripts are silently blocked → app doesn't know it's embedded, has no syncUrl, renders empty standalone mode. Fix: use nonces.

**Embedded mode has no schemas.** `EmbeddedContent` renders inside a `DocumentProvider` without `workspaceCanvas`. Schemas are workspace-level (not per-canvas), so `hydrateYDocFromCanvasFile` doesn't include them. Nodes sync but render without schema metadata. Fix: restructure embedded boot to fetch `/api/workspace/schemas` before creating `DocumentProvider`.

**No diagnostic output anywhere in the loading chain.** Extension → WebView → config → adapter → WebSocket → server → hydrate → sync → render has zero logging. When nodes don't appear, there's no way to determine which step failed. See "Diagnosability" section.

### Web Client Key Files (for debugging)

| File | What It Does |
|------|-------------|
| `packages/web-client/src/config/featureFlags.ts` | Runtime config: reads `__CARTA_CONFIG__` + URL params, derives `embedded`, `hasSync`, `syncWsUrl` |
| `packages/web-client/src/main.tsx` | Entry point: reads `?doc=` param, wraps in `DocumentProvider` |
| `packages/web-client/src/App.tsx` | `EmbeddedContent` — canvas-only rendering when `config.embedded = true` |
| `packages/web-client/src/contexts/DocumentContext.tsx` | Creates adapter, handles workspace vs non-workspace paths, connects WebSocket |
| `packages/web-client/src/stores/adapters/yjsAdapter.ts` | Y.Doc wrapper: `getNodes()`, `connectToRoom()`, observers, page management |
| `packages/web-client/src/hooks/useNodes.ts` | Subscribes to node changes via `adapter.subscribeToNodes()` |
| `packages/web-client/src/hooks/usePages.ts` | Subscribes to page changes, provides `activePage` |
| `packages/document/src/workspace-hydrate.ts` | `hydrateYDocFromCanvasFile()` — loads JSON into Y.Doc with synthetic 'canvas' page |

## Diagnosability

The loading chain crosses 5 process boundaries (extension host → WebView → iframe → WebSocket → server) with no structured logging. This makes "no nodes appear" impossible to debug without reading source.

**Recommended: WebView status overlay.** Add a diagnostic overlay to `EmbeddedContent` that shows the current state of the loading pipeline:

```
[extension] server: ✓ http://127.0.0.1:51234
[config]    embedded: ✓  syncUrl: ✓  doc: "02-system/architecture"
[adapter]   ready: ✓  pages: 1  activePage: "canvas"
[ws]        status: connected  nodes: 17  edges: 19
```

This could be toggled via a VS Code setting (`carta.debug`) or a message from the extension host.

**Recommended: Extension output channel.** Create a `vscode.window.createOutputChannel('Carta')` and log key lifecycle events: server start/stop, room name derivation, WebView resolve. This gives the user `Output > Carta` in VS Code.

**Recommended: postMessage health check.** After creating the WebView, send a `ping` message. The web client responds with its current config state (`embedded`, `syncUrl`, `documentId`, `connectionStatus`, `nodeCount`). Log the response to the output channel. This closes the observability gap between extension host and WebView content.

## What's Next

- **Fix CSP nonce** — unblock bundled mode
- **Fix schema injection** — fetch from `/api/workspace/schemas` in embedded boot
- **Add diagnostic overlay + output channel** — make the loading chain observable
- **CustomEditorProvider migration** — integrate with VS Code save/undo/redo
- **Tree view** — workspace structure in VS Code sidebar
- **MCP integration** — expose MCP tools to AI agents in the same VS Code instance
- **VSIX packaging** — `vsce package --no-dependencies` for distribution
