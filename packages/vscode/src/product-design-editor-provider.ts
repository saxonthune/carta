import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import { parseDocument, updateBlock } from './code-block-parser.js';
import type { CartaCodeBlock } from './code-block-parser.js';

interface CanvasFile {
  type: 'carta-canvas';
  version: 1;
  sources: string[];
  layout: Array<{ filename: string; x: number; y: number }>;
}

interface CanvasSourceFile {
  filename: string;
  blocks: CartaCodeBlock[];
}

export class ProductDesignEditorProvider implements vscode.CustomTextEditorProvider {
  extensionUri: vscode.Uri;
  devMode: boolean;
  output: vscode.OutputChannel;

  constructor(
    extensionUri: vscode.Uri,
    devMode: boolean,
    output: vscode.OutputChannel,
  ) {
    this.extensionUri = extensionUri;
    this.devMode = devMode;
    this.output = output;
  }

  static register(
    context: vscode.ExtensionContext,
    devMode: boolean,
    output: vscode.OutputChannel,
  ): vscode.Disposable {
    const provider = new ProductDesignEditorProvider(context.extensionUri, devMode, output);
    return vscode.window.registerCustomEditorProvider(
      'carta.productDesignEditor',
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    );
  }

  resolveCustomEditor(
    document: vscode.TextDocument,
    webviewPanel: vscode.WebviewPanel,
  ): void {
    const canvasFilePath = document.uri.fsPath;
    const canvasDir = path.dirname(canvasFilePath);

    this.output.appendLine(`ProductDesignEditor: opening ${canvasFilePath}`);

    let canvasFile: CanvasFile;
    try {
      canvasFile = JSON.parse(document.getText()) as CanvasFile;
    } catch (err) {
      this.output.appendLine(`ProductDesignEditor: failed to parse canvas file: ${err}`);
      webviewPanel.webview.html = '<html><body><p>Invalid canvas file</p></body></html>';
      return;
    }

    // Resolve source files relative to the canvas file directory
    const sourceFiles: CanvasSourceFile[] = (canvasFile.sources ?? []).map((relPath) => {
      const absPath = path.resolve(canvasDir, relPath);
      const filename = path.basename(absPath);
      try {
        const markdown = fs.readFileSync(absPath, 'utf-8');
        const parsed = parseDocument(markdown);
        return { filename, blocks: parsed.blocks };
      } catch {
        this.output.appendLine(`ProductDesignEditor: could not read ${absPath}`);
        return { filename, blocks: [] };
      }
    });

    // Set up WebView
    webviewPanel.webview.options = {
      enableScripts: true,
      ...(this.devMode ? {} : {
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist', 'web-client'),
        ],
      }),
    };

    if (this.devMode) {
      webviewPanel.webview.html = this.buildDevModeHtml();
    } else {
      webviewPanel.webview.html = this.buildWebviewHtml(webviewPanel.webview);
    }

    // Track pending ready state
    let ready = false;
    const pendingInit = { files: sourceFiles, layout: canvasFile.layout ?? [] };

    // Message handler
    const messageDisposable = webviewPanel.webview.onDidReceiveMessage((msg) => {
      if (msg.type === 'carta:pd:ready') {
        ready = true;
        webviewPanel.webview.postMessage({
          type: 'carta:pd:init',
          files: pendingInit.files,
          layout: pendingInit.layout,
        });
        return;
      }

      if (msg.type === 'carta:pd:block-change') {
        const { filename, blockIndex, newBody } = msg as {
          filename: string;
          blockIndex: number;
          newBody: Record<string, unknown>;
        };
        this.handleBlockChange(canvasDir, canvasFile.sources, filename, blockIndex, newBody);
        return;
      }

      if (msg.type === 'carta:pd:layout-change') {
        const { layout } = msg as { layout: Array<{ filename: string; x: number; y: number }> };
        this.handleLayoutChange(document, layout);
        return;
      }
    });

    // Set up file watchers for each source file
    const watchers: vscode.FileSystemWatcher[] = [];
    const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

