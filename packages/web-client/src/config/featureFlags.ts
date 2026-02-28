/**
 * Runtime config injected by `carta serve` into index.html,
 * or passed via URL params when embedded in an iframe.
 */
interface CartaConfig {
  syncUrl?: string;
  /** Set to true when running inside the VS Code extension webview */
  embedded?: boolean;
}

function getRuntimeConfig(): CartaConfig {
  if (typeof window === 'undefined') return {};
  const injected = (window as unknown as { __CARTA_CONFIG__?: CartaConfig }).__CARTA_CONFIG__ ?? {};

  // URL params override injected config (used by dev-mode iframe in VS Code)
  const params = new URLSearchParams(window.location.search);
  const syncUrlParam = params.get('syncUrl');
  const embeddedParam = params.get('embedded');

  return {
    ...injected,
    ...(syncUrlParam ? { syncUrl: syncUrlParam } : {}),
    ...(embeddedParam === 'true' ? { embedded: true } : {}),
  };
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
 * Simplified configuration: 2 env vars.
 *
 * Env vars:
 *   VITE_SYNC_URL  — Sync server URL. Presence = multi-document mode with real-time sync.
 *   VITE_AI_MODE   — 'none' | 'user-key' | 'server-proxy' (default: 'none')
 *   VITE_DEBUG     — 'true' | 'false' (default: DEV mode)
 *
 * Everything else is derived.
 */
const runtimeConfig = getRuntimeConfig();

export const config = {
  /** Debug mode: shows additional info in UI */
  debug: getDebugMode(),
  syncUrl: (runtimeConfig.syncUrl || import.meta.env.VITE_SYNC_URL || null) as string | null,
  aiMode: (import.meta.env.VITE_AI_MODE || 'none') as 'none' | 'user-key' | 'server-proxy',
  /** Whether the app is embedded in a host (e.g. VS Code WebView) — canvas-only, no chrome */
  embedded: runtimeConfig.embedded === true,

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

  /** WebSocket URL for sync (derived from syncUrl) */
  get syncWsUrl(): string | null {
    if (!this.syncUrl) return null;
    return this.syncUrl.replace('http', 'ws');
  },
};
