import { useState, useRef, useCallback } from 'react';
import { Gear, CaretRight, CaretLeft } from '@phosphor-icons/react';
import { useClickOutside } from './useClickOutside';
import { config } from '../../config/featureFlags';

export interface SettingsMenuProps {
  onOpenClearModal: () => void;
  onLoadExample: (seedName: string) => void;
}

type MenuView = 'main' | 'examples';

/**
 * Settings dropdown menu with app configuration options.
 */
export function SettingsMenu({
  onOpenClearModal,
  onLoadExample,
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentView, setCurrentView] = useState<MenuView>('main');
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
    setCurrentView('main');
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
        <Gear weight="regular" size={18} />
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
                onClick={() => setCurrentView('examples')}
              >
                <span>Load Example Page</span>
                <CaretRight weight="bold" size={14} />
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

          {currentView === 'examples' && (
            <>
              <button
                className="w-full text-left px-4 py-2 text-sm cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface flex items-center gap-2 border-b border-subtle"
                onClick={() => setCurrentView('main')}
              >
                <CaretLeft weight="bold" size={14} />
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
