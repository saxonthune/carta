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

## What's Been Built (vscode.epic.md)

| Phase | Status | What It Did |
|-------|--------|-------------|
| 01 | DONE | Extracted `EmbeddedHost` API from server — `startEmbeddedHost({ cartaDir })` starts server + writes `server.json` |
| 02 | DONE | Extension scaffold — `CartaCanvasEditorProvider`, WebView HTML, server lifecycle, `carta.initWorkspace` command |
| 03 | DONE | Removed Electron desktop package |
| 04 | DONE | Dev experience — `launch.json`, dev-mode WebView, esbuild watch |

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

## What's Next

The extension currently uses `CustomReadonlyEditorProvider` — it displays canvases but doesn't participate in VS Code's save/undo model. The web client manages its own state through Yjs and the workspace server.

Future work areas:
- **Embedded mode rendering** — hide app chrome (header, footer, sidebar) when running inside a WebView
- **CustomEditorProvider migration** — integrate with VS Code save/undo/redo by wrapping Yjs doc as a `CustomDocument`
- **Tree view** — workspace structure in VS Code sidebar (spec groups, canvases, schemas)
- **MCP integration** — expose MCP tools to AI agents running in the same VS Code instance
- **VSIX packaging** — `vsce package --no-dependencies` for distribution
