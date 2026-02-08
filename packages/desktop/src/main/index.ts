import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { is, getRendererUrl } from './config.js';
import { startEmbeddedServer, stopEmbeddedServer, ensureVaultHasDocument, type EmbeddedServerInfo } from './server.js';
import {
  readPreferences,
  writePreferences,
  getDefaultVaultPath,
  isFirstRun,
  ensureVaultExists,
} from './preferences.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let serverInfo: EmbeddedServerInfo | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  mainWindow.maximize();
  mainWindow.show();

  const url = getRendererUrl();

  if (is.dev) {
    // In dev mode, pass server info as query params to Vite dev server
    const devUrl = new URL(url);
    if (serverInfo) {
      devUrl.searchParams.set('desktopServer', serverInfo.url);
      devUrl.searchParams.set('desktopWs', serverInfo.wsUrl);
    }
    mainWindow.loadURL(devUrl.toString());
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(fileURLToPath(url));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * Resolve the path to the bundled MCP script.
 */
function getMcpScriptPath(): string {
  if (is.dev) {
    // In dev, point to the server package dist
    return join(__dirname, '../../../server/dist/mcp/stdio.js');
  }
  // In production, it's in extraResources
  return join(process.resourcesPath, 'carta-mcp', 'stdio.js');
}

/**
 * Generate the Claude Desktop MCP config snippet.
 */
function getMcpConfigSnippet(): string {
  const mcpPath = getMcpScriptPath();
  const config = {
    mcpServers: {
      carta: {
        command: 'node',
        args: [mcpPath],
        env: serverInfo ? { CARTA_SERVER_URL: serverInfo.url } : undefined,
      },
    },
  };
  return JSON.stringify(config, null, 2);
}

// IPC handlers for existing functionality
ipcMain.handle('get-server-info', () => serverInfo);
ipcMain.handle('get-mcp-config', () => getMcpConfigSnippet());
ipcMain.handle('get-mcp-script-path', () => getMcpScriptPath());

// IPC handlers for vault management
ipcMain.handle('is-first-run', () => {
  return isFirstRun(app.getPath('userData'));
});

ipcMain.handle('get-vault-path', () => {
  const prefs = readPreferences(app.getPath('userData'));
  return prefs.vaultPath;
});

ipcMain.handle('get-default-vault-path', () => {
  return getDefaultVaultPath();
});

ipcMain.handle('choose-vault-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose Carta Vault Folder',
    defaultPath: getDefaultVaultPath(),
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('reveal-vault', async () => {
  const prefs = readPreferences(app.getPath('userData'));
  if (prefs.vaultPath) {
    await shell.openPath(prefs.vaultPath);
  }
});

ipcMain.handle('initialize-vault', async (_event, vaultPath: string) => {
  try {
    ensureVaultExists(vaultPath);
    const userDataPath = app.getPath('userData');
    const prefs = readPreferences(userDataPath);
    prefs.vaultPath = vaultPath;
    writePreferences(userDataPath, prefs);

    // Stop existing server if running (handles vault change case)
    if (serverInfo) {
      await stopEmbeddedServer();
    }

    serverInfo = await startEmbeddedServer(userDataPath, vaultPath);
    const documentId = ensureVaultHasDocument();
    console.log(`[Desktop] Vault initialized: ${serverInfo.url}, documentId: ${documentId}`);
    return { url: serverInfo.url, wsUrl: serverInfo.wsUrl, port: serverInfo.port, documentId };
  } catch (err) {
    console.error('[Desktop] Failed to initialize vault:', err);
    throw err;
  }
});

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');
  const prefs = readPreferences(userDataPath);

  // Only start server if vault is configured
  if (prefs.vaultPath) {
    try {
      serverInfo = await startEmbeddedServer(userDataPath, prefs.vaultPath);
      console.log(`[Desktop] Embedded server started: ${serverInfo.url}`);
    } catch (err) {
      console.error('[Desktop] Failed to start embedded server:', err);
    }
  } else {
    console.log('[Desktop] First run - waiting for vault selection');
  }

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', async (event) => {
  // Prevent immediate quit to flush documents
  event.preventDefault();

  try {
    await stopEmbeddedServer();
    console.log('[Desktop] Embedded server stopped, documents saved');
  } catch (err) {
    console.error('[Desktop] Error stopping embedded server:', err);
  }

  // Actually quit now
  app.exit(0);
});
