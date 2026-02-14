import { useState, useRef, useCallback } from 'react';
import { useClickOutside } from './useClickOutside';

export interface ShareMenuProps {
  documentId: string | undefined;
  mode: 'local' | 'shared';
}

/**
 * Share/collaboration dropdown menu.
 * Shows "Copy Link" button when already sharing, or a form to start sharing.
 */
export function ShareMenu({ documentId, mode }: ShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [shareDocumentId, setShareDocumentId] = useState('');
  const [shareServerUrl, setShareServerUrl] = useState('ws://localhost:1234');
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setIsOpen(false), []);
  useClickOutside(menuRef, isOpen, closeMenu);

  const handleCopyDocumentUrl = () => {
    if (documentId) {
      const url = `${window.location.origin}${window.location.pathname}?doc=${documentId}`;
      navigator.clipboard.writeText(url);
      setIsOpen(false);
    }
  };

  const handleStartSharing = async () => {
    // In the new model, sharing is handled by creating a server document
    // For now, copy the current document URL
    if (documentId) {
      const url = `${window.location.origin}${window.location.pathname}?doc=${documentId}`;
      navigator.clipboard.writeText(url);
    }
    setIsOpen(false);
  };

  // If already in shared mode with a document, show simple copy link button
  if (mode === 'shared' && documentId) {
    return (
      <button
        className="px-4 py-2 text-sm font-medium bg-surface text-content border border-border rounded-lg cursor-pointer hover:bg-surface-alt transition-colors"
        onClick={handleCopyDocumentUrl}
        title="Copy link"
      >
        Copy Link
      </button>
    );
  }

  // Otherwise show the share menu with options
  return (
    <div className="relative" ref={menuRef}>
      <button
        className="px-4 py-2 text-sm font-medium bg-surface text-content border border-border rounded-lg cursor-pointer hover:bg-surface-alt transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        title="Share document"
      >
        Share
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg overflow-hidden z-50 min-w-[280px]">
          <div className="px-4 py-3 border-b border-subtle">
            <div className="text-sm font-medium text-content">Start Collaboration</div>
            <div className="text-xs text-content-muted mt-1">Share this document with others in real-time</div>
          </div>
          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs text-content-muted mb-1">Document ID (optional)</label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-md border border-subtle bg-surface text-content text-sm focus:outline-none focus:border-accent"
                placeholder="Auto-generated if empty"
                value={shareDocumentId}
                onChange={(e) => setShareDocumentId(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-content-muted mb-1">Server URL</label>
              <input
                type="text"
                className="w-full px-3 py-2 rounded-md border border-subtle bg-surface text-content text-sm focus:outline-none focus:border-accent"
                placeholder="ws://localhost:1234"
                value={shareServerUrl}
                onChange={(e) => setShareServerUrl(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end px-4 py-3 border-t border-subtle gap-2">
            <button
              className="px-4 py-2 text-sm rounded-md bg-surface text-content hover:bg-surface-alt transition-colors"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </button>
            <button
              className="px-4 py-2 text-sm font-medium border-none rounded-md bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600 transition-colors"
              onClick={handleStartSharing}
            >
              Start Sharing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
