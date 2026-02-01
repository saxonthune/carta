import { useState, useRef, useEffect } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';

/**
 * Connection status indicator for shared mode.
 * Shows connection state and connected user count.
 */
export default function ConnectionStatus() {
  const { mode, adapter, documentId } = useDocumentContext();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
  const [clientCount, setClientCount] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // Subscribe to connection status changes
  useEffect(() => {
    if (!adapter.getConnectionStatus) {
      return;
    }

    // Update status
    const updateStatus = () => {
      setConnectionStatus(adapter.getConnectionStatus!());
      setClientCount(adapter.getConnectedClients?.() || 0);
    };

    updateStatus();

    // Subscribe to adapter changes for status updates
    const unsubscribe = adapter.subscribe(updateStatus);
    return unsubscribe;
  }, [adapter, mode]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMenuOpen]);

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'bg-emerald-500';
      case 'connecting':
        return 'bg-amber-500 animate-pulse';
      case 'disconnected':
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusLabel = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Connected';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
      default:
        return 'Local';
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
        title={connectionStatus === 'connected' ? `Document: ${documentId}` : getStatusLabel()}
      >
        {/* Status dot */}
        <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />

        {/* Status text */}
        <span className="text-sm">
          {mode === 'shared' && connectionStatus === 'connected' ? (
            <>
              {clientCount > 1 && (
                <span className="font-medium">{clientCount} users</span>
              )}
              {clientCount <= 1 && <span>Shared</span>}
            </>
          ) : (
            getStatusLabel()
          )}
        </span>
      </button>

      {isMenuOpen && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg overflow-hidden z-50 min-w-[200px]">
          <div className="px-4 py-3 border-b border-subtle">
            <div className="text-sm font-medium text-content">Connection Status</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
              <span className="text-sm text-content-muted">{getStatusLabel()}</span>
            </div>
          </div>

          {mode === 'shared' && documentId && (
            <div className="px-4 py-3 border-b border-subtle">
              <div className="text-xs text-content-muted mb-1">Document</div>
              <div className="text-sm text-content font-mono break-all">{documentId}</div>
            </div>
          )}

          {connectionStatus === 'connected' && clientCount > 0 && (
            <div className="px-4 py-3 border-b border-subtle">
              <div className="text-xs text-content-muted mb-1">Connected Users</div>
              <div className="text-sm text-content">{clientCount}</div>
            </div>
          )}

          <div className="px-4 py-2">
            <div className="text-xs text-content-muted">
              {mode === 'local' && 'Changes are saved locally in your browser.'}
              {mode === 'shared' && connectionStatus === 'connected' && 'Changes sync in real-time with other users.'}
              {mode === 'shared' && connectionStatus === 'connecting' && 'Establishing connection to collaboration server...'}
              {mode === 'shared' && connectionStatus === 'disconnected' && 'Disconnected. Changes will sync when reconnected.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
