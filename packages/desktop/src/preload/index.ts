import { contextBridge, ipcRenderer } from 'electron';

// Expose minimal API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  },
  isDesktop: true,
  getServerInfo: () => ipcRenderer.invoke('get-server-info'),
  getMcpConfig: () => ipcRenderer.invoke('get-mcp-config'),
  getMcpScriptPath: () => ipcRenderer.invoke('get-mcp-script-path'),
  // Workspace management
  isFirstRun: () => ipcRenderer.invoke('is-first-run'),
  getWorkspacePath: () => ipcRenderer.invoke('get-workspace-path'),
  chooseWorkspaceFolder: () => ipcRenderer.invoke('choose-workspace-folder'),
  initializeWorkspace: (path: string) => ipcRenderer.invoke('initialize-workspace', path),
  revealWorkspace: () => ipcRenderer.invoke('reveal-workspace'),
});
