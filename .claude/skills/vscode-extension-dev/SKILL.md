---
name: vscode-extension-dev
description: VS Code extension development patterns, testing workflows, WebView architecture, and custom editor best practices. Use when working on packages/vscode, debugging the extension, or planning extension features.
---

# VS Code Extension Development

Reference skill for developing Carta's VS Code extension (`packages/vscode/`). Distilled from official docs, security research, and production extensions (tldraw, draw.io, excalidraw).

## When This Triggers

- Working on `packages/vscode/` code
- Debugging extension behavior or WebView issues
- Planning new extension features
- Reviewing extension security (CSP, resource loading)
- Setting up extension testing

## Architecture Overview

### Process Model

VS Code extensions run in a **separate Node.js process** (the Extension Host), isolated from the renderer. WebViews are sandboxed iframes within the renderer. Communication between the extension and WebView uses `postMessage` / `onDidReceiveMessage`.

```
┌─────────────────────────────────┐
│  VS Code Renderer (Electron)    │
│  ┌───────────────────────────┐  │
│  │  WebView (sandboxed)      │  │
│  │  ┌─────────────────────┐  │  │
│  │  │  Carta web-client   │  │  │
│  │  │  (React app)        │  │  │
│  │  └─────────────────────┘  │  │
│  └───────────────────────────┘  │
│         ↕ postMessage           │
├─────────────────────────────────┤
│  Extension Host (Node.js)       │
│  ┌─────────────────────────┐   │
│  │  CartaCanvasEditorProv. │   │
│  │  EmbeddedHost (server)  │   │
│  └─────────────────────────┘   │
└─────────────────────────────────┘
```

### Carta's Extension Structure

```
packages/vscode/
├── src/
│   ├── extension.ts              # activate/deactivate, server lifecycle
│   ├── canvas-editor-provider.ts # CustomReadonlyEditorProvider, WebView HTML
│   └── find-carta-workspace.ts   # .carta/ discovery, room name derivation
├── scripts/
│   └── copy-web-client.mjs       # Copies web-client dist into extension dist
├── esbuild.config.mjs            # Extension bundling (CJS, externals: [vscode])
├── package.json                  # contributes: customEditors, commands, configuration
└── dist/                         # Build output
    ├── extension.js              # Bundled extension code
    └── web-client/               # Copied from packages/web-client/dist
```

### Activation

The extension activates on `workspaceContains:**/.carta/workspace.json`. On activation:
1. Finds `.carta/` in workspace folders
2. Starts `EmbeddedHost` (workspace server + server.json discovery)
3. Registers `CartaCanvasEditorProvider` for `*.canvas.json` files
4. Registers `carta.initWorkspace` command

### Custom Editor Provider Types

| Type | Use Case | Save/Undo | Carta Uses |
|------|----------|-----------|------------|
| `CustomTextEditorProvider` | Text-based formats (JSON, XML) | VS Code manages via TextDocument | No |
| `CustomReadonlyEditorProvider` | Read-only viewers | None | **Yes (current)** |
| `CustomEditorProvider` | Full control, binary formats | You implement | Future (for editing) |

Carta currently uses `CustomReadonlyEditorProvider`. To support editing (save, undo/redo), migrate to `CustomEditorProvider` with a `CustomDocument` wrapping the Yjs doc.

### Two Rendering Modes

**Dev mode** (`carta.devMode: true`): Iframes `http://localhost:5173?doc=ROOM_NAME`. WebView content is an iframe pointing to Vite dev server. HMR works for React components and CSS. Extension-side changes require `Ctrl+R` reload.

**Bundled mode** (default): Loads `dist/web-client/index.html` with rewritten asset paths via `webview.asWebviewUri()`. Injects `__CARTA_CONFIG__` (server URL) and auto-navigate script. Standalone — no external server needed.

## Development Workflow

### Standard Dev Loop

This is the standard pattern used by tldraw, draw.io, excalidraw, and similar extensions:

