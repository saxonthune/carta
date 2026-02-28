import * as vscode from 'vscode';
import * as path from 'node:path';
import { startEmbeddedHost } from '@carta/server/embedded-host';
import type { EmbeddedHost } from '@carta/server/embedded-host';
import { scaffoldWorkspace } from '@carta/server/init';
import { CartaCanvasEditorProvider } from './canvas-editor-provider.js';
import { findCartaWorkspace } from './find-carta-workspace.js';

let host: EmbeddedHost | null = null;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const cartaDir = findCartaWorkspace();
  const devMode = vscode.workspace.getConfiguration('carta').get<boolean>('devMode', false);

  if (cartaDir) {
    try {
      host = await startEmbeddedHost({ cartaDir });
    } catch (err) {
      vscode.window.showErrorMessage(
        `Carta: Failed to start workspace server: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // Register custom editor provider
  context.subscriptions.push(
    CartaCanvasEditorProvider.register(
      context,
      () => host?.info ?? null,
      cartaDir,
      devMode,
    ),
  );

  // Register init command
  context.subscriptions.push(
    vscode.commands.registerCommand('carta.initWorkspace', async () => {
      const folders = vscode.workspace.workspaceFolders;
      if (!folders || folders.length === 0) {
        vscode.window.showErrorMessage('Carta: Open a folder first.');
        return;
      }

      const projectDir = folders[0].uri.fsPath;
      const dirName = path.basename(projectDir);
      const title = await vscode.window.showInputBox({
        prompt: 'Workspace title',
        value: dirName,
      });
      if (!title) return;

      const result = scaffoldWorkspace({ projectDir, title });
      if (result.alreadyExists) {
        vscode.window.showInformationMessage('Carta: .carta/ workspace already exists.');
        return;
      }

      vscode.window.showInformationMessage(
        `Carta: Workspace initialized (${result.created.length} files created).`,
      );

      // Start server for the new workspace
      if (!host) {
        const newCartaDir = path.join(projectDir, '.carta');
        try {
          host = await startEmbeddedHost({ cartaDir: newCartaDir });
        } catch (err) {
          vscode.window.showErrorMessage(
            `Carta: Failed to start server: ${err instanceof Error ? err.message : String(err)}`,
          );
        }
      }
    }),
  );
}

export async function deactivate(): Promise<void> {
  if (host) {
    await host.stop();
    host = null;
  }
}
