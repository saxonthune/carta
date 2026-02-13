/**
 * Debug logging utility that writes to both console and a file via Vite dev server.
 * In production builds, the fetch calls are no-ops (404s are ignored).
 * Read the log: tail -f /tmp/carta-layout-debug.log
 * Clear the log: > /tmp/carta-layout-debug.log
 */
export function debugLog(tag: string, data: unknown): void {
  console.debug(tag, data);
  try {
    const line = JSON.stringify({ t: Date.now(), tag, data });
    fetch('/__debug_log', { method: 'POST', body: line }).catch(() => {});
  } catch {
    // ignore serialization errors
  }
}
