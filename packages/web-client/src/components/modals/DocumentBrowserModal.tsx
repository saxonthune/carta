import { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { config } from '../../config/featureFlags';
import { generateRandomName } from '../../utils/randomNames';

interface DocumentSummary {
  id: string;
  title: string;
  folder: string;
  updatedAt: string;
  nodeCount: number;
}

interface FolderView {
  currentPath: string;
  breadcrumbs: string[];
  childFolders: string[];
  documents: DocumentSummary[];
}

/**
 * Derive visible folders and documents at a given path.
 * Folders are virtual - derived from document folder paths.
 */
function deriveFolderView(docs: DocumentSummary[], currentPath: string): FolderView {
  const normalizedPath = currentPath === '/' ? '/' : currentPath.replace(/\/$/, '');
  const pathPrefix = normalizedPath === '/' ? '/' : normalizedPath + '/';

  const childFolders = new Set<string>();
  const docsAtLevel: DocumentSummary[] = [];

  for (const doc of docs) {
    const docFolder = doc.folder || '/';

    // Document is exactly at this level
    if (docFolder === normalizedPath) {
      docsAtLevel.push(doc);
      continue;
    }

    // Document is under this path - extract immediate child folder
    if (docFolder.startsWith(pathPrefix)) {
      const remainder = docFolder.slice(pathPrefix.length);
      const nextSlash = remainder.indexOf('/');
      const childFolder = nextSlash === -1 ? remainder : remainder.slice(0, nextSlash);
      if (childFolder) {
        childFolders.add(childFolder);
      }
    }
  }

  // Build breadcrumbs from path
  const breadcrumbs = normalizedPath === '/'
    ? []
    : normalizedPath.slice(1).split('/');

  return {
    currentPath: normalizedPath,
    breadcrumbs,
    childFolders: Array.from(childFolders).sort(),
    documents: docsAtLevel.sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ),
  };
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
  const [creating, setCreating] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);

  // Generate a random name once when modal opens
  const defaultName = useMemo(() => generateRandomName(), []);
  const [newTitle, setNewTitle] = useState(defaultName);

  // Derive folder view from documents
  const folderView = useMemo(
    () => deriveFolderView(documents, currentPath),
    [documents, currentPath]
  );

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${config.serverUrl}/api/documents`);
      if (!response.ok) {
        throw new Error(`Failed to fetch documents: ${response.statusText}`);
      }
      const data = await response.json();
      const results: DocumentSummary[] = (data.documents || []).map((doc: any) => ({
        id: doc.id,
        title: doc.title,
        folder: doc.folder || '/',
        updatedAt: doc.updatedAt,
        nodeCount: doc.nodeCount,
      }));
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
    const titleToUse = newTitle.trim() || defaultName;
    if (!titleToUse) return;

    setCreating(true);
    try {
      const response = await fetch(`${config.serverUrl}/api/documents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: titleToUse, folder: currentPath }),
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

  const navigateToFolder = (folderName: string) => {
    const newPath = currentPath === '/'
      ? `/${folderName}`
      : `${currentPath}/${folderName}`;
    setCurrentPath(newPath);
  };

  const navigateUp = () => {
    if (currentPath === '/') return;
    const lastSlash = currentPath.lastIndexOf('/');
    setCurrentPath(lastSlash === 0 ? '/' : currentPath.slice(0, lastSlash));
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index < 0) {
      setCurrentPath('/');
    } else {
      setCurrentPath('/' + folderView.breadcrumbs.slice(0, index + 1).join('/'));
    }
  };

  const handleCreateFolder = () => {
    const name = newFolderName.trim();
    if (!name) return;
    // Folders are virtual - just navigate to it
    navigateToFolder(name);
    setNewFolderName('');
    setShowNewFolder(false);
  };

  const formatUpdatedAt = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
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
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-1 text-sm text-content-muted mb-3 flex-wrap">
        <button
          className="hover:text-content transition-colors px-1 py-0.5 rounded hover:bg-surface-alt border-none bg-transparent cursor-pointer"
          onClick={() => navigateToBreadcrumb(-1)}
        >
          /
        </button>
        {folderView.breadcrumbs.map((crumb, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="text-content-muted/50">/</span>
            <button
              className="hover:text-content transition-colors px-1 py-0.5 rounded hover:bg-surface-alt border-none bg-transparent cursor-pointer"
              onClick={() => navigateToBreadcrumb(i)}
            >
              {crumb}
            </button>
          </span>
        ))}
      </div>

      {/* Create New Document/Folder */}
      <div className="pb-3 mb-3 border-b border-border">
        {/* New Folder Input */}
        {showNewFolder ? (
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              className="flex-1 px-3 py-2 rounded-md border border-subtle bg-surface text-content text-sm focus:outline-none focus:border-accent"
              placeholder="Folder name"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateFolder();
                if (e.key === 'Escape') setShowNewFolder(false);
              }}
              autoFocus
            />
            <Button variant="secondary" onClick={handleCreateFolder}>
              Go
            </Button>
            <Button variant="ghost" onClick={() => setShowNewFolder(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <button
            className="mb-2 text-xs text-content-muted hover:text-content transition-colors border-none bg-transparent cursor-pointer"
            onClick={() => setShowNewFolder(true)}
          >
            + New folder
          </button>
        )}

        {/* New Document */}
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 px-3 py-2 rounded-md border border-subtle bg-surface text-content text-sm focus:outline-none focus:border-accent"
            placeholder="Document title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleCreate();
              }
            }}
            disabled={creating}
          />
          <Button
            variant="primary"
            onClick={handleCreate}
            disabled={creating}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </div>
      </div>

      {/* Content List */}
      <div className="max-h-[400px] overflow-y-auto">
        {loading ? (
          <div className="py-4 text-center text-content-muted">Loading...</div>
        ) : error ? (
          <div className="py-4">
            <div className="text-center text-red-500 mb-2">{error}</div>
            <div className="text-center">
              <Button variant="ghost" size="sm" onClick={fetchDocuments}>Retry</Button>
            </div>
          </div>
        ) : folderView.childFolders.length === 0 && folderView.documents.length === 0 ? (
          <div className="py-4 text-center text-content-muted">
            {currentPath === '/' ? 'No documents yet. Create one above.' : 'Empty folder.'}
          </div>
        ) : (
          <div className="divide-y divide-subtle">
            {/* Back button when not at root */}
            {currentPath !== '/' && (
              <button
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-alt transition-colors cursor-pointer border-none bg-transparent text-left"
                onClick={navigateUp}
              >
                <svg className="w-5 h-5 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 12H5M12 19l-7-7 7-7" />
                </svg>
                <span className="text-sm text-content-muted">..</span>
              </button>
            )}

            {/* Folders */}
            {folderView.childFolders.map((folder) => (
              <button
                key={folder}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-alt transition-colors cursor-pointer border-none bg-transparent text-left"
                onClick={() => navigateToFolder(folder)}
              >
                <svg className="w-5 h-5 text-amber-500" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span className="text-sm font-medium text-content">{folder}</span>
              </button>
            ))}

            {/* Documents */}
            {folderView.documents.map((doc) => (
              <button
                key={doc.id}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-alt transition-colors cursor-pointer border-none bg-transparent text-left"
                onClick={() => handleSelect(doc.id)}
              >
                <svg className="w-5 h-5 text-content-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                </svg>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-content truncate">{doc.title}</div>
                  <div className="text-xs text-content-muted">
                    {formatUpdatedAt(doc.updatedAt)} · {doc.nodeCount} node{doc.nodeCount === 1 ? '' : 's'}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
