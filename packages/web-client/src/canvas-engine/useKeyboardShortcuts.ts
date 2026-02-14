import { useEffect, useRef } from 'react';

export interface KeyboardShortcut {
  /** The `event.key` value to match (e.g., 'z', 'Delete', 'Backspace', 'F2') */
  key: string | string[];
  /** Modifier requirements. Omitted = must NOT be pressed. */
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  /** Called when the shortcut fires. Return value is ignored. */
  action: () => void;
  /** If true, only fires when the platform modifier is pressed (Ctrl on Win/Linux, Meta on Mac).
   *  Overrides `ctrl` and `meta` — don't set both. */
  mod?: boolean;
}

export interface UseKeyboardShortcutsOptions {
  /** Shortcut definitions. Evaluated in order — first match wins. */
  shortcuts: KeyboardShortcut[];
  /** If true, all shortcuts are disabled (e.g., during modal open). Default false. */
  disabled?: boolean;
}

export function useKeyboardShortcuts({ shortcuts, disabled = false }: UseKeyboardShortcutsOptions): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (disabledRef.current) return;

      // Skip if user is typing in an input/textarea/contenteditable
      const target = event.target as HTMLElement;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable
      ) {
        return;
      }

      for (const shortcut of shortcutsRef.current) {
        const keys = Array.isArray(shortcut.key) ? shortcut.key : [shortcut.key];
        if (!keys.includes(event.key)) continue;

        // Modifier matching
        const isMac = navigator.platform.includes('Mac') || navigator.userAgent.includes('Mac');

        if (shortcut.mod !== undefined) {
          // mod = true means "Ctrl on Win/Linux, Meta on Mac"
          const modPressed = isMac ? event.metaKey : event.ctrlKey;
          if (shortcut.mod !== modPressed) continue;
        } else {
          if (shortcut.ctrl !== undefined && shortcut.ctrl !== event.ctrlKey) continue;
          if (shortcut.meta !== undefined && shortcut.meta !== event.metaKey) continue;
        }

        if (shortcut.shift !== undefined && shortcut.shift !== event.shiftKey) continue;
        if (shortcut.alt !== undefined && shortcut.alt !== event.altKey) continue;

        // If no modifier flags specified (and no `mod`), require NO modifiers
        const hasModifierSpec = shortcut.mod !== undefined ||
          shortcut.ctrl !== undefined || shortcut.meta !== undefined ||
          shortcut.shift !== undefined || shortcut.alt !== undefined;
        if (!hasModifierSpec) {
          if (event.ctrlKey || event.metaKey || event.altKey) continue;
        }

        event.preventDefault();
        shortcut.action();
        return; // first match wins
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // Empty deps — reads from refs
}
