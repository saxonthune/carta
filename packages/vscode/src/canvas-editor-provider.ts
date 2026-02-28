import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { WorkspaceServerInfo } from '@carta/server/embedded-host';
import { deriveRoomName } from './find-carta-workspace.js';

export class CartaCanvasEditorProvider implements vscode.CustomReadonlyEditorProvider {
  private extensionUri: vscode.Uri;
  private getServerInfo: () => WorkspaceServerInfo | null;
  private cartaDir: string | null;

  constructor(
    extensionUri: vscode.Uri,
    getServerInfo: () => WorkspaceServerInfo | null,
    cartaDir: string | null,
  ) {
    this.extensionUri = extensionUri;
    this.getServerInfo = getServerInfo;
    this.cartaDir = cartaDir;
  }

  static register(
    context: vscode.ExtensionContext,
    getServerInfo: () => WorkspaceServerInfo | null,
    cartaDir: string | null,
  ): vscode.Disposable {
    const provider = new CartaCanvasEditorProvider(
      context.extensionUri,
      getServerInfo,
      cartaDir,
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
    const webview = webviewPanel.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist', 'web-client'),
      ],
    };

    const serverInfo = this.getServerInfo();
    const roomName = this.cartaDir
      ? deriveRoomName(this.cartaDir, document.uri.fsPath)
      : null;

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

    // Inject __CARTA_CONFIG__ and auto-navigate script before </head>
    // The auto-navigate script sets ?doc=ROOM_NAME on the WebView URL via history.replaceState.
    // This runs synchronously before module scripts, so main.tsx reads it from URLSearchParams.
    const configScripts = [
      serverInfo
        ? `<script>window.__CARTA_CONFIG__=${JSON.stringify({ syncUrl: serverInfo.url })}</script>`
        : '',
      roomName
        ? `<script>history.replaceState(null, '', '?doc=' + ${JSON.stringify(encodeURIComponent(roomName))});</script>`
        : '',
    ].filter(Boolean).join('\n');

    // Inject CSP meta tag before </head>
    const cspSource = webview.cspSource;
    const cspMeta = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src ${cspSource}; style-src ${cspSource} 'unsafe-inline'; connect-src ws://127.0.0.1:* http://127.0.0.1:*; img-src ${cspSource} data:; font-src ${cspSource};">`;

    html = html.replace('</head>', `${cspMeta}\n${configScripts}\n</head>`);

    return html;
  }
}
