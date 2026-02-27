import { useState, useEffect, useCallback, useMemo } from 'react';
import { Folder, FolderOpen, CaretLeft } from '@phosphor-icons/react';
import type { DocumentSummary } from '@carta/schema';
import { toKebabCase } from '@carta/schema';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Breadcrumb from '../ui/Breadcrumb';
import SearchBar from '../ui/SearchBar';
import FolderRow from '../ui/FolderRow';
import DocumentRow from '../ui/DocumentRow';
import ChoiceCard from '../ui/ChoiceCard';
import { useVault } from '../../contexts/VaultContext';
import { generateRandomName } from '../../utils/randomNames';

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

function FolderIcon() {
  return <Folder weight="regular" size={18} />;
}

function FolderOpenIcon() {
  return <FolderOpen weight="regular" size={18} />;
}

interface DocumentBrowserModalProps {
  onClose: () => void;
  /** When true, modal cannot be dismissed — user must select or create a document */
  required?: boolean;
}

export default function DocumentBrowserModal({ onClose, required = false }: DocumentBrowserModalProps) {
  const { adapter } = useVault();

  // Desktop first-run: show vault picker instead of document browser
  if (adapter.needsVaultSetup) {
    return <VaultSetupModal onClose={onClose} />;
  }

  return <DocumentBrowserContent onClose={onClose} required={required} adapter={adapter} />;
}

