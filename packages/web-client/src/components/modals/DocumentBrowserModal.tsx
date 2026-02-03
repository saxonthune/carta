import { useState, useEffect, useCallback } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { config } from '../../config/featureFlags';

interface DocumentSummary {
  id: string;
  title: string;
  updatedAt: string;
  nodeCount: number;
}

interface DocumentBrowserModalProps {
  onClose: () => void;
  /** When true, modal cannot be dismissed — user must select or create a document */
  required?: boolean;
}

export default function DocumentBrowserModal({ onClose, required = false }: DocumentBrowserModalProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.serverUrl}/api/documents`);
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
      }
      const data = await response.json();
      const results: DocumentSummary[] = (data.documents || []).map((doc: DocumentSummary) => ({
        id: doc.id,
        title: doc.title,
        updatedAt: doc.updatedAt,
        nodeCount: doc.nodeCount,
      }));

      results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setDocuments(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const handleCreate = async () => {
    const titleToUse = newTitle.trim() || (required ? 'Untitled Project' : '');
    if (!titleToUse && !required) return;

    setCreating(true);
    try {
      const response = await fetch(`${config.serverUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleToUse || 'Untitled Project' }),
      });
      if (!response.ok) {
        throw new Error(`Failed to create document: ${response.statusText}`);
      }
      const data = await response.json();
      handleSelect(data.document.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create document');
      setCreating(false);
    }
  };

  const handleSelect = (documentId: string) => {
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
    <Modal
      isOpen={true}
      onClose={onClose}
      title={required ? 'Select a Document' : 'Documents'}
      maxWidth="500px"
      showCloseButton={!required}
      preventBackdropClose={required}
      footer={!required ? (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      ) : undefined}
    >
      {/* Create New */}
      <div className="pb-3 mb-3 border-b border-border">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 rounded-md border border-subtle bg-surface text-content text-sm focus:outline-none focus:border-accent"
            placeholder={required ? 'Document title (optional)' : 'New document title'}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (newTitle.trim() || required)) {
                handleCreate();
              }
            }}
            disabled={creating}
          />
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={(!newTitle.trim() && !required) || creating}
          >
            {creating ? 'Creating...' : (required ? 'New Document' : 'Create')}
          </Button>
        </div>
      </div>

      {/* Document List */}
      <div>
        {loading ? (
          <div className="py-4 text-center text-content-muted">Loading...</div>
        ) : error ? (
          <div className="py-4">
            <div className="text-center text-red-500 mb-2">{error}</div>
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={fetchDocuments}>Retry</Button>
            </div>
          </div>
        ) : documents.length === 0 ? (
          <div className="py-4 text-center text-content-muted">
            No documents yet. Create one above.
          </div>
        ) : (
          <div className="divide-y divide-subtle">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center hover:bg-surface-alt transition-colors"
              >
                <button
                  className="flex-1 text-left px-4 py-3 cursor-pointer border-none bg-transparent"
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
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
