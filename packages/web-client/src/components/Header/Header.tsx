import { useState, useRef } from 'react';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { config } from '../../config/featureFlags';
import ConnectionStatus from '../ConnectionStatus';
import DocumentBrowserModal from '../modals/DocumentBrowserModal';
import ProjectInfoModal from '../modals/ProjectInfoModal';
import ClearWorkspaceModal from '../modals/ClearWorkspaceModal';
import RestoreDefaultSchemasModal from '../modals/RestoreDefaultSchemasModal';
import { cleanAllLocalData } from '../../stores/documentRegistry';
import { ThemeMenu } from './ThemeMenu';
import { SettingsMenu } from './SettingsMenu';
import { SeedsMenu } from './SeedsMenu';
import { ShareMenu } from './ShareMenu';

export interface HeaderProps {
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
}

/**
 * Check if the server is a local embedded server (desktop app).
 * Hide connection status for localhost since the user is always "connected" to themselves.
 */
function isLocalServer(): boolean {
  if (!config.syncUrl) return false;
  try {
    const url = new URL(config.syncUrl);
    return url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  } catch {
    return false;
  }
}

export function Header({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onExport,
  onImport,
  onCompile,
  onClear,
  onRestoreDefaultSchemas,
  onToggleAI,
}: HeaderProps) {
  const { mode, documentId } = useDocumentContext();
  const [isProjectInfoModalOpen, setIsProjectInfoModalOpen] = useState(false);
  const [isDocBrowserOpen, setIsDocBrowserOpen] = useState(false);
  const [isClearWorkspaceModalOpen, setIsClearWorkspaceModalOpen] = useState(false);
  const [isRestoreDefaultSchemasModalOpen, setIsRestoreDefaultSchemasModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleClearInstances = () => {
    onClear?.('instances');
  };

  const handleClearEverything = () => {
    onClear?.('all');
  };

  const handleClearAndRestore = () => {
    onClear?.('all');
    onRestoreDefaultSchemas?.();
  };

  const handleRestoreDefaultSchemas = () => {
    onRestoreDefaultSchemas?.();
  };

  return (
    <header className="h-12 bg-surface border-b grid grid-cols-[1fr_auto_1fr] items-center px-0 shrink-0">
      {/* Left section: Logo and debug info */}
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

      {/* Center section: Title */}
      <div className="flex items-center justify-center">
        <h1
          className="m-0 text-lg font-semibold text-content cursor-pointer px-2 py-1 rounded hover:bg-surface-alt transition-colors"
          onClick={() => setIsProjectInfoModalOpen(true)}
          title="Click to edit project info"
        >
          {title}
        </h1>
      </div>

      {/* Right section: Actions */}
      <div className="flex gap-2 items-center justify-end">
        <input
          ref={fileInputRef}
          type="file"
          accept=".carta"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Connection Status — only when collaboration is active and not a local server */}
        {config.hasSync && mode === 'shared' && !isLocalServer() && <ConnectionStatus />}

        {/* Share button and menu — only when connected to a remote server */}
        {config.hasSync && !isLocalServer() && (
          <ShareMenu documentId={documentId} mode={mode} />
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

        {config.debug && <SeedsMenu />}

        <ThemeMenu />

        <SettingsMenu
          onOpenClearModal={() => setIsClearWorkspaceModalOpen(true)}
          onOpenRestoreSchemasModal={() => setIsRestoreDefaultSchemasModalOpen(true)}
        />
      </div>

      {/* Modals */}
      <ClearWorkspaceModal
        isOpen={isClearWorkspaceModalOpen}
        onClose={() => setIsClearWorkspaceModalOpen(false)}
        onClearInstances={handleClearInstances}
        onClearEverything={handleClearEverything}
        onClearAndRestore={handleClearAndRestore}
      />

      <RestoreDefaultSchemasModal
        isOpen={isRestoreDefaultSchemasModalOpen}
        onClose={() => setIsRestoreDefaultSchemasModalOpen(false)}
        onConfirm={handleRestoreDefaultSchemas}
      />

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

      {isDocBrowserOpen && (
        <DocumentBrowserModal onClose={() => setIsDocBrowserOpen(false)} />
      )}
    </header>
  );
}
