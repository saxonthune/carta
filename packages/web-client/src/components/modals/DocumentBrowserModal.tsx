import { useState, useEffect, useCallback, useMemo } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Breadcrumb from '../ui/Breadcrumb';
import FolderRow from '../ui/FolderRow';
import DocumentRow from '../ui/DocumentRow';
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
 * Merge manually created folders with derived folders.
 * Created folders are stored as full paths (e.g., '/projects/new-folder').
 * This function extracts the immediate child folder name for any created
 * folder path that is at or below the current path.
 */
function mergeCreatedFolders(
  derivedFolders: string[],
  createdFolders: string[],
  currentPath: string
): string[] {
  const normalizedPath = currentPath === '/' ? '/' : currentPath.replace(/\/$/, '');
  const pathPrefix = normalizedPath === '/' ? '/' : normalizedPath + '/';

  const createdChildren = new Set<string>();

  for (const folderPath of createdFolders) {
    // Check if this created folder is at or below current path
    if (!folderPath.startsWith(pathPrefix)) continue;

    const remainder = folderPath.slice(pathPrefix.length);
    if (remainder.length === 0) continue;

    // Extract the immediate child folder name
    const slashIndex = remainder.indexOf('/');
    const childName = slashIndex === -1 ? remainder : remainder.slice(0, slashIndex);
    if (childName) {
      createdChildren.add(childName);
    }
  }

  // Merge and deduplicate
  const merged = new Set([...derivedFolders, ...createdChildren]);
  return Array.from(merged).sort();
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
  const [createdFolders, setCreatedFolders] = useState<string[]>([]);

  // Generate a random name once when modal opens
  const defaultName = useMemo(() => generateRandomName(), []);
  const [newTitle, setNewTitle] = useState(defaultName);

  // Derive folder view from documents
  const folderView = useMemo(
    () => deriveFolderView(documents, currentPath),
    [documents, currentPath]
  );

  // Merge derived folders with manually created folders
  const visibleFolders = useMemo(
    () => mergeCreatedFolders(folderView.childFolders, createdFolders, currentPath),
    [folderView.childFolders, createdFolders, currentPath]
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
    // Track the full path of the created folder so it persists when navigating
    const newFolderPath = currentPath === '/' ? `/${name}` : `${currentPath}/${name}`;
    setCreatedFolders(prev => [...prev, newFolderPath]);
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

  const isEmpty = visibleFolders.length === 0 && folderView.documents.length === 0;

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
      {/* Ground (depth-3) */}
      <div className="bg-surface-depth-3 -mx-5 -my-4 px-4 py-4 flex flex-col gap-3">

        {/* Nav Island (depth-2) */}
        <div className="bg-surface-depth-2 rounded-xl px-4 py-3 shadow-sm">
          <Breadcrumb segments={folderView.breadcrumbs} onNavigate={navigateToBreadcrumb} />
        </div>

        {/* Content Island (depth-2) */}
        <div className="bg-surface-depth-2 rounded-xl p-2 shadow-sm flex-1 overflow-hidden">
          <div className="max-h-[400px] overflow-y-auto flex flex-col gap-0.5">
            {loading ? (
              <div className="py-8 text-center text-content-muted">Loading...</div>
            ) : error ? (
              <div className="py-8">
                <div className="text-center text-red-500 mb-2">{error}</div>
                <div className="text-center">
                  <Button variant="ghost" size="sm" onClick={fetchDocuments}>Retry</Button>
                </div>
              </div>
            ) : (
              <>
                {/* Back row when not at root */}
                {currentPath !== '/' && (
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-surface-depth-3/50 transition-colors border-none bg-transparent text-left"
                    onClick={navigateUp}
                  >
                    <svg className="w-5 h-5 text-content-muted shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M19 12H5M12 19l-7-7 7-7" />
                    </svg>
                    <span className="text-sm text-content-muted">..</span>
                  </button>
                )}

                {/* Folders */}
                {visibleFolders.map((folder) => (
                  <FolderRow
                    key={folder}
                    name={folder}
                    onClick={() => navigateToFolder(folder)}
                  />
                ))}

                {/* Documents */}
                {folderView.documents.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    title={doc.title}
                    updatedAt={formatUpdatedAt(doc.updatedAt)}
                    nodeCount={doc.nodeCount}
                    onClick={() => handleSelect(doc.id)}
                  />
                ))}

                {/* Empty state */}
                {isEmpty && (
                  <div className="py-8 text-center text-content-muted">
                    {currentPath === '/' ? 'No documents yet. Create one below.' : 'Empty folder.'}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Create Island (depth-2) */}
        <div className="bg-surface-depth-2 rounded-xl px-4 py-3 shadow-sm">
          {showNewFolder ? (
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Folder name"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setShowNewFolder(false);
                }}
                autoFocus
                className="flex-1"
              />
              <Button variant="secondary" onClick={handleCreateFolder}>
                Go
              </Button>
              <Button variant="ghost" onClick={() => setShowNewFolder(false)}>
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 items-center">
              <Input
                placeholder="Document title"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
                disabled={creating}
                className="flex-1"
              />
              <Button
                variant="secondary"
                onClick={() => setShowNewFolder(true)}
              >
                New Folder
              </Button>
              <Button
                variant="primary"
                onClick={handleCreate}
                disabled={creating}
              >
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
