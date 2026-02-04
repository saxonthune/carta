import { useState, useRef, useEffect } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import { config } from '../config/featureFlags';
import ConnectionStatus from './ConnectionStatus';
import DocumentBrowserModal from './modals/DocumentBrowserModal';
import ExamplesModal from './modals/ExamplesModal';
import ProjectInfoModal from './modals/ProjectInfoModal';
import ClearWorkspaceModal from './modals/ClearWorkspaceModal';
import RestoreDefaultSchemasModal from './modals/RestoreDefaultSchemasModal';
import { getExamples, type Example } from '../utils/examples';
import { cleanAllLocalData } from '../stores/documentRegistry';

interface HeaderProps {
  title: string;
  description: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onCompile: () => void;
  onClear?: (mode: 'instances' | 'all') => void;
  onRestoreDefaultSchemas?: () => void;
  onToggleAI?: () => void;
  onLoadExample?: (example: Example) => void;
}

const getInitialTheme = (): 'light' | 'dark' | 'warm' => {
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'warm' | null;
  if (savedTheme) return savedTheme;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

export default function Header({ title, description, onTitleChange, onDescriptionChange, onExport, onImport, onCompile, onClear, onRestoreDefaultSchemas, onToggleAI, onLoadExample }: HeaderProps) {
  const { mode, documentId } = useDocumentContext();
  const [theme, setTheme] = useState<'light' | 'dark' | 'warm'>(() => {
    const initialTheme = getInitialTheme();
    document.documentElement.setAttribute('data-theme', initialTheme);
    return initialTheme;
  });
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [isProjectInfoModalOpen, setIsProjectInfoModalOpen] = useState(false);
  const [isExamplesModalOpen, setIsExamplesModalOpen] = useState(false);
  const [isDocBrowserOpen, setIsDocBrowserOpen] = useState(false);
  const [isClearWorkspaceModalOpen, setIsClearWorkspaceModalOpen] = useState(false);
  const [isRestoreDefaultSchemasModalOpen, setIsRestoreDefaultSchemasModalOpen] = useState(false);
  const [shareDocumentId, setShareDocumentId] = useState('');
  const [shareServerUrl, setShareServerUrl] = useState('ws://localhost:1234');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  const examples = getExamples();

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
      if (shareMenuRef.current && !shareMenuRef.current.contains(event.target as Node)) {
        setIsShareMenuOpen(false);
      }
    };

    if (isThemeMenuOpen || isSettingsMenuOpen || isShareMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isThemeMenuOpen, isSettingsMenuOpen, isShareMenuOpen]);

  // Copy document URL to clipboard
  const handleCopyDocumentUrl = () => {
    if (documentId) {
      const url = `${window.location.origin}${window.location.pathname}?doc=${documentId}`;
      navigator.clipboard.writeText(url);
      setIsShareMenuOpen(false);
    }
  };

  // Start sharing (create shared document)
  const handleStartSharing = async () => {
    // In the new model, sharing is handled by creating a server document
    // For now, copy the current document URL
    if (documentId) {
      const url = `${window.location.origin}${window.location.pathname}?doc=${documentId}`;
      navigator.clipboard.writeText(url);
    }
    setIsShareMenuOpen(false);
  };

  const changeTheme = (newTheme: 'light' | 'dark' | 'warm') => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    setIsThemeMenuOpen(false);
  };

  const getThemeIcon = (themeName: 'light' | 'dark' | 'warm') => {
    switch (themeName) {
      case 'light':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        );
      case 'dark':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
          </svg>
        );
      case 'warm':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v6M12 17v6M4.22 4.22l4.24 4.24M15.54 15.54l4.24 4.24M1 12h6M17 12h6M4.22 19.78l4.24-4.24M15.54 8.46l4.24-4.24" />
          </svg>
        );
    }
  };

  const getThemeLabel = (themeName: 'light' | 'dark' | 'warm') => {
    switch (themeName) {
      case 'light': return 'Light';
      case 'dark': return 'Dark';
      case 'warm': return 'Warm';
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      onImport(file);
    }
    event.target.value = '';
  };

  const handleClear = () => {
    setIsClearWorkspaceModalOpen(true);
    setIsSettingsMenuOpen(false);
  };

  const handleClearInstances = () => {
    if (onClear) {
      onClear('instances');
    }
  };

  const handleClearEverything = () => {
    if (onClear) {
      onClear('all');
    }
  };

  const handleClearAndRestore = () => {
    if (onClear) {
      onClear('all');
    }
    onRestoreDefaultSchemas?.();
  };

  const handleRestoreDefaultSchemas = () => {
    onRestoreDefaultSchemas?.();
  };

  return (
    <header className="h-12 bg-surface border-b grid grid-cols-[1fr_auto_1fr] items-center px-0 shrink-0">
      <div className="flex items-center justify-start pl-3 gap-2">
        <span className="text-xl font-bold tracking-tight text-content select-none">Carta</span>
        {config.debug && (
          <div className="flex items-center gap-1.5 text-[10px] font-mono text-content-muted">
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">DEV</span>
            <span className={`px-1.5 py-0.5 rounded ${mode === 'shared' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400' : 'bg-slate-500/20 text-slate-600 dark:text-slate-400'}`}>
              {mode === 'shared' ? 'SERVER' : 'LOCAL'}
            </span>
            {config.isDesktop && (
              <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-600 dark:text-purple-400">DESKTOP</span>
            )}
            {config.aiMode !== 'none' && (
              <span className="px-1.5 py-0.5 rounded bg-green-500/20 text-green-600 dark:text-green-400">AI:{config.aiMode}</span>
            )}
            {mode === 'local' && (
              <button
                className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer border-none"
                onClick={async () => {
                  await cleanAllLocalData();
                  window.location.href = window.location.pathname;
                }}
                title="Clear all local data and reload as new user"
              >
                Clean
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center">
        <h1
          className="m-0 text-lg font-semibold text-content cursor-pointer px-2 py-1 rounded hover:bg-surface-alt transition-colors"
          onClick={() => setIsProjectInfoModalOpen(true)}
          title="Click to edit project info"
        >
          {title}
        </h1>
      </div>

      <div className="flex gap-2 items-center justify-end">
        <input
          ref={fileInputRef}
          type="file"
          accept=".carta"
          onChange={handleFileSelect}
          className="hidden"
        />
        {/* Connection Status — only when collaboration is active */}
        {config.hasServer && mode === 'shared' && <ConnectionStatus />}

        {/* Share button and menu — only when server is available */}
        {config.hasServer && (
          <div className="relative" ref={shareMenuRef}>
            {mode === 'shared' && documentId ? (
              <button
                className="px-4 py-2 text-sm font-medium bg-surface text-content border border-border rounded-lg cursor-pointer hover:bg-surface-alt transition-colors"
                onClick={handleCopyDocumentUrl}
                title="Copy link"
              >
                Copy Link
              </button>
            ) : (
              <button
                className="px-4 py-2 text-sm font-medium bg-surface text-content border border-border rounded-lg cursor-pointer hover:bg-surface-alt transition-colors"
                onClick={() => setIsShareMenuOpen(!isShareMenuOpen)}
                title="Share document"
              >
                Share
              </button>
            )}
            {isShareMenuOpen && (
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
                    onClick={() => setIsShareMenuOpen(false)}
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
        )}

        {/* Document browser button */}
        <button
          className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
          onClick={() => setIsDocBrowserOpen(true)}
          title="Browse documents"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
        </button>
        <button
          className="px-4 py-2 text-sm font-medium bg-surface text-content border border-border rounded-lg cursor-pointer hover:bg-surface-alt transition-colors"
          onClick={onExport}
          title="Export project to .carta file"
        >
          Export
        </button>
        <button
          className="px-4 py-2 text-sm font-medium bg-surface text-content border border-border rounded-lg cursor-pointer hover:bg-surface-alt transition-colors"
          onClick={handleImportClick}
          title="Import project from .carta file"
        >
          Import
        </button>
        <button
          className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white border-none rounded-lg cursor-pointer hover:bg-emerald-600 transition-colors"
          onClick={onCompile}
          title="Compile project"
        >
          Compile
        </button>
        {onToggleAI && (
          <button
            className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
            onClick={onToggleAI}
            title="Open AI Assistant"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2a4 4 0 0 1 4 4v1h1a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3h1V6a4 4 0 0 1 4-4z" />
              <circle cx="9" cy="13" r="1.5" />
              <circle cx="15" cy="13" r="1.5" />
              <path d="M9 17h6" />
            </svg>
          </button>
        )}
        <div className="relative" ref={themeMenuRef}>
          <button
            className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
            onClick={() => setIsThemeMenuOpen(!isThemeMenuOpen)}
            title="Change theme"
          >
            {getThemeIcon(theme)}
          </button>
          {isThemeMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg overflow-hidden z-50 min-w-[140px]">
              {(['light', 'dark', 'warm'] as const).map((themeName) => (
                <button
                  key={themeName}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm cursor-pointer transition-colors text-left border-none ${
                    theme === themeName
                      ? 'bg-accent text-white'
                      : 'bg-surface text-content hover:bg-surface-alt'
                  }`}
                  onClick={() => changeTheme(themeName)}
                >
                  {getThemeIcon(themeName)}
                  <span>{getThemeLabel(themeName)}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="relative" ref={settingsMenuRef}>
          <button
            data-testid="settings-menu-button"
            className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
            onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
            title="Settings"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          {isSettingsMenuOpen && (
            <div data-testid="settings-menu" className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg overflow-hidden z-50 min-w-[200px]">
              {examples.length > 0 && onLoadExample && (
                <button
                  className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
                  onClick={() => {
                    setIsExamplesModalOpen(true);
                    setIsSettingsMenuOpen(false);
                  }}
                >
                  Load Example
                </button>
              )}
              {config.isDesktop && (
                <button
                  className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
                  onClick={async () => {
                    setIsSettingsMenuOpen(false);
                    try {
                      const mcpConfig = await window.electronAPI!.getMcpConfig();
                      await navigator.clipboard.writeText(mcpConfig);
                      // Brief visual feedback could be added here
                    } catch (err) {
                      console.error('Failed to copy MCP config:', err);
                    }
                  }}
                >
                  Copy MCP Config
                </button>
              )}
              <button
                className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
                onClick={() => {
                  setIsRestoreDefaultSchemasModalOpen(true);
                  setIsSettingsMenuOpen(false);
                }}
              >
                Restore Default Schemas
              </button>
              <button
                data-testid="settings-clear-button"
                className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
                onClick={() => handleClear()}
              >
                Clear
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Clear Workspace Modal */}
      <ClearWorkspaceModal
        isOpen={isClearWorkspaceModalOpen}
        onClose={() => setIsClearWorkspaceModalOpen(false)}
        onClearInstances={handleClearInstances}
        onClearEverything={handleClearEverything}
        onClearAndRestore={handleClearAndRestore}
      />

      {/* Restore Default Schemas Modal */}
      <RestoreDefaultSchemasModal
        isOpen={isRestoreDefaultSchemasModalOpen}
        onClose={() => setIsRestoreDefaultSchemasModalOpen(false)}
        onConfirm={handleRestoreDefaultSchemas}
      />

      {/* Project Info Modal */}
      {isProjectInfoModalOpen && (
        <ProjectInfoModal
          title={title}
          description={description}
          onSave={(newTitle, newDescription) => {
            onTitleChange(newTitle);
            onDescriptionChange(newDescription);
          }}
          onClose={() => setIsProjectInfoModalOpen(false)}
        />
      )}

      {/* Examples Modal */}
      {isExamplesModalOpen && onLoadExample && (
        <ExamplesModal
          examples={examples}
          onSelect={(example) => {
            onLoadExample(example);
            setIsExamplesModalOpen(false);
          }}
          onClose={() => setIsExamplesModalOpen(false)}
        />
      )}

      {/* Document Browser Modal */}
      {isDocBrowserOpen && (
        <DocumentBrowserModal onClose={() => setIsDocBrowserOpen(false)} />
      )}
    </header>
  );
}
