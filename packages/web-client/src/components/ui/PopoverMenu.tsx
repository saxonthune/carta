import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface PopoverMenuItem {
  key: string;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export interface PopoverMenuProps {
  items: PopoverMenuItem[];
  trigger: React.ReactNode;
  align?: 'left' | 'right';
}

export default function PopoverMenu({ items, trigger, align = 'right' }: PopoverMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: align === 'right' ? rect.right : rect.left,
    });
  }, [align]);

  // Position on open and reposition on scroll/resize
  useEffect(() => {
    if (!isOpen) return;
    updatePosition();

    const scrollParent = triggerRef.current?.closest('[class*="overflow"]');
    scrollParent?.addEventListener('scroll', updatePosition);
    window.addEventListener('resize', updatePosition);
    return () => {
      scrollParent?.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isOpen, updatePosition]);

  // Close on click outside
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        menuRef.current?.contains(target)
      ) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && createPortal(
        <div
          ref={menuRef}
          className="fixed bg-surface border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-[140px]"
          style={{
            top: position.top,
            ...(align === 'right'
              ? { right: window.innerWidth - position.left }
              : { left: position.left }),
          }}
        >
          {items.map((item) => (
            <button
              key={item.key}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-surface-alt transition-colors border-none bg-transparent cursor-pointer ${
                item.danger ? 'text-red-500' : 'text-content'
              }`}
              onClick={() => { item.onClick(); setIsOpen(false); }}
            >
              {item.label}
            </button>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
}
