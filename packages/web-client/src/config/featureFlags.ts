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
 * Simplified configuration: 2 env vars + 1 detected.
 *
 * Env vars:
 *   VITE_SERVER_URL  — Server URL. Presence = server mode (collaboration, multi-document).
 *   VITE_AI_MODE     — 'none' | 'user-key' | 'server-proxy' (default: 'none')
 *
 * Detected:
 *   isDesktop — true when running in Electron
 *
 * Everything else is derived.
 */
export const config = {
  serverUrl: isDesktop
    ? (getDesktopServerUrl() || 'http://127.0.0.1:51234')
    : (import.meta.env.VITE_SERVER_URL || null) as string | null,
  aiMode: (import.meta.env.VITE_AI_MODE || 'none') as 'none' | 'user-key' | 'server-proxy',
  isDesktop,

  /** Whether a server is configured (enables collaboration, multi-document mode) */
  get hasServer(): boolean { return !!this.serverUrl; },

  /** WebSocket URL for the server (derived from serverUrl or desktop params) */
  get wsUrl(): string | null {
    if (!this.serverUrl) return null;
    if (isDesktop) {
      return getDesktopWsUrl() || this.serverUrl.replace('http', 'ws');
    }
    return this.serverUrl.replace('http', 'ws');
  },
};
