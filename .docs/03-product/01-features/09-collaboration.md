---
title: Collaboration
status: active
---

# Collaboration

Carta supports real-time collaboration when connected to a server. Collaboration is derived from the presence of a server URL — there is no independent collaboration toggle.

## Single-Document Mode (No Server)

When no `VITE_SERVER_URL` is configured and the app runs in a browser:
- One document auto-created in IndexedDB
- No document browser, no multi-document management
- No WebSocket connection
- Share button and connection status hidden
- Works like Excalidraw — user edits a single document directly

## Multi-Document Mode (Server Present)

When a server URL is configured (or desktop auto-detects its embedded server):
- Storage: server database (IndexedDB not used — server is source of truth)
- WebSocket sync via y-websocket
- Yjs CRDT handles conflict resolution automatically
- URL-based document routing: `?doc={documentId}`
- Document browser available for listing, creating, and selecting documents

### Document Browser

When no `?doc=` parameter is present and a server is available, the Document Browser appears in required mode (cannot be dismissed). Users must select an existing document or create a new one.

The document browser renders whatever grouping metadata the server provides (folders, tags, projects). This organization is managed by the storage host, not Carta.

### Connection Status

A status indicator in the header shows sync state: connected, disconnected, or syncing.

### Sharing

Share button copies the document URL to clipboard for sending to collaborators.

## Desktop Mode

The Electron desktop app separates two server concerns:

### Local MCP Server (always runs)

Reads the currently-open Y.Doc in memory. Provides zero-latency AI tool access regardless of where the document came from (local folder or remote server). Auto-discovered via `server.json` in `{userData}/`.

### Document Server (source-dependent)

- **Standalone**: Embedded HTTP + WebSocket server on `127.0.0.1`. Persists binary Y.Doc snapshots in `{userData}/documents/`.
- **Connected**: Remote server handles persistence and collaboration. The desktop app syncs via WebSocket, and the local Y.Doc replica stays in sync via Yjs CRDT.

This separation means an enterprise user gets fast local MCP while their documents live on the company server.

### Desktop Feature Detection

Desktop mode is runtime-detected via `window.electronAPI?.isDesktop`. When detected:
- Server URL auto-set to embedded server (or remote if configured)
- Collaboration enabled (WebSocket sync)
- IndexedDB persistence skipped (server handles persistence)
- Local MCP server started
