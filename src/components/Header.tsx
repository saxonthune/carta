import { useState, useRef, useEffect } from 'react';

interface HeaderProps {
  title: string;
  onTitleChange: (title: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onCompile: () => void;
  onClear?: (mode: 'instances' | 'all') => void;
  onRestoreDefaultSchemas?: () => void;
}

const getInitialTheme = (): 'light' | 'dark' | 'warm' => {
  const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | 'warm' | null;
  if (savedTheme) return savedTheme;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

export default function Header({ title, onTitleChange, onExport, onImport, onCompile, onClear, onRestoreDefaultSchemas }: HeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(title);
  const [theme, setTheme] = useState<'light' | 'dark' | 'warm'>(() => {
    const initialTheme = getInitialTheme();
    document.documentElement.setAttribute('data-theme', initialTheme);
    return initialTheme;
  });
  const [isThemeMenuOpen, setIsThemeMenuOpen] = useState(false);
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const [clearWarningMode, setClearWarningMode] = useState<'menu' | null>(null);
  const [restoreWarningMode, setRestoreWarningMode] = useState<'menu' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const themeMenuRef = useRef<HTMLDivElement>(null);
  const settingsMenuRef = useRef<HTMLDivElement>(null);

  // Close theme menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(event.target as Node)) {
        setIsThemeMenuOpen(false);
      }
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };

    if (isThemeMenuOpen || isSettingsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isThemeMenuOpen, isSettingsMenuOpen]);

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
    <header className="h-12 bg-surface border-b flex items-center justify-between px-0 shrink-0">
      <div className="flex items-center">
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

      <div className="flex gap-2 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".carta"
          onChange={handleFileSelect}
          className="hidden"
        />
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
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors text-left border-none ${
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
          className="px-4 py-2 text-sm font-medium bg-content-muted text-white border-none rounded-lg cursor-pointer shadow-sm hover:bg-content hover:-translate-y-0.5 transition-all"
          onClick={onExport}
          title="Export project to .carta file"
        >
          Export
        </button>
        <button
          className="px-4 py-2 text-sm font-medium bg-content-muted text-white border-none rounded-lg cursor-pointer shadow-sm hover:bg-content hover:-translate-y-0.5 transition-all"
          onClick={handleImportClick}
          title="Import project from .carta file"
        >
          Import
        </button>
        <button
          className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white border-none rounded-lg cursor-pointer shadow-sm hover:bg-emerald-600 hover:-translate-y-0.5 transition-all"
          onClick={onCompile}
          title="Compile project"
        >
          Compile
        </button>
        <div className="relative" ref={settingsMenuRef}>
          <button
            className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
            onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
            title="Settings"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m5.08 5.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m5.08-5.08l4.24-4.24" />
            </svg>
          </button>
          {isSettingsMenuOpen && (
            <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg overflow-hidden z-50 min-w-[200px]">
              <button
                className="w-full text-left px-4 py-2.5 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
                onClick={() => setRestoreWarningMode('menu')}
              >
                Restore Default Schemas
              </button>
              <button
                className="w-full text-left px-4 py-2.5 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]" onClick={() => setClearWarningMode(null)}>
          <div className="bg-surface rounded-xl w-[90%] max-w-[400px] flex flex-col shadow-2xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
              <div>
                <h2 className="m-0 text-lg text-content font-semibold">Clear workspace</h2>
              </div>
              <button
                className="w-8 h-8 border-none rounded-md bg-transparent text-content-subtle text-2xl cursor-pointer flex items-center justify-center hover:bg-surface-alt hover:text-content"
                onClick={() => setClearWarningMode(null)}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              <p className="text-content text-sm mb-4">
                Choose what to clear:
              </p>
              <ul className="text-content-muted text-xs space-y-2 ml-4">
                <li className="list-disc"><strong>Clear Instances:</strong> Delete all instances and connections. Custom schemas and deployables preserved.</li>
                <li className="list-disc"><strong>Clear Everything:</strong> Delete all instances, schemas, and deployables. This cannot be undone.</li>
              </ul>
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end px-5 py-4 border-t border-subtle">
              <button
                className="px-5 py-2.5 rounded-md bg-surface text-content text-sm font-medium cursor-pointer hover:bg-surface-alt transition-colors"
                onClick={() => setClearWarningMode(null)}
              >
                Cancel
              </button>
              <button
                className="px-5 py-2.5 border-none rounded-md bg-amber-500 text-white text-sm font-medium cursor-pointer hover:bg-amber-600 transition-colors"
                onClick={() => confirmClear('instances')}
              >
                Clear Instances
              </button>
              <button
                className="px-5 py-2.5 border-none rounded-md bg-red-500 text-white text-sm font-medium cursor-pointer hover:bg-red-600 transition-colors"
                onClick={() => confirmClear('all')}
              >
                Clear Everything
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
            <div className="flex items-center justify-between px-5 py-4 border-b border-subtle">
              <div>
                <h2 className="m-0 text-lg text-content font-semibold">Restore default schemas</h2>
              </div>
              <button
                className="w-8 h-8 border-none rounded-md bg-transparent text-content-subtle text-2xl cursor-pointer flex items-center justify-center hover:bg-surface-alt hover:text-content"
                onClick={() => setRestoreWarningMode(null)}
              >
                ×
              </button>
            </div>

            {/* Content */}
            <div className="p-5">
              <p className="text-content text-sm mb-2">
                This will add any missing default schemas to your workspace.
              </p>
              <p className="text-content-muted text-xs">
                Existing schemas with matching types will be overwritten. This action cannot be undone.
              </p>
            </div>

            {/* Footer */}
            <div className="flex gap-2 justify-end px-5 py-4 border-t border-subtle">
              <button
                className="px-5 py-2.5 rounded-md bg-surface text-content text-sm font-medium cursor-pointer hover:bg-surface-alt transition-colors"
                onClick={() => setRestoreWarningMode(null)}
              >
                Cancel
              </button>
              <button
                className="px-5 py-2.5 border-none rounded-md bg-indigo-500 text-white text-sm font-medium cursor-pointer hover:bg-indigo-600 transition-colors"
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
