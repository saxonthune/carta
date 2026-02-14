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
  // Vault management
  isFirstRun: () => ipcRenderer.invoke('is-first-run'),
  getVaultPath: () => ipcRenderer.invoke('get-vault-path'),
  getDefaultVaultPath: () => ipcRenderer.invoke('get-default-vault-path'),
  chooseVaultFolder: () => ipcRenderer.invoke('choose-vault-folder'),
  initializeVault: (path: string) => ipcRenderer.invoke('initialize-vault', path),
  revealVault: () => ipcRenderer.invoke('reveal-vault'),
});