    for (const relPath of canvasFile.sources ?? []) {
      const absPath = path.resolve(canvasDir, relPath);
      const filename = path.basename(absPath);
      const pattern = new vscode.RelativePattern(
        vscode.Uri.file(path.dirname(absPath)),
        path.basename(absPath),
      );
      const watcher = vscode.workspace.createFileSystemWatcher(pattern);

      const onFileChanged = () => {
        const existing = debounceTimers.get(absPath);
        if (existing) clearTimeout(existing);
        debounceTimers.set(absPath, setTimeout(() => {
          debounceTimers.delete(absPath);
          try {
            const markdown = fs.readFileSync(absPath, 'utf-8');
            const parsed = parseDocument(markdown);
            if (ready) {
              webviewPanel.webview.postMessage({
                type: 'carta:pd:file-changed',
                filename,
                blocks: parsed.blocks,
              });
            }
          } catch {
            this.output.appendLine(`ProductDesignEditor: watcher read error for ${absPath}`);
          }
        }, 100));
      };

      watcher.onDidChange(onFileChanged);
      watcher.onDidCreate(onFileChanged);
      watchers.push(watcher);
    }

    // Clean up on panel close
    webviewPanel.onDidDispose(() => {
      messageDisposable.dispose();
      for (const watcher of watchers) watcher.dispose();
      for (const timer of debounceTimers.values()) clearTimeout(timer);
    });
  }

  handleBlockChange(
    canvasDir: string,
    sources: string[],
    filename: string,
    blockIndex: number,
    newBody: Record<string, unknown>,
  ): void {
    const relPath = sources.find(s => path.basename(s) === filename);
    if (!relPath) {
      this.output.appendLine(`ProductDesignEditor: no source found for ${filename}`);
      return;
    }
    const absPath = path.resolve(canvasDir, relPath);
    try {
      const markdown = fs.readFileSync(absPath, 'utf-8');
      const parsed = parseDocument(markdown);
      const updated = updateBlock(parsed, blockIndex, newBody);
      fs.writeFileSync(absPath, updated, 'utf-8');
    } catch (err) {
      this.output.appendLine(`ProductDesignEditor: block-change error: ${err}`);
    }
  }

  handleLayoutChange(
    document: vscode.TextDocument,
    newLayout: Array<{ filename: string; x: number; y: number }>,
  ): void {
    try {
      const current = JSON.parse(document.getText()) as CanvasFile;
      const updated = { ...current, layout: newLayout };
      const edit = new vscode.WorkspaceEdit();
      const fullRange = new vscode.Range(
        document.positionAt(0),
        document.positionAt(document.getText().length),
      );
      edit.replace(document.uri, fullRange, JSON.stringify(updated, null, 2));
      vscode.workspace.applyEdit(edit);
    } catch (err) {
      this.output.appendLine(`ProductDesignEditor: layout-change error: ${err}`);
    }
  }

  buildDevModeHtml(): string {
    const devServerUrl = 'http://localhost:5173';
    const params = new URLSearchParams();
    params.set('mode', 'product-design');
    const iframeSrc = `${devServerUrl}?${params.toString()}`;

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; frame-src ${devServerUrl};">
  <style>html, body { margin: 0; padding: 0; width: 100vw; height: 100vh; overflow: hidden; } iframe { display: block; width: 100vw; height: 100vh; border: none; }</style>
</head>
<body>
  <iframe src="${iframeSrc}"></iframe>
</body>
</html>`;
  }

  buildWebviewHtml(webview: vscode.Webview): string {
    const webClientDir = vscode.Uri.joinPath(this.extensionUri, 'dist', 'web-client');
    const indexPath = path.join(webClientDir.fsPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      return '<html><body><h1>Web client not found</h1><p>Run the extension build first.</p></body></html>';
    }

    let html = fs.readFileSync(indexPath, 'utf-8');

    // Rewrite asset paths to WebView URIs
    html = html.replace(
      /(src|href)="\/([^"]+)"/g,
      (_match, attr, assetPath) => {
        const assetUri = webview.asWebviewUri(
          vscode.Uri.joinPath(webClientDir, assetPath),
        );
        return `${attr}="${assetUri}"`;
      },
    );

    const nonce = crypto.randomUUID().replace(/-/g, '');
    const cartaConfig = { mode: 'product-design' };
    const configScript = `<script nonce="${nonce}">window.__CARTA_CONFIG__=${JSON.stringify(cartaConfig)}</script>`;

    const cspSource = webview.cspSource;
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${cspSource}; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data:; font-src ${cspSource};">`;

    html = html.replace('</head>', `${cspMeta}\n${configScript}\n</head>`);

    return html;
  }
}
