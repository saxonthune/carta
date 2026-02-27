import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';
import createDebug from 'debug';
import { is, getRendererUrl } from './config.js';
import { startDesktopServer, stopDesktopServer, initializeWorkspace, type WorkspaceServerInfo } from './server.js';
import {
  readPreferences,
  writePreferences,
  isFirstRun,
} from './preferences.js';

const log = createDebug('carta:desktop');

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let serverInfo: WorkspaceServerInfo | null = null;

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

// IPC handlers for workspace management
ipcMain.handle('is-first-run', () => {
  return isFirstRun(app.getPath('userData'));
});

ipcMain.handle('get-workspace-path', () => {
  const prefs = readPreferences(app.getPath('userData'));
  return prefs.workspacePath;
});

ipcMain.handle('choose-workspace-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory', 'createDirectory'],
    title: 'Choose Project Folder',
  });

  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }

  return result.filePaths[0];
});

ipcMain.handle('reveal-workspace', async () => {
  const prefs = readPreferences(app.getPath('userData'));
  if (prefs.workspacePath) {
    await shell.openPath(prefs.workspacePath);
  }
});

ipcMain.handle('initialize-workspace', async (_event, workspacePath: string) => {
  try {
    const userDataPath = app.getPath('userData');

    // Scaffold .carta/ inside the project directory (idempotent)
    initializeWorkspace(workspacePath, basename(workspacePath));

    // Stop existing server if running (handles workspace change case)
    if (serverInfo) {
      await stopDesktopServer();
    }

    serverInfo = await startDesktopServer(userDataPath, workspacePath);

    const prefs = readPreferences(userDataPath);
    prefs.workspacePath = workspacePath;
    writePreferences(userDataPath, prefs);

    log('Workspace initialized: %s', serverInfo.url);
    return { url: serverInfo.url, wsUrl: serverInfo.wsUrl, port: serverInfo.port };
  } catch (err) {
    log('Failed to initialize workspace: %O', err);
    throw err;
  }
});

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');
  const prefs = readPreferences(userDataPath);

  // Start workspace server automatically if a valid workspace is configured
  if (prefs.workspacePath) {
    try {
      serverInfo = await startDesktopServer(userDataPath, prefs.workspacePath);
      log('Workspace server started: %s', serverInfo.url);
    } catch (err) {
      log('Failed to start workspace server: %O', err);
      // Continue to create window — web client will show workspace selection dialog
    }
  } else {
    log('No workspace configured - waiting for workspace selection');
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
    await stopDesktopServer();
    log('Workspace server stopped, documents saved');
  } catch (err) {
    log('Error stopping workspace server: %O', err);
  }

  // Actually quit now
  app.exit(0);
});
