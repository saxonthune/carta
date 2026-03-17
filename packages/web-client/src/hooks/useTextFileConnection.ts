import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';

interface TextFileConnection {
  ytext: Y.Text | null;
  awareness: unknown | null;
  isConnected: boolean;
}

/**
 * Manages a lightweight Yjs connection for a text file room.
 * Creates a Y.Doc, connects via WebSocket, returns Y.Text('content') + awareness.
 * Cleans up on unmount or when filePath changes.
 */
export function useTextFileConnection(filePath: string, syncUrl: string): TextFileConnection {
  const [isConnected, setIsConnected] = useState(false);
  const [ytext, setYtext] = useState<Y.Text | null>(null);
  const [awareness, setAwareness] = useState<unknown | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const doc = new Y.Doc();
    const text = doc.getText('content');
    setYtext(text);

    // Dynamic import to avoid bundling y-websocket in demo mode
    let destroyed = false;
    import('y-websocket').then(({ WebsocketProvider }) => {
      if (destroyed) { doc.destroy(); return; }
      const provider = new WebsocketProvider(syncUrl, filePath, doc);
      setAwareness(provider.awareness);

      provider.on('sync', () => {
        if (!destroyed) setIsConnected(true);
      });

      cleanupRef.current = () => {
        provider.destroy();
        doc.destroy();
      };
    });

    return () => {
      destroyed = true;
      setIsConnected(false);
      setYtext(null);
      setAwareness(null);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [filePath, syncUrl]);

  return { ytext, awareness, isConnected };
}
