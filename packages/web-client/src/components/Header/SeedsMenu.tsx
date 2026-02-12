import { useState, useRef, useCallback } from 'react';
import { ArrowsClockwise } from '@phosphor-icons/react';
import { useClickOutside } from './useClickOutside';
import { seeds } from '../../utils/seeds';

const seedDescriptions: Record<string, string> = {
  starter: 'Simple notes with an organizer',
  saas: 'SaaS architecture with API, database, and UI layers',
  'kitchen-sink': 'All features: custom schemas, all port types, organizers',
};

/**
 * Seeds dropdown menu for loading dev seed documents.
 * Each seed creates a fresh document with pre-populated content.
 */
export function SeedsMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setIsOpen(false), []);
  useClickOutside(menuRef, isOpen, closeMenu);

  const handleSeedClick = (seedName: string) => {
    setIsOpen(false);
    // Navigate to seed URL - main.tsx will create fresh document
    window.location.href = `/?seed=${seedName}`;
  };

  const seedNames = Object.keys(seeds);

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        title="Load seed document"
      >
        <ArrowsClockwise weight="regular" size={18} />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-surface border border-subtle rounded-lg shadow-lg overflow-hidden z-50 min-w-[280px]">
          <div className="px-3 py-2 text-xs font-medium text-content-muted border-b border-subtle">
            Load Seed Document
          </div>
          {seedNames.map((name) => (
            <button
              key={name}
              className="w-full text-left px-4 py-2 cursor-pointer text-content hover:bg-surface-alt transition-colors border-none bg-surface"
              onClick={() => handleSeedClick(name)}
            >
              <div className="text-sm font-medium">{name}</div>
              {seedDescriptions[name] && (
                <div className="text-xs text-content-muted mt-0.5">
                  {seedDescriptions[name]}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
