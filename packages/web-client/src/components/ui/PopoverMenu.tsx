import { useState, useRef, useEffect } from 'react';

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
  const containerRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleItemClick = (item: PopoverMenuItem) => {
    item.onClick();
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      <div onClick={() => setIsOpen(!isOpen)}>
        {trigger}
      </div>
      {isOpen && (
        <div
          className={`absolute top-full mt-1 bg-surface border border-border rounded-lg shadow-lg overflow-hidden z-50 min-w-[140px] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {items.map((item) => (
            <button
              key={item.key}
              className={`w-full text-left px-3 py-1.5 text-sm hover:bg-surface-alt transition-colors border-none bg-transparent cursor-pointer ${
                item.danger ? 'text-red-500' : 'text-content'
              }`}
              onClick={() => handleItemClick(item)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
