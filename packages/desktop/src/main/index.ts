import { app, BrowserWindow, ipcMain } from 'electron';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { is, getRendererUrl } from './config.js';
import { startEmbeddedServer, stopEmbeddedServer, type EmbeddedServerInfo } from './server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let mainWindow: BrowserWindow | null = null;
let serverInfo: EmbeddedServerInfo | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  });

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
        env: serverInfo ? { CARTA_COLLAB_API_URL: serverInfo.url } : undefined,
      },
    },
  };
  return JSON.stringify(config, null, 2);
}

// IPC handlers
ipcMain.handle('get-server-info', () => serverInfo);
ipcMain.handle('get-mcp-config', () => getMcpConfigSnippet());
ipcMain.handle('get-mcp-script-path', () => getMcpScriptPath());

app.whenReady().then(async () => {
  // Start embedded server before creating window
  try {
    serverInfo = await startEmbeddedServer(app.getPath('userData'));
    console.log(`[Desktop] Embedded server started: ${serverInfo.url}`);
  } catch (err) {
    console.error('[Desktop] Failed to start embedded server:', err);
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
