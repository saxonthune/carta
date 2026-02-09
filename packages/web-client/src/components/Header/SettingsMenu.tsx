import { useState, useRef, useCallback } from 'react';
import { useClickOutside } from './useClickOutside';
import { config } from '../../config/featureFlags';
import { builtInSeedCatalog, type SchemaSeed } from '@carta/domain';

export interface SettingsMenuProps {
  onOpenClearModal: () => void;
  onAddBuiltInSchemas: (seeds: SchemaSeed[]) => void;
  onLoadExample: (seedName: string) => void;
}

type MenuView = 'main' | 'schemas' | 'examples';

/**
 * Settings dropdown menu with app configuration options.
 */
export function SettingsMenu({
  onOpenClearModal,
  onAddBuiltInSchemas,
  onLoadExample,
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<MenuView>('main');
  const [selectedSeeds, setSelectedSeeds] = useState<Set<SchemaSeed>>(new Set());
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setCurrentView('main');
    setSelectedSeeds(new Set());
  }, []);

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

  const handleToggleSeed = (seed: SchemaSeed) => {
    setSelectedSeeds(prev => {
      const next = new Set(prev);
      if (next.has(seed)) {
        next.delete(seed);
      } else {
        next.add(seed);
      }
      return next;
    });
  };

  const handleAddSelectedSchemas = () => {
    if (selectedSeeds.size > 0) {
      onAddBuiltInSchemas(Array.from(selectedSeeds));
      closeMenu();
    }
  };

  const handleLoadExampleClick = (seedName: string) => {
    onLoadExample(seedName);
    closeMenu();
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
        <div data-testid="settings-menu" className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg overflow-hidden z-50 min-w-[240px]">
          {currentView === 'main' && (
            <>
              {config.isDesktop && (
                <button
                  className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
                  onClick={handleCopyMcpConfig}
                >
                  Copy MCP Config
                </button>
              )}
              <button
                className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface flex items-center justify-between"
                onClick={() => setCurrentView('schemas')}
              >
                <span>Add Built-in Schemas</span>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface flex items-center justify-between"
                onClick={() => setCurrentView('examples')}
              >
                <span>Load Example Page</span>
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
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
            </>
          )}

          {currentView === 'schemas' && (
            <>
              <button
                className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface flex items-center gap-2 border-b border-subtle"
                onClick={() => setCurrentView('main')}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>Back</span>
              </button>
              <div className="max-h-[300px] overflow-y-auto">
                {builtInSeedCatalog.map(({ name, seed, description }) => (
                  <label
                    key={name}
                    className="w-full flex items-start gap-2 px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSeeds.has(seed)}
                      onChange={() => handleToggleSeed(seed)}
                      className="mt-0.5 cursor-pointer"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{name}</div>
                      <div className="text-xs text-content-muted">{description}</div>
                    </div>
                  </label>
                ))}
              </div>
              <button
                className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface border-t border-subtle font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleAddSelectedSchemas}
                disabled={selectedSeeds.size === 0}
              >
                Add Selected ({selectedSeeds.size})
              </button>
            </>
          )}

          {currentView === 'examples' && (
            <>
              <button
                className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface flex items-center gap-2 border-b border-subtle"
                onClick={() => setCurrentView('main')}
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
                <span>Back</span>
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
                onClick={() => handleLoadExampleClick('starter')}
              >
                <div className="font-medium">Starter</div>
                <div className="text-xs text-content-muted">Basic example with notes and connections</div>
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
                onClick={() => handleLoadExampleClick('saas')}
              >
                <div className="font-medium">SaaS Architecture</div>
                <div className="text-xs text-content-muted">Multi-tier web application example</div>
              </button>
              <button
                className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
                onClick={() => handleLoadExampleClick('kitchen-sink')}
              >
                <div className="font-medium">Kitchen Sink</div>
                <div className="text-xs text-content-muted">Comprehensive feature showcase</div>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
