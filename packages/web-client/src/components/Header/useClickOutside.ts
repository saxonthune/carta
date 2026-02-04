import { useEffect, type RefObject } from 'react';

/**
 * Hook that calls a callback when clicking outside the referenced element.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  isActive: boolean,
  onClickOutside: () => void
) {
  useEffect(() => {
    if (!isActive) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [ref, isActive, onClickOutside]);
}