function VaultSetupModal({ onClose }: { onClose: () => void }) {
  const { adapter } = useVault();
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [defaultPath, setDefaultPath] = useState<string | null>(null);

  useEffect(() => {
    window.electronAPI?.getDefaultVaultPath().then(setDefaultPath);
  }, []);

  async function handleSelectDefault() {
    if (!adapter.initializeVault) return;
    setStatus('loading');
    setError(null);
    try {
      const defaultVaultPath = await window.electronAPI!.getDefaultVaultPath();
      const result = await adapter.initializeVault(defaultVaultPath);
      redirectToDocument(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up vault');
      setStatus('error');
    }
  }

  async function handleChooseFolder() {
    if (!adapter.initializeVault || !window.electronAPI) return;
    setStatus('loading');
    setError(null);
    try {
      const path = await window.electronAPI.chooseVaultFolder();
      if (!path) {
        setStatus('idle');
        return;
      }
      const result = await adapter.initializeVault(path);
      redirectToDocument(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to set up vault');
      setStatus('error');
    }
  }

  function redirectToDocument(result: { documentId: string; syncUrl: string; wsUrl: string }) {
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('desktopServer', result.syncUrl);
    currentUrl.searchParams.set('desktopWs', result.wsUrl);
    currentUrl.searchParams.set('doc', result.documentId);
    window.location.href = currentUrl.toString();
  }

  const isLoading = status === 'loading';

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Welcome to Carta"
      maxWidth="80vw"
      showCloseButton={false}
      preventBackdropClose={true}
    >
      <div className="bg-surface-depth-3 -mx-5 -my-4 px-4 py-4 flex flex-col gap-3">
        <div className="bg-surface-depth-2 rounded-xl px-4 py-4 shadow-sm">
          <p className="text-sm text-content-muted mb-4">
            Choose where to store your projects. This folder will contain
            human-readable JSON files you can version control.
          </p>
          <div className="space-y-3">
            <ChoiceCard
              icon={<FolderIcon />}
              title="Use default location"
              description={defaultPath || '~/Documents/Carta/'}
              recommended
              onClick={handleSelectDefault}
              disabled={isLoading}
            />
            <ChoiceCard
              icon={<FolderOpenIcon />}
              title="Choose folder..."
              description="Select a custom location for your vault"
              onClick={handleChooseFolder}
              disabled={isLoading}
            />
          </div>

          {isLoading && (
            <div className="mt-4 text-center text-content-muted text-sm">
              <div className="inline-block animate-spin rounded-full h-4 w-4 border-2 border-accent border-t-transparent mr-2 align-middle" />
              Setting up your vault...
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-danger/10 border border-danger/20 text-danger text-sm">
              {error}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

interface DocumentBrowserContentProps {
  onClose: () => void;
  required: boolean;
  adapter: ReturnType<typeof useVault>['adapter'];
}

function DocumentBrowserContent({ onClose, required, adapter }: DocumentBrowserContentProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [currentPath, setCurrentPath] = useState('/');
  const [newFolderName, setNewFolderName] = useState('');
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [createdFolders, setCreatedFolders] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Generate a random name once when modal opens
  const defaultName = useMemo(() => generateRandomName(), []);
  const [newTitle, setNewTitle] = useState(defaultName);
  const [customFilename, setCustomFilename] = useState(false);
  const [filenameOverride, setFilenameOverride] = useState('');

  const derivedFilenameBase = useMemo(() => {
    const slug = toKebabCase(newTitle.trim() || defaultName);
    return slug || 'untitled';
  }, [newTitle, defaultName]);

  const resolvedFilenameBase = customFilename ? filenameOverride : derivedFilenameBase;
  const resolvedFilename = resolvedFilenameBase + '.carta.json';

  // Filter documents by search query (case-insensitive substring match)
  const filteredDocuments = useMemo(() => {
    if (!searchQuery.trim()) return documents;
    const query = searchQuery.toLowerCase();
    return documents.filter(doc => doc.title.toLowerCase().includes(query));
  }, [documents, searchQuery]);

  // Derive folder view from filtered documents
  const folderView = useMemo(
    () => deriveFolderView(searchQuery.trim() ? filteredDocuments : documents, currentPath),
    [documents, filteredDocuments, searchQuery, currentPath]
  );

  // Merge derived folders with manually created folders (hide when searching)
  const visibleFolders = useMemo(
    () => searchQuery.trim()
      ? folderView.childFolders
      : mergeCreatedFolders(folderView.childFolders, createdFolders, currentPath),
    [folderView.childFolders, createdFolders, currentPath, searchQuery]
  );

  // When searching, show all matched documents regardless of folder
  const visibleDocuments = useMemo(() => {
    if (searchQuery.trim()) {
      return filteredDocuments.sort((a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    }
    return folderView.documents;
  }, [searchQuery, filteredDocuments, folderView.documents]);

  const fetchDocuments = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const results = await adapter.listDocuments();
      setDocuments(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  const sanitizeFilenameBase = (value: string): string => {
    // Strip chars invalid in filenames and any .carta.json suffix the user may paste
    const stripped = value.replace(/[/\\:*?"<>|]/g, '');
    const base = stripped.replace(/\.carta(\.json)?$/, '').replace(/\.json$/, '');
    return base || 'untitled';
  };

  const handleFilenameOverrideChange = (value: string) => {
    setFilenameOverride(sanitizeFilenameBase(value));
  };

  const handleCustomFilenameToggle = (checked: boolean) => {
    setCustomFilename(checked);
    if (checked && !filenameOverride) {
      setFilenameOverride(derivedFilenameBase);
    }
  };

  const handleCreate = async () => {
    const titleToUse = newTitle.trim() || defaultName;
    if (!titleToUse) return;

    setCreating(true);
    try {
      const documentId = await adapter.createDocument(titleToUse, currentPath, resolvedFilename);
      handleSelect(documentId);
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

  const isSearching = !!searchQuery.trim();
  const isEmpty = visibleFolders.length === 0 && visibleDocuments.length === 0;

  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title={required ? 'Select a Document' : 'Documents'}
      maxWidth="80vw"
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

        {/* Vault Header Island (depth-2) */}
        <div className="bg-surface-depth-2 rounded-xl px-4 py-3 shadow-sm flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm text-content-muted min-w-0">
            <Folder weight="regular" size={18} className="shrink-0" />
            <span className="truncate">{adapter.displayAddress}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {window.electronAPI?.revealVault && (
              <Button variant="ghost" size="sm" onClick={() => window.electronAPI!.revealVault()}>
                Reveal
              </Button>
            )}
            {adapter.canChangeVault && (
              <Button variant="ghost" size="sm" onClick={() => adapter.changeVault?.()}>
                Change Vault
              </Button>
            )}
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search documents..."
            />
          </div>
        </div>

        {/* Nav Island (depth-2) — hidden when searching */}
        {!isSearching && (
          <div className="bg-surface-depth-2 rounded-xl px-4 py-3 shadow-sm">
            <Breadcrumb segments={folderView.breadcrumbs} onNavigate={navigateToBreadcrumb} />
          </div>
        )}

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
                {/* Back row when not at root (hidden when searching) */}
                {!isSearching && currentPath !== '/' && (
                  <button
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer hover:bg-surface-depth-3/50 transition-colors border-none bg-transparent text-left"
                    onClick={navigateUp}
                  >
                    <CaretLeft weight="bold" size={16} className="text-content-muted shrink-0" />
                    <span className="text-sm text-content-muted">..</span>
                  </button>
                )}

                {/* Folders (hidden when searching) */}
                {!isSearching && visibleFolders.map((folder) => (
                  <FolderRow
                    key={folder}
                    name={folder}
                    onClick={() => navigateToFolder(folder)}
                  />
                ))}

                {/* Documents */}
                {visibleDocuments.map((doc) => (
                  <DocumentRow
                    key={doc.id}
                    title={doc.title}
                    updatedAt={formatUpdatedAt(doc.updatedAt)}
                    nodeCount={doc.nodeCount}
                    filename={doc.filename}
                    onClick={() => handleSelect(doc.id)}
                  />
                ))}

                {/* Empty state */}
                {isEmpty && (
                  <div className="py-8 text-center text-content-muted">
                    {isSearching
                      ? 'No documents match your search.'
                      : currentPath === '/' ? 'No documents yet. Create one below.' : 'Empty folder.'}
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
            <div className="flex flex-col gap-2">
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
              <div className="flex flex-col gap-1 pl-1">
                {customFilename ? (
                  <div className="flex items-center gap-0">
                    <Input
                      value={filenameOverride}
                      onChange={(e) => handleFilenameOverrideChange(e.target.value)}
                      disabled={creating}
                      className="text-sm"
                      placeholder="filename"
                    />
                    <span className="text-xs text-content-muted whitespace-nowrap pl-1.5">.carta.json</span>
                  </div>
                ) : (
                  <span className="text-xs text-content-muted">{derivedFilenameBase}.carta.json</span>
                )}
                <label className="flex items-center gap-1.5 text-xs text-content-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={customFilename}
                    onChange={(e) => handleCustomFilenameToggle(e.target.checked)}
                    disabled={creating}
                    className="cursor-pointer"
                  />
                  Set filename separately
                </label>
              </div>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
