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
  // Workspace management
  isFirstRun: () => Promise<boolean>;
  getWorkspacePath: () => Promise<string | null>;
  chooseWorkspaceFolder: () => Promise<string | null>;
  initializeWorkspace: (path: string) => Promise<{ url: string; wsUrl: string; port: number }>;
  revealWorkspace: () => Promise<void>;
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}

const isDesktop = typeof window !== 'undefined' && !!window.electronAPI?.isDesktop;

/**
 * Runtime config injected by `carta serve` into index.html.
 * Takes precedence over build-time VITE_SYNC_URL.
 */
interface CartaConfig {
  syncUrl?: string;
}

function getRuntimeConfig(): CartaConfig | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { __CARTA_CONFIG__?: CartaConfig }).__CARTA_CONFIG__ ?? null;
}

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
 * Determine debug mode:
 * - VITE_DEBUG env var overrides if set ('true'/'false')
 * - Otherwise, defaults to Vite's DEV mode (true in dev, false in production)
 */
function getDebugMode(): boolean {
  const envDebug = import.meta.env.VITE_DEBUG;
  if (envDebug === 'true') return true;
  if (envDebug === 'false') return false;
  return import.meta.env.DEV;
}

/**
 * Simplified configuration: 2 env vars + 1 detected.
 *
 * Env vars:
 *   VITE_SYNC_URL  — Sync server URL. Presence = multi-document mode with real-time sync.
 *   VITE_AI_MODE   — 'none' | 'user-key' | 'server-proxy' (default: 'none')
 *   VITE_DEBUG     — 'true' | 'false' (default: DEV mode)
 *
 * Detected:
 *   isDesktop — true when running in Electron
 *
 * Everything else is derived.
 */
export const config = {
  /** Debug mode: shows additional info in UI */
  debug: getDebugMode(),
  syncUrl: isDesktop
    ? (getDesktopServerUrl() || 'http://127.0.0.1:51234')
    : (getRuntimeConfig()?.syncUrl || import.meta.env.VITE_SYNC_URL || null) as string | null,
  aiMode: (import.meta.env.VITE_AI_MODE || 'none') as 'none' | 'user-key' | 'server-proxy',
  isDesktop,

  /** Whether a sync server is configured (enables collaboration, multi-document mode) */
  get hasSync(): boolean { return !!this.syncUrl; },

  /** Whether collaboration (WebSocket sync) is available */
  get collaboration(): boolean { return this.hasSync; },

  /** Whether the document browser should be available */
  get documentBrowser(): boolean { return this.hasSync; },

  /** Whether we're in single-document mode (demo site or solo browser) */
  get singleDocument(): boolean { return !this.hasSync; },

  /** Whether AI features are available */
  get hasAI(): boolean { return this.aiMode !== 'none'; },

  /** WebSocket URL for sync (derived from syncUrl or desktop params) */
  get syncWsUrl(): string | null {
    if (!this.syncUrl) return null;
    if (isDesktop) {
      return getDesktopWsUrl() || this.syncUrl.replace('http', 'ws');
    }
    return this.syncUrl.replace('http', 'ws');
  },
};