1. **Terminal 1:** `pnpm vscode` — builds web-client, builds extension, starts extension esbuild watcher
2. **Terminal 2:** `pnpm demo` — starts Vite dev server on `:5173` (only needed for dev mode)
3. **F5** in VS Code — launches Extension Development Host (EDH) with the extension loaded
4. **Iterate:**
   - WebView React/CSS changes: auto-reload via Vite HMR (dev mode only)
   - Extension code changes: `Ctrl+R` in EDH window to reload
   - `package.json` contribution changes: full EDH restart (`Ctrl+Shift+F5`)
   - WebView-only refresh: Command Palette > `Developer: Reload Webviews`

### What HMR Covers

| Change | HMR? | Action Needed |
|--------|-------|---------------|
| React components (webview) | Yes | Automatic |
| CSS/styles (webview) | Yes | Automatic |
| Extension TypeScript | No | `Ctrl+R` in EDH |
| `package.json` contributions | No | `Ctrl+Shift+F5` (full restart) |
| `onDidReceiveMessage` handlers | No | `Ctrl+R` in EDH |
| New file registrations | No | `Ctrl+Shift+F5` |

### Debugging

**Extension code:** Set breakpoints in VS Code before pressing F5. The debugger attaches automatically.

**WebView content:** In the EDH window, open Command Palette > `Developer: Toggle Developer Tools`. Find the WebView frame in the Elements panel to inspect DOM, console, network.

**Useful EDH commands:**
- `Developer: Show Running Extensions` — verify extension loaded
- `Developer: Reload Webviews` — refresh WebView without reloading extension
- `Developer: Toggle Developer Tools` — inspect WebView DOM/console

### Smoke-Testing a VSIX

Package and install locally to test the production bundle:

```bash
cd packages/vscode
npx @vscode/vsce package --no-dependencies  # --no-dependencies required for pnpm
code --install-extension carta-vscode-0.0.1.vsix
```

The `--no-dependencies` flag is required because `vsce` doesn't understand pnpm's `workspace:*` protocol. Since the extension is bundled with esbuild, all runtime dependencies are included in `dist/extension.js`.

## Security: Content Security Policy

### Why CSP Matters

Trail of Bits audits (2023) showed that misconfigured CSP in VS Code WebViews allows file exfiltration via DNS prefetch injection, srcdoc iframe escapes, and path traversal. Even "correctly" configured extensions can be bypassed via URL parsing differences.

### CSP Rules

**Bundled mode CSP** (current implementation in `canvas-editor-provider.ts`):
```
default-src 'none';
script-src ${webview.cspSource};
style-src ${webview.cspSource} 'unsafe-inline';
connect-src ws://127.0.0.1:* http://127.0.0.1:*;
img-src ${webview.cspSource} data:;
font-src ${webview.cspSource};
```

**Dev mode CSP:**
```
default-src 'none';
frame-src http://localhost:5173;
```

### Key Principles

- Always use `webview.cspSource` — never hardcode schemes
- `localResourceRoots` restricts which files the WebView can load, but it is NOT sufficient alone — combine with CSP
- Never allow `'unsafe-eval'` in production
- `connect-src` must include WebSocket URLs for the workspace server
- In dev mode, `connect-src` also needs `ws://localhost:5173` for Vite HMR

## Testing Strategy

### Testing Pyramid

```
           ┌─────────┐
           │  Manual  │  Open EDH, click around
           ├─────────┤
           │  E2E     │  WebdriverIO (webview DOM)
           ├─────────┤
           │ Integr.  │  @vscode/test-electron (extension API)
           ├─────────┤
           │  Unit    │  Vitest (pure logic, no vscode dependency)
           └─────────┘
```

**Unit tests (bulk of value):** Test pure logic — room name derivation, HTML generation, config injection — with Vitest. No VS Code dependency. These live in `packages/vscode/tests/`.

