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
});
