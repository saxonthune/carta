import { useState, useRef, useEffect } from 'react';
import { useDocumentContext } from '../contexts/DocumentContext';
import ConnectionStatus from './ConnectionStatus';

interface HeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onCompile: () => void;
  onClear?: (mode: 'instances' | 'all') => void;
  onRestoreDefaultSchemas?: () => void;
  onToggleAI?: () => void;
}

const getInitialTheme = (): 'light' | 'dark' | 'warm' => {
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'warm' | null;
  if (savedTheme) return savedTheme;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

export default function Header({ title, onTitleChange, onExport, onImport, onCompile, onClear, onRestoreDefaultSchemas, onToggleAI }: HeaderProps) {
  const { mode, roomId, connectToRoom, localMode } = useDocumentContext();
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [theme, setTheme] = useState<'light' | 'dark' | 'warm'>(() => {
    const initialTheme = getInitialTheme();
    document.documentElement.setAttribute('data-theme', initialTheme);
    return initialTheme;
  });
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [isShareMenuOpen, setIsShareMenuOpen] = useState(false);
  const [clearWarningMode, setClearWarningMode] = useState<'menu' | null>(null);
  const [restoreWarningMode, setRestoreWarningMode] = useState<'menu' | null>(null);
  const [shareRoomId, setShareRoomId] = useState('');
  const [shareServerUrl, setShareServerUrl] = useState('ws://localhost:1234');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const shareMenuRef = useRef<HTMLDivElement>(null);

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

  // Copy room URL to clipboard
  const handleCopyRoomUrl = () => {
    if (roomId) {
      const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
      navigator.clipboard.writeText(url);
      setIsShareMenuOpen(false);
    }
  };

  // Start sharing (create room)
  const handleStartSharing = async () => {
    if (!connectToRoom) return;
    const newRoomId = shareRoomId.trim() || `carta-${Date.now()}`;
    await connectToRoom(newRoomId, shareServerUrl);
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

  const handleTitleClick = () => {
    setEditedTitle(title);
    setIsEditingTitle(true);
  };

  const handleTitleBlur = () => {
    onTitleChange(editedTitle);
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onTitleChange(editedTitle);
      setIsEditingTitle(false);
    } else if (e.key === 'Escape') {
      setEditedTitle(title);
      setIsEditingTitle(false);
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
    setClearWarningMode('menu');
    setIsSettingsMenuOpen(false);
  };

  const confirmClear = (mode: 'instances' | 'all') => {
    if (onClear) {
      onClear(mode);
    }
    setClearWarningMode(null);
  };

  return (
    <header className="h-12 bg-surface border-b grid grid-cols-[1fr_auto_1fr] items-center px-0 shrink-0">
      <div className="flex items-center justify-start">
        {/* Left spacer - keeps title centered */}
      </div>

      <div className="flex items-center justify-center">
        {isEditingTitle ? (
          <input
            type="text"
            className="text-lg font-semibold text-content border-2 border-accent rounded px-2 py-1 outline-none min-w-[200px] bg-surface"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
            autoFocus
          />
        ) : (
          <h1
            className="m-0 text-lg font-semibold text-content cursor-pointer px-2 py-1 rounded hover:bg-surface-alt transition-colors"
            onClick={handleTitleClick}
          >
            {title}
          </h1>
        )}
      </div>

      <div className="flex gap-2 items-center justify-end">
        <input
          ref={fileInputRef}
          type="file"
          accept=".carta"
          onChange={handleFileSelect}
          className="hidden"
        />
        {/* Connection Status */}
        {!localMode && <ConnectionStatus />}

        {/* Share button and menu */}
        {!localMode && (
          <div className="relative" ref={shareMenuRef}>
            {mode === 'shared' && roomId ? (
              <button
                className="px-4 py-2 text-sm font-medium bg-surface text-content border border-border rounded-lg cursor-pointer hover:bg-surface-alt transition-colors"
                onClick={handleCopyRoomUrl}
                title="Copy room URL"
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
                    <label className="block text-xs text-content-muted mb-1">Room ID (optional)</label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 rounded-md border border-subtle bg-surface text-content text-sm focus:outline-none focus:border-accent"
                      placeholder="Auto-generated if empty"
                      value={shareRoomId}
                      onChange={(e) => setShareRoomId(e.target.value)}
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
              <button
                className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
                onClick={() => setRestoreWarningMode('menu')}
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

      {/* Clear Warning Modal */}
      {clearWarningMode && (
        <div data-testid="clear-modal" className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]" onClick={() => setClearWarningMode(null)}>
          <div className="bg-surface rounded-xl w-[90%] max-w-[400px] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
              <div>
                <h2 className="m-0 text-lg text-content font-semibold">Clear workspace</h2>
              </div>
              <button
                className="w-9 h-9 border-none rounded-md bg-transparent text-content-subtle text-2xl cursor-pointer flex items-center justify-center hover:bg-surface-alt hover:text-content"
                onClick={() => setClearWarningMode(null)}
              >
                ×
              </button>
            </div>

            {/* Content - Vertical list of options */}
            <div className="p-4 flex flex-col gap-2">
              <button
                data-testid="clear-instances-button"
                className="w-full text-left px-4 py-3 rounded-lg border border-subtle bg-surface hover:bg-surface-alt transition-colors cursor-pointer"
                onClick={() => confirmClear('instances')}
              >
                <div className="text-sm font-medium text-content">Clear Instances</div>
                <div className="text-xs text-content-muted mt-0.5">Delete all instances and connections. Custom schemas and deployables preserved.</div>
              </button>

              <button
                data-testid="clear-everything-button"
                className="w-full text-left px-4 py-3 rounded-lg border border-amber-500/50 bg-surface hover:bg-amber-500/10 transition-colors cursor-pointer"
                onClick={() => confirmClear('all')}
              >
                <div className="text-sm font-medium text-amber-600">Clear Everything</div>
                <div className="text-xs text-content-muted mt-0.5">Delete all instances, schemas, and deployables. This cannot be undone.</div>
              </button>

              <button
                data-testid="clear-and-restore-button"
                className="w-full text-left px-4 py-3 rounded-lg border border-red-500/50 bg-surface hover:bg-red-500/10 transition-colors cursor-pointer"
                onClick={() => {
                  confirmClear('all');
                  onRestoreDefaultSchemas?.();
                }}
              >
                <div className="text-sm font-medium text-red-600">Clear Everything and Restore Defaults</div>
                <div className="text-xs text-content-muted mt-0.5">Delete everything and restore built-in schemas. Fresh start with defaults.</div>
              </button>

              <button
                data-testid="clear-cancel-button"
                className="w-full text-left px-4 py-3 rounded-lg border border-subtle bg-surface hover:bg-surface-alt transition-colors cursor-pointer mt-2"
                onClick={() => setClearWarningMode(null)}
              >
                <div className="text-sm font-medium text-content-muted">Cancel</div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Restore Default Schemas Modal */}
      {restoreWarningMode && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]" onClick={() => setRestoreWarningMode(null)}>
          <div className="bg-surface rounded-xl w-[90%] max-w-[400px] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
              <div>
                <h2 className="m-0 text-lg text-content font-semibold">Restore default schemas</h2>
              </div>
              <button
                className="w-9 h-9 border-none rounded-md bg-transparent text-content-subtle text-2xl cursor-pointer flex items-center justify-center hover:bg-surface-alt hover:text-content"
                onClick={() => setRestoreWarningMode(null)}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-4">
              <p className="text-content text-sm mb-2">
                This will add any missing default schemas to your workspace.
              </p>
              <p className="text-content-muted text-xs">
                Existing schemas with matching types will be overwritten. This action cannot be undone.
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end px-4 py-3 border-t border-subtle">
              <button
                className="px-4 py-2 rounded-md bg-surface text-content text-sm font-medium cursor-pointer hover:bg-surface-alt transition-colors"
                onClick={() => setRestoreWarningMode(null)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 border-none rounded-md bg-emerald-500 text-white text-sm font-medium cursor-pointer hover:bg-emerald-600 transition-colors"
                onClick={() => {
                  onRestoreDefaultSchemas?.();
                  setRestoreWarningMode(null);
                  setIsSettingsMenuOpen(false);
                }}
              >
                Restore
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
