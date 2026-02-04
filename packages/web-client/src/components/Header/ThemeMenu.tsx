import { useState, useRef, useCallback } from 'react';
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
