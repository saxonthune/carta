---
title: VS Code Extension Architecture
status: draft
summary: Extension architecture — WebView canvas viewer, workspace tree provider
tags: [vscode, extension, architecture]
deps: [doc01.03.03]
---

> **Note:** TypeScript packages referenced in this doc now live in [Luminous](https://github.com/saxonthune/Luminous). File paths like `packages/web-client/` refer to the Luminous repo.


# VS Code Extension Architecture

Architecture of the Carta VS Code extension (`packages/vscode/`).

## Components

- **Tree Provider**: Reads `.carta/` directory structure and renders it in the VS Code sidebar
- **Canvas WebView**: Renders `.canvas.json` files using a lightweight version of the canvas engine
- **Document Preview**: Renders Markdown documents with cross-reference navigation

## Package Structure

```
packages/vscode/
  src/
    extension.ts        Entry point
    treeProvider.ts      Workspace tree sidebar
    canvasWebView.ts     Canvas rendering WebView
    documentPreview.ts   Markdown preview with refs
```

## Dependencies

The extension imports from `@carta/schema` for type definitions and from `@carta/geometry` for layout algorithms used in canvas rendering.
