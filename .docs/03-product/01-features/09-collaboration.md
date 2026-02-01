---
title: Collaboration
status: active
---

# Collaboration

Carta supports two hosting modes that determine collaboration capabilities.

## Static Mode

Single-user offline-first editing. Default for development (`npm run dev`).
- Storage: IndexedDB only
- No server connection
- Share button and connection status hidden
- Single document persisted locally

## Server Mode

Multi-user real-time collaboration (`npm run dev:client` with `npm run server`).
- Storage: MongoDB (server) with IndexedDB cache (client)
- WebSocket sync via y-websocket
- Yjs CRDT handles conflict resolution automatically
- URL-based document routing: `?doc={documentId}`

### Document Browser

In server mode, when no `?doc=` parameter is present, a Document Browser Modal appears in required mode (cannot be dismissed). Users must select an existing document or create a new one. Creating without a title defaults to "Untitled Project."

### Connection Status

A status indicator in the header shows sync state: connected, disconnected, or syncing.

### Sharing

Share button copies the document URL to clipboard for sending to collaborators.

## Desktop Mode

The Electron desktop app runs an embedded document server in the main process. The renderer connects via WebSocket for real-time sync, identical to server mode but without requiring an external server.

### Embedded Server

- HTTP + WebSocket server on `127.0.0.1` (default port 51234, random fallback)
- Same REST API as the collab-server (constructs, connections, schemas, deployables, compile)
- Yjs sync protocol over WebSocket
- Persistence: binary Y.Doc snapshots in `{userData}/documents/`

### MCP Integration

The embedded server writes `server.json` to `{userData}/` for MCP auto-discovery. The MCP binary reads this file when `CARTA_COLLAB_API_URL` is not set, enabling zero-config integration with Claude Desktop.

Users can copy the MCP configuration snippet from Settings > Copy MCP Config.

### Desktop Feature Flags

In desktop mode, feature flags are auto-configured:
- `STORAGE_BACKENDS` = `server` (embedded server handles persistence)
- `COLLABORATION` = `enabled` (WebSocket sync to embedded server)
- IndexedDB persistence is skipped (no y-indexeddb in desktop mode)