**Integration tests:** Use `@vscode/test-electron` to test activation, command registration, file-type association. Can verify the extension-side message protocol. Cannot inspect WebView DOM. Run with `pnpm --filter carta-vscode test:integration`.

**E2E tests (if needed):** WebdriverIO with `wdio-vscode-service` can automate VS Code and switch into WebView iframes to test rendered content. Heavy — use sparingly.

**Standalone web app tests:** Test the React app independently in a browser (Playwright) with a mock `acquireVsCodeApi()`. Fastest iteration for UI components.

### CI Setup

Linux CI requires `xvfb` for integration tests:
```bash
xvfb-run -a pnpm --filter carta-vscode test:integration
```

## Reference Extensions

Study these for architectural patterns:

| Extension | Architecture | Why Study It |
|-----------|-------------|--------------|
| [tldraw](https://github.com/tldraw/tldraw/tree/main/apps/vscode) | `CustomEditorProvider`, React in WebView, monorepo | **Closest analog to Carta.** Split `extension/` + `editor/`. Full save/undo/redo. |
| [draw.io](https://github.com/hediet/vscode-drawio) | External web app in WebView, text document sync | Embeds external editor, Liveshare support. Author gave direct API feedback to VS Code team. |
| [excalidraw](https://github.com/excalidraw/excalidraw-vscode) | React in custom editor | Simpler than tldraw, solid reference. |
| [vscode-hexeditor](https://deepwiki.com/microsoft/vscode-hexeditor) | `CustomEditorProvider`, binary document model | How Microsoft themselves build production custom editors. |

## Key Official Docs

| Topic | URL |
|-------|-----|
| Custom Editor API | https://code.visualstudio.com/api/extension-guides/custom-editors |
| WebView API | https://code.visualstudio.com/api/extension-guides/webview |
| Extension Host | https://code.visualstudio.com/api/advanced-topics/extension-host |
| Testing Extensions | https://code.visualstudio.com/api/working-with-extensions/testing-extension |
| Bundling (esbuild) | https://code.visualstudio.com/api/working-with-extensions/bundling-extension |
| Activation Events | https://code.visualstudio.com/api/references/activation-events |

## Key Security Sources

| Source | What It Covers |
|--------|---------------|
| [Trail of Bits: Escaping Misconfigured Extensions](https://blog.trailofbits.com/2023/02/21/vscode-extension-escape-vulnerability/) | CSP bypass via DNS prefetch, srcdoc iframes |
| [Trail of Bits: Escaping Well-Configured Extensions](https://blog.trailofbits.com/2023/02/23/escaping-well-configured-vscode-extensions-for-profit/) | URL parsing, path traversal past localResourceRoots |
| [Matt Bierner: WebView learnings](https://blog.mattbierner.com/vscode-webview-web-learnings/) | Internals from the API designer |

## Common Pitfalls

1. **WebView goes blank after reload:** `retainContextWhenHidden: true` preserves WebView state when the tab is hidden, but the WebView is still destroyed on extension reload. Restore state via `webview.getState()`/`setState()` or re-send from extension.

2. **HMR fails silently in dev mode:** CSP must include `connect-src ws://localhost:5173` for Vite's WebSocket. Without it, HMR connections fail with no visible error.

3. **`vsce package` fails with pnpm:** Use `--no-dependencies` flag. pnpm's `workspace:*` protocol confuses vsce. Since esbuild bundles everything, runtime deps don't need to be in `node_modules`.

4. **Asset paths wrong in bundled mode:** All paths in the web client's `index.html` are absolute (`/assets/...`). The extension must rewrite these to `webview.asWebviewUri()` URIs. The regex in `buildWebviewHtml` handles this.

5. **Extension changes not reflected:** Extension Host caches loaded modules. Always `Ctrl+R` after extension code changes. For `package.json` changes, full restart with `Ctrl+Shift+F5`.

6. **`__dirname` incorrect after bundling:** esbuild rewrites `__dirname`. If you need the real extension path, use `context.extensionUri` or `context.extensionPath`.
