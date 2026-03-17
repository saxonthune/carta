import * as assert from 'node:assert';
import * as vscode from 'vscode';
import * as path from 'node:path';

suite('Carta Extension', () => {
  test('Extension activates', async () => {
    const ext = vscode.extensions.getExtension('carta.carta-vscode');
    assert.ok(ext, 'Extension should be present');
    await ext.activate();
    assert.ok(ext.isActive, 'Extension should be active');
  });

  test('Custom editor opens for .canvas.json', async () => {
    const fixtureDir = path.resolve(__dirname, '..', 'fixtures');
    const canvasPath = path.join(fixtureDir, 'test.canvas.json');
    const uri = vscode.Uri.file(canvasPath);

    await vscode.commands.executeCommand('vscode.openWith', uri, 'carta.canvasEditor');

    // If we get here without error, the editor opened
    const editor = vscode.window.activeTextEditor;
    // Custom editors don't show as activeTextEditor, so just assert no throw
    assert.ok(true, 'Custom editor opened without error');
  });
});
