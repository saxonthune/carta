/**
 * WebSocket server for real-time document sync
 */

import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import type { DocumentService } from '../documents/index.js';

interface ConnectionState {
  subscribedDocuments: Set<string>;
}

interface WSMessage {
  type: string;
  documentId?: string;
  document?: unknown;
  patch?: { version?: number; [key: string]: unknown };
  message?: string;
  serverVersion?: number;
  clientVersion?: number;
}

/**
 * Create WebSocket server for real-time sync
 */
export function createWebSocketServer(httpServer: Server, documentService: DocumentService) {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  // Track connections and their subscriptions
  const connections = new Map<WebSocket, ConnectionState>();
  const documentSubscribers = new Map<string, Set<WebSocket>>();

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');

    // Initialize connection state
    connections.set(ws, { subscribedDocuments: new Set() });

    ws.on('message', async (data) => {
      try {
        const message: WSMessage = JSON.parse(data.toString());
        await handleMessage(ws, message);
      } catch (error) {
        sendMessage(ws, {
          type: 'error',
          message: error instanceof Error ? error.message : 'Invalid message',
        });
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');

      const state = connections.get(ws);
      if (state) {
        // Remove from all document subscriptions
        for (const docId of state.subscribedDocuments) {
          const subscribers = documentSubscribers.get(docId);
          if (subscribers) {
            subscribers.delete(ws);
            if (subscribers.size === 0) {
              documentSubscribers.delete(docId);
            }
          }
        }
      }
      connections.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  });

  async function handleMessage(ws: WebSocket, message: WSMessage) {
    const state = connections.get(ws);
    if (!state) return;

    switch (message.type) {
      case 'document:subscribe': {
        const { documentId } = message;
        if (!documentId) return;

        // Add to subscriptions
        state.subscribedDocuments.add(documentId);
        if (!documentSubscribers.has(documentId)) {
          documentSubscribers.set(documentId, new Set());
        }
        documentSubscribers.get(documentId)!.add(ws);

        // Send current document state
        const document = await documentService.getDocument(documentId);
        if (document) {
          sendMessage(ws, {
            type: 'document:sync',
            documentId,
            document,
          });
        } else {
          sendMessage(ws, {
            type: 'error',
            message: `Document not found: ${documentId}`,
          });
        }
        break;
      }

      case 'document:unsubscribe': {
        const { documentId } = message;
        if (!documentId) return;

        state.subscribedDocuments.delete(documentId);
        const subscribers = documentSubscribers.get(documentId);
        if (subscribers) {
          subscribers.delete(ws);
          if (subscribers.size === 0) {
            documentSubscribers.delete(documentId);
          }
        }
        break;
      }

      case 'document:update': {
        const { documentId, patch } = message;
        if (!documentId || !patch) return;

        // Load current document
        const currentDoc = await documentService.getDocument(documentId);
        if (!currentDoc) {
          sendMessage(ws, {
            type: 'error',
            message: `Document not found: ${documentId}`,
          });
          return;
        }

        // Check version for conflict detection
        const clientVersion = patch.version;
        if (clientVersion !== undefined && clientVersion !== currentDoc.version) {
          sendMessage(ws, {
            type: 'document:conflict',
            documentId,
            serverVersion: currentDoc.version,
            clientVersion,
          });
          return;
        }

        // Apply update
        const updatedDoc = await documentService.updateDocument(documentId, patch);
        if (!updatedDoc) {
          sendMessage(ws, {
            type: 'error',
            message: `Failed to update document: ${documentId}`,
          });
          return;
        }

        // Broadcast to all subscribers
        broadcastToDocument(documentId, {
          type: 'document:sync',
          documentId,
          document: updatedDoc,
        });
        break;
      }
    }
  }

  function sendMessage(ws: WebSocket, message: WSMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  function broadcastToDocument(documentId: string, message: WSMessage) {
    const subscribers = documentSubscribers.get(documentId);
    if (subscribers) {
      for (const ws of subscribers) {
        sendMessage(ws, message);
      }
    }
  }

  return wss;
}
