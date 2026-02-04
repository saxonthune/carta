import { useState, useRef, useCallback } from 'react';
import { useClickOutside } from './useClickOutside';
import { config } from '../../config/featureFlags';
import type { Example } from '../../utils/examples';

export interface SettingsMenuProps {
  examples: Example[];
  onLoadExample?: (example: Example) => void;
  onOpenExamplesModal: () => void;
  onOpenClearModal: () => void;
  onOpenRestoreSchemasModal: () => void;
}

/**
 * Settings dropdown menu with app configuration options.
 */
export function SettingsMenu({
  examples,
  onLoadExample,
  onOpenExamplesModal,
  onOpenClearModal,
  onOpenRestoreSchemasModal,
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setIsOpen(false), []);
  useClickOutside(menuRef, isOpen, closeMenu);

  const handleCopyMcpConfig = async () => {
    setIsOpen(false);
    try {
      const mcpConfig = await window.electronAPI!.getMcpConfig();
      await navigator.clipboard.writeText(mcpConfig);
    } catch (err) {
      console.error('Failed to copy MCP config:', err);
    }
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        data-testid="settings-menu-button"
        className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        title="Settings"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>
      {isOpen && (
        <div data-testid="settings-menu" className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg overflow-hidden z-50 min-w-[200px]">
          {examples.length > 0 && onLoadExample && (
            <button
              className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
              onClick={() => {
                onOpenExamplesModal();
                setIsOpen(false);
              }}
            >
              Load Example
            </button>
          )}
          {config.isDesktop && (
            <button
              className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
              onClick={handleCopyMcpConfig}
            >
              Copy MCP Config
            </button>
          )}
          <button
            className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
            onClick={() => {
              onOpenRestoreSchemasModal();
              setIsOpen(false);
            }}
          >
            Restore Default Schemas
          </button>
          <button
            data-testid="settings-clear-button"
            className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
            onClick={() => {
              onOpenClearModal();
              setIsOpen(false);
            }}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
