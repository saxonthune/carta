---
name: carta-vscode-helper
description: Developing Carta's VS Code extension. Use when working on packages/vscode/, planning extension features, or debugging the extension.
---

# Carta VS Code Helper

Context-aware assistant for developing Carta's VS Code extension. For general VS Code extension patterns (WebView API, CSP, testing pyramid, etc.), read the `vscode-extension-dev` skill first.

## What We're Building

A VS Code extension that lets users interact with a `.carta/` workspace directory entirely from VS Code — no terminal commands, no separate browser window. Double-click a `.canvas.json` file, get a full canvas editor.

This replaces the former Electron desktop app with a lighter, more integrated experience.

## Product Context

Read these docs for the full picture:

| Doc | What It Tells You |
|-----|-------------------|
| doc02.04.09 | **Workspace model.** `.carta/` is a directory vault: `.canvas.json` files, `schemas/schemas.json`, spec group directories, `.state/` binary cache. JSON is canonical; Y.Doc binary is for real-time sync. Workspace server reconciles JSON↔binary via filesystem watcher. |
| doc02.05 | **Deployment config.** Extension is a server-backed deployment. Inject `VITE_SYNC_URL` via `__CARTA_CONFIG__` at WebView load. Enables multi-document mode, workspace navigation, AI sidebar. |
| doc03.02.01 | **Primary persona.** Software architect with workspace in a git repo. Extension replaces `carta serve .` + browser. They create canvases, iterate with AI agents, git commit. |
| doc03.02.04 | **Secondary persona.** Solo user. Extension is the zero-setup local workspace experience. |
| doc02.03 | **Interfaces.** REST endpoints, WebSocket rooms, MCP tools the embedded server must provide. |

## What's Been Built

- Extracted `EmbeddedHost` API — `startEmbeddedHost({ cartaDir })` starts server + writes `server.json`
- Extension scaffold — `CartaCanvasEditorProvider`, WebView HTML, server lifecycle, `carta.initWorkspace` command
- Removed Electron desktop package
- Dev experience — `launch.json`, dev-mode WebView, esbuild watch

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

**Dev Mode** (hot reload): F5 with "Carta Extension (Dev Mode)" selected. Starts Vite dev server, builds everything, launches EDH. Set `carta.devMode: true` in EDH settings.

**Bundled Mode** (production-like): F5 with "Carta Extension (Bundled)" selected. Builds and launches. No Vite server.

See `vscode-extension-dev` skill for HMR coverage table and debugging commands.

## Document Loading Flow (Extension → Canvas)

Understanding this flow is essential for debugging "no nodes appear" and similar issues.

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
| DocumentProvider | `workspaceCanvas={schemas}` prop set | No `workspaceCanvas` prop |
| Active page | Hardcoded `{ pageId: 'canvas' }` | Dynamic from `usePages()` |
| App chrome | Workspace navigator, header | Canvas only |

### Common Failure Points

1. **Embedded server not started** — `serverInfo` is null → no `syncUrl` in iframe → client falls back to local mode with empty IndexedDB → no nodes
2. **CSP blocks inline scripts (bundled mode)** — `script-src` doesn't include `'unsafe-inline'` → `__CARTA_CONFIG__` and `history.replaceState` never run → `config.embedded = false`, no `?doc=` → wrong UI, empty doc
3. **`pnpm dev` not running (dev mode)** — iframe fails to load Vite dev server → blank WebView
4. **Workspace canvas schemas not injected** — embedded path skips `useWorkspaceMode()` → constructs render without schema metadata (field names, colors missing, but nodes should still appear)
5. **Room name mismatch** — `deriveRoomName` must produce exact match for `loadCanvasDoc` path resolution

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

## What's Next

The extension currently uses `CustomReadonlyEditorProvider` — it displays canvases but doesn't participate in VS Code's save/undo model. The web client manages its own state through Yjs and the workspace server.

Future work areas:
- **Embedded mode rendering** — hide app chrome (header, footer, sidebar) when running inside a WebView
- **CustomEditorProvider migration** — integrate with VS Code save/undo/redo by wrapping Yjs doc as a `CustomDocument`
- **Tree view** — workspace structure in VS Code sidebar (spec groups, canvases, schemas)
- **MCP integration** — expose MCP tools to AI agents running in the same VS Code instance
- **VSIX packaging** — `vsce package --no-dependencies` for distribution
