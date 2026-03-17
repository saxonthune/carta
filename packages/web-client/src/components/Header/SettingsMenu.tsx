import { useState, useRef, useCallback } from 'react';
import { Gear } from '@phosphor-icons/react';
import { useClickOutside } from './useClickOutside';

export interface SettingsMenuProps {
  onOpenClearModal: () => void;
}

/**
 * Settings dropdown menu with app configuration options.
 */
export function SettingsMenu({
  onOpenClearModal,
}: SettingsMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => {
    setIsOpen(false);
  }, []);

  useClickOutside(menuRef, isOpen, closeMenu);

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
