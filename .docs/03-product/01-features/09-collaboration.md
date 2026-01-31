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
