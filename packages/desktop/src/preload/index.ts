import { contextBridge } from 'electron';

// Expose minimal API to renderer
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  versions: {
    node: process.versions.node,
    chrome: process.versions.chrome,
    electron: process.versions.electron
  }
  // Future: IPC for file dialogs, MCP lifecycle, preferences
});
