/**
 * Feature flags replacing the old VITE_STATIC_MODE boolean.
 *
 * Env vars:
 *   VITE_STORAGE_BACKENDS  — 'local' | 'server' | 'both' (default: 'local')
 *   VITE_AI_MODE           — 'none' | 'user-key' | 'server-proxy' | 'both' (default: 'none')
 *   VITE_COLLABORATION     — 'enabled' | 'disabled' (default: 'disabled')
 *   VITE_CARTA_API_URL     — server base URL (default: 'http://localhost:1234')
 */
export const config = {
  storageBackends: (import.meta.env.VITE_STORAGE_BACKENDS || 'local') as 'local' | 'server' | 'both',
  aiMode: (import.meta.env.VITE_AI_MODE || 'none') as 'none' | 'user-key' | 'server-proxy' | 'both',
  collaboration: import.meta.env.VITE_COLLABORATION === 'enabled',
  serverUrl: import.meta.env.VITE_CARTA_API_URL || 'http://localhost:1234',

  get localEnabled() { return this.storageBackends === 'local' || this.storageBackends === 'both'; },
  get serverEnabled() { return this.storageBackends === 'server' || this.storageBackends === 'both'; },
};
