import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { WorkspaceServerInfo } from '@carta/server/embedded-host';
import { deriveRoomName } from './find-carta-workspace.js';

export function buildDevModeHtml(roomName: string | null): string {
  const devServerUrl = 'http://localhost:5173';
  const iframeSrc = roomName
    ? `${devServerUrl}?doc=${encodeURIComponent(roomName)}`
    : devServerUrl;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${devServerUrl};">
  <style>html, body, iframe { margin: 0; padding: 0; width: 100%; height: 100%; border: none; overflow: hidden; }</style>
</head>
<body>
  <iframe src="${iframeSrc}"></iframe>
</body>
</html>`;
}

export class CartaCanvasEditorProvider implements vscode.CustomReadonlyEditorProvider {
  private extensionUri: vscode.Uri;
  private getServerInfo: () => WorkspaceServerInfo | null;
  private cartaDir: string | null;
  private devMode: boolean;

  constructor(
    extensionUri: vscode.Uri,
    getServerInfo: () => WorkspaceServerInfo | null,
    cartaDir: string | null,
    devMode: boolean,
  ) {
    this.extensionUri = extensionUri;
    this.getServerInfo = getServerInfo;
    this.cartaDir = cartaDir;
    this.devMode = devMode;
  }

  static register(
    context: vscode.ExtensionContext,
    getServerInfo: () => WorkspaceServerInfo | null,
    cartaDir: string | null,
    devMode: boolean,
  ): vscode.Disposable {
    const provider = new CartaCanvasEditorProvider(
      context.extensionUri,
      getServerInfo,
      cartaDir,
      devMode,
    );
    return vscode.window.registerCustomEditorProvider(
      'carta.canvasEditor',
      provider,
      { webviewOptions: { retainContextWhenHidden: true } },
    );
  }

  openCustomDocument(uri: vscode.Uri): vscode.CustomDocument {
    return { uri, dispose() {} };
  }

  resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
  ): void {
    const serverInfo = this.getServerInfo();
    const roomName = this.cartaDir
      ? deriveRoomName(this.cartaDir, document.uri.fsPath)
      : null;

    if (this.devMode) {
      webviewPanel.webview.options = { enableScripts: true };
      webviewPanel.webview.html = buildDevModeHtml(roomName);
      return;
    }

    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'web-client'),
      ],
    };
    webview.html = this.buildWebviewHtml(webview, serverInfo, roomName);
  }

  private buildWebviewHtml(
    webview: vscode.Webview,
    serverInfo: WorkspaceServerInfo | null,
    roomName: string | null,
  ): string {
    const webClientDir = vscode.Uri.joinPath(this.extensionUri, 'dist', 'web-client');
    const indexPath = path.join(webClientDir.fsPath, 'index.html');

    if (!fs.existsSync(indexPath)) {
      return '<html><body><h1>Web client not found</h1><p>Run the extension build first.</p></body></html>';
    }

    let html = fs.readFileSync(indexPath, 'utf-8');

    // Rewrite all asset paths from absolute (/assets/..., /vite.svg) to WebView URIs
    html = html.replace(
      /(src|href)="\/([^"]+)"/g,
      (_match, attr, assetPath) => {
        const assetUri = webview.asWebviewUri(
          vscode.Uri.joinPath(webClientDir, assetPath),
        );
        return `${attr}="${assetUri}"`;
      },
    );

    // Generate a nonce for inline scripts to satisfy CSP
    const nonce = crypto.randomUUID().replace(/-/g, '');

    // Inject __CARTA_CONFIG__ and auto-navigate script before </head>
    // The auto-navigate script sets ?doc=ROOM_NAME on the WebView URL via history.replaceState.
    // This runs synchronously before module scripts, so main.tsx reads it from URLSearchParams.
    const cartaConfig = {
      ...(serverInfo ? { syncUrl: serverInfo.url } : {}),
      embedded: true,
    };
    const configScripts = [
      `<script nonce="${nonce}">window.__CARTA_CONFIG__=${JSON.stringify(cartaConfig)}</script>`,
      roomName
        ? `<script nonce="${nonce}">history.replaceState(null, '', '?doc=' + ${JSON.stringify(encodeURIComponent(roomName))});</script>`
        : '',
    ].filter(Boolean).join('\n');

    // Inject CSP meta tag before </head>
    const cspSource = webview.cspSource;
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'nonce-${nonce}' ${cspSource}; style-src ${cspSource} 'unsafe-inline'; connect-src ws://127.0.0.1:* http://127.0.0.1:*; img-src ${cspSource} data:; font-src ${cspSource};">`;

    html = html.replace('</head>', `${cspMeta}\n${configScripts}\n</head>`);

    return html;
  }
}
