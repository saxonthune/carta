import { useState, useRef, useCallback } from 'react';
import { FolderOpen, Robot, Books } from '@phosphor-icons/react';
import { useDocumentContext } from '../../contexts/DocumentContext';
import { config } from '../../config/featureFlags';
import ConnectionStatus from '../ConnectionStatus';
import DocumentBrowserModal from '../modals/DocumentBrowserModal';
import PackagePickerModal from '../modals/PackagePickerModal';
import ClearWorkspaceModal from '../modals/ClearWorkspaceModal';
import { cleanAllLocalData } from '../../stores/documentRegistry';
import { ThemeMenu } from './ThemeMenu';
import { SettingsMenu } from './SettingsMenu';
import { ShareMenu } from './ShareMenu';
import { useClickOutside } from './useClickOutside';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';
import { Tooltip } from '../ui';
import { guideContent } from '../../data/guideContent';

export interface HeaderProps {
  title: string;
  description: string;
  onTitleChange: (title: string) => void;
  onDescriptionChange: (description: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onCompile: () => void;
  onClear?: (mode: 'instances' | 'all') => void;
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
  onToggleAI,
}: HeaderProps) {
  const { mode, documentId, adapter } = useDocumentContext();
  const [isProjectInfoOpen, setIsProjectInfoOpen] = useState(false);
  const [isDocBrowserOpen, setIsDocBrowserOpen] = useState(false);
  const [isLibraryOpen, setIsLibraryOpen] = useState(false);
  const [isClearWorkspaceModalOpen, setIsClearWorkspaceModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const projectInfoRef = useRef<HTMLDivElement>(null);

  const closeProjectInfo = useCallback(() => setIsProjectInfoOpen(false), []);
  useClickOutside(projectInfoRef, isProjectInfoOpen, closeProjectInfo);

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


  return (
    <header className="h-12 bg-surface border-b border-border grid grid-cols-[1fr_auto_1fr] items-center px-0 shrink-0">
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
              <Tooltip content="Clear all local data and reload as new user">
                <button
                  className="px-1.5 py-0.5 rounded bg-red-500/20 text-red-600 dark:text-red-400 hover:bg-red-500/30 transition-colors cursor-pointer border-none"
                  onClick={async () => {
                    await cleanAllLocalData();
                    window.location.href = window.location.pathname;
                  }}
                >
                  Clean
                </button>
              </Tooltip>
            )}
          </div>
        )}
      </div>

      {/* Center section: Title */}
      <div className="relative" ref={projectInfoRef}>
        <div className="flex items-center justify-center">
          <Tooltip content="Click to edit project info" guideContent={guideContent['header.title']}>
            <h1
              className="m-0 text-lg font-semibold text-content cursor-pointer px-2 py-1 rounded hover:bg-surface-alt transition-colors"
              onClick={() => setIsProjectInfoOpen(!isProjectInfoOpen)}
            >
              {title}
            </h1>
          </Tooltip>
        </div>
        {isProjectInfoOpen && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 bg-surface-elevated border border-subtle rounded-lg shadow-lg z-50 w-[360px] p-4 flex flex-col gap-3">
            <div>
              <label className="block text-xs text-content-muted mb-1">Project Title</label>
              <Input
                value={title}
                onChange={(e) => onTitleChange(e.target.value)}
                placeholder="Untitled Project"
                autoFocus
                size="sm"
              />
            </div>
            <div>
              <label className="block text-xs text-content-muted mb-1">Description</label>
              <Textarea
                value={description}
                onChange={(e) => onDescriptionChange(e.target.value)}
                placeholder="A brief description of this project..."
                rows={3}
                size="sm"
              />
            </div>
          </div>
        )}
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

        {/* Schema library button */}
        <Tooltip content="Schema Packages">
          <button
            className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
            onClick={() => setIsLibraryOpen(true)}
          >
            <Books weight="regular" size={18} />
          </button>
        </Tooltip>

        {/* Document browser button */}
        <Tooltip content="Browse documents" guideContent={guideContent['header.browse']}>
          <button
            className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
            onClick={() => setIsDocBrowserOpen(true)}
          >
            <FolderOpen weight="regular" size={18} />
          </button>
        </Tooltip>

        <Tooltip content="Export project to .carta file" guideContent={guideContent['header.export']}>
          <button
            className="px-4 py-2 text-sm font-medium bg-surface text-content border border-border rounded-lg cursor-pointer hover:bg-surface-alt transition-colors"
            onClick={onExport}
          >
            Export
          </button>
        </Tooltip>

        <Tooltip content="Import project from .carta file" guideContent={guideContent['header.import']}>
          <button
            className="px-4 py-2 text-sm font-medium bg-surface text-content border border-border rounded-lg cursor-pointer hover:bg-surface-alt transition-colors"
            onClick={handleImportClick}
          >
            Import
          </button>
        </Tooltip>

        <Tooltip content="Compile project" guideContent={guideContent['header.compile']}>
          <button
            className="px-4 py-2 text-sm font-medium bg-emerald-500 text-white border-none rounded-lg cursor-pointer hover:bg-emerald-600 transition-colors"
            onClick={onCompile}
          >
            Compile
          </button>
        </Tooltip>

        {onToggleAI && (
          <Tooltip content="Open AI Assistant" guideContent={guideContent['header.ai']}>
            <button
              className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
              onClick={onToggleAI}
            >
              <Robot weight="regular" size={18} />
            </button>
          </Tooltip>
        )}

        <ThemeMenu />

        <SettingsMenu
          onOpenClearModal={() => setIsClearWorkspaceModalOpen(true)}
        />
      </div>

      {/* Modals */}
      <ClearWorkspaceModal
        isOpen={isClearWorkspaceModalOpen}
        onClose={() => setIsClearWorkspaceModalOpen(false)}
        onClearInstances={handleClearInstances}
        onClearEverything={handleClearEverything}
      />

      {isDocBrowserOpen && (
        <DocumentBrowserModal onClose={() => setIsDocBrowserOpen(false)} />
      )}

      {isLibraryOpen && (
        <PackagePickerModal onClose={() => setIsLibraryOpen(false)} />
      )}
    </header>
  );
}
