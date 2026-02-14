import { useState, useRef, useCallback } from 'react';
import { Sun, Moon, SunHorizon } from '@phosphor-icons/react';
import { useClickOutside } from './useClickOutside';

export type Theme = 'light' | 'dark' | 'warm';

const getInitialTheme = (): Theme => {
  const savedTheme = localStorage.getItem('theme') as Theme | null;
  if (savedTheme) return savedTheme;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'dark' : 'light';
};

function getThemeIcon(themeName: Theme) {
  switch (themeName) {
    case 'light':
      return <Sun weight="regular" size={18} />;
    case 'dark':
      return <Moon weight="regular" size={18} />;
    case 'warm':
      return <SunHorizon weight="regular" size={18} />;
  }
}

function getThemeLabel(themeName: Theme) {
  switch (themeName) {
    case 'light': return 'Light';
    case 'dark': return 'Dark';
    case 'warm': return 'Warm';
  }
}

/**
 * Theme selection dropdown menu.
 */
export function ThemeMenu() {
  const [theme, setTheme] = useState<Theme>(() => {
    const initialTheme = getInitialTheme();
    document.documentElement.setAttribute('data-theme', initialTheme);
    return initialTheme;
  });
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const closeMenu = useCallback(() => setIsOpen(false), []);
  useClickOutside(menuRef, isOpen, closeMenu);

  const changeTheme = (newTheme: Theme) => {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        className="w-9 h-9 flex items-center justify-center rounded-lg cursor-pointer text-content-muted hover:bg-surface-alt hover:text-content transition-colors"
        onClick={() => setIsOpen(!isOpen)}
        title="Change theme"
      >
        {getThemeIcon(theme)}
      </button>
      {isOpen && (
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
  );
}
