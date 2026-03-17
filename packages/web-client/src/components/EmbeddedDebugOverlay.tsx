import { useState, useEffect } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import { usePages } from '../hooks/usePages';
import { useNodes } from '../hooks/useNodes';
import { config } from '../config/featureFlags';

export default function EmbeddedDebugOverlay() {
  const { adapter, mode, documentId } = useDocumentContext();
  const { pages, activePage } = usePages();
  const { nodes } = useNodes();
  const [connectionStatus, setConnectionStatus] = useState<string>('unknown');

  useEffect(() => {
    const update = () => {
      setConnectionStatus(adapter.getConnectionStatus?.() ?? 'n/a');
    };
    update();
    const unsubscribe = adapter.subscribe(update);
    return unsubscribe;
  }, [adapter]);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 text-white text-xs font-mono px-3 py-1 flex gap-4">
      <span>doc: {documentId}</span>
      <span>mode: {mode}</span>
      <span>sync: {config.syncUrl ?? 'none'}</span>
      <span>ws: {connectionStatus}</span>
      <span>pages: {pages.length}</span>
      <span>active: {activePage ?? 'none'}</span>
      <span>nodes: {nodes.length}</span>
    </div>
  );
}
