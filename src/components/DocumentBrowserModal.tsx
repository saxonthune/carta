import { useState, useEffect } from 'react';

interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
  nodeCount: number;
}

interface DocumentBrowserModalProps {
  onClose: () => void;
  /** When true, modal cannot be dismissed - user must select or create a document */
  required?: boolean;
}

export default function DocumentBrowserModal({ onClose, required = false }: DocumentBrowserModalProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const apiUrl = import.meta.env.VITE_CARTA_API_URL || 'http://localhost:1234';

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/documents`);
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
      }
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    // Use "Untitled Project" as default when required mode and no title entered
    const titleToUse = newTitle.trim() || (required ? 'Untitled Project' : '');
    if (!titleToUse) return;

    setCreating(true);
    try {
      const response = await fetch(`${apiUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleToUse }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create document: ${response.statusText}`);
      }
      const data = await response.json();
      // Navigate to the new document
      handleSelect(data.document.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
      setCreating(false);
    }
  };

  const handleSelect = (documentId: string) => {
    // Navigate via URL - preserves single-doc architecture
    window.location.href = `${window.location.origin}${window.location.pathname}?doc=${documentId}`;
  };

  const formatUpdatedAt = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]"
      onClick={required ? undefined : onClose}
    >
      <div
        className="bg-surface rounded-xl w-[90%] max-w-[500px] flex flex-col shadow-2xl max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
          <h2 className="m-0 text-lg text-content font-semibold">
            {required ? 'Select a Document' : 'Documents'}
          </h2>
          {!required && (
            <button
              className="w-9 h-9 border-none rounded-md bg-transparent text-content-subtle text-2xl cursor-pointer flex items-center justify-center hover:bg-surface-alt hover:text-content"
              onClick={onClose}
            >
              ×
            </button>
          )}
        </div>

        {/* Create New */}
        <div className="px-4 py-3 border-b border-subtle">
          <div className="flex gap-2">
            <input
              type="text"
              className="flex-1 px-3 py-2 rounded-md border border-subtle bg-surface text-content text-sm focus:outline-none focus:border-accent"
              placeholder={required ? "Document title (optional)" : "New document title"}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (newTitle.trim() || required)) {
                  handleCreate();
                }
              }}
              disabled={creating}
            />
            <button
              className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white border-none rounded-md cursor-pointer hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleCreate}
              disabled={(!newTitle.trim() && !required) || creating}
            >
              {creating ? 'Creating...' : (required ? 'New Document' : 'Create')}
            </button>
          </div>
        </div>

        {/* Document List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-content-muted">Loading...</div>
          ) : error ? (
            <div className="p-4">
              <div className="text-center text-red-500 mb-2">{error}</div>
              <div className="text-center">
                <button
                  className="px-3 py-1 text-sm text-content-muted hover:text-content"
                  onClick={fetchDocuments}
                >
                  Retry
                </button>
              </div>
            </div>
          ) : documents.length === 0 ? (
            <div className="p-4 text-center text-content-muted">
              No documents yet. Create one above.
            </div>
          ) : (
            <div className="divide-y divide-subtle">
              {documents.map((doc) => (
                <button
                  key={doc.id}
                  className="w-full text-left px-4 py-3 cursor-pointer hover:bg-surface-alt transition-colors border-none bg-transparent"
                  onClick={() => handleSelect(doc.id)}
                >
                  <div className="flex items-start gap-3">
                    <svg
                      className="w-5 h-5 text-content-muted mt-0.5 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-content truncate">
                        {doc.title}
                      </div>
                      <div className="text-xs text-content-muted mt-0.5">
                        Updated {formatUpdatedAt(doc.updatedAt)} · {doc.nodeCount} node{doc.nodeCount === 1 ? '' : 's'}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer - only show Cancel when not required */}
        {!required && (
          <div className="flex justify-end px-4 py-3 border-t border-subtle">
            <button
              className="px-4 py-2 text-sm rounded-md bg-surface text-content hover:bg-surface-alt transition-colors border border-subtle"
              onClick={onClose}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
