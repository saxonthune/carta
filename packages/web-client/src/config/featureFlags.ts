/**
 * Desktop mode detection via Electron preload API or URL query params.
 */
interface ElectronAPI {
  platform: string;
  versions: { node: string; chrome: string; electron: string };
  isDesktop: boolean;
  getServerInfo: () => Promise<{ url: string; wsUrl: string; port: number } | null>;
  getMcpConfig: () => Promise<string>;
  getMcpScriptPath: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const isDesktop = typeof window !== 'undefined' && !!window.electronAPI?.isDesktop;

/**
 * In desktop mode, the embedded server URL can come from:
 * 1. URL query params (set by Electron main in dev mode)
 * 2. Will be fetched via IPC at runtime (production)
 */
function getDesktopServerUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('desktopServer');
}

function getDesktopWsUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  return params.get('desktopWs');
}

/**
 * Feature flags replacing the old VITE_STATIC_MODE boolean.
 *
 * Env vars:
 *   VITE_STORAGE_BACKENDS  — 'local' | 'server' | 'both' (default: 'local')
 *   VITE_AI_MODE           — 'none' | 'user-key' | 'server-proxy' | 'both' (default: 'none')
 *   VITE_COLLABORATION     — 'enabled' | 'disabled' (default: 'disabled')
 *   VITE_CARTA_API_URL     — server base URL (default: 'http://localhost:1234')
 *
 * Desktop mode overrides:
 *   When running in Electron, collaboration and server mode are auto-enabled,
 *   and the server URL points to the embedded server.
 */
export const config = {
  storageBackends: (isDesktop ? 'server' : (import.meta.env.VITE_STORAGE_BACKENDS || 'local')) as 'local' | 'server' | 'both',
  aiMode: (import.meta.env.VITE_AI_MODE || 'none') as 'none' | 'user-key' | 'server-proxy' | 'both',
  collaboration: isDesktop || import.meta.env.VITE_COLLABORATION === 'enabled',
  serverUrl: (isDesktop ? (getDesktopServerUrl() || 'http://127.0.0.1:51234') : (import.meta.env.VITE_CARTA_API_URL || 'http://localhost:1234')),
  isDesktop,

  /** WebSocket URL for the server (derived from serverUrl or desktop params) */
  get wsUrl(): string {
    if (isDesktop) {
      return getDesktopWsUrl() || this.serverUrl.replace('http', 'ws');
    }
    return this.serverUrl.replace('http', 'ws');
  },

  get localEnabled() { return this.storageBackends === 'local' || this.storageBackends === 'both'; },
  get serverEnabled() { return this.storageBackends === 'server' || this.storageBackends === 'both'; },
};
