import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, CaretRight } from '@phosphor-icons/react';

export interface MenuItem {
  key: string;
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  dividerAfter?: boolean;
  children?: MenuItem[];
  color?: string;
  active?: boolean;
  renderContent?: React.ReactNode;
}

interface ContextMenuPrimitiveProps {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}

const SUBMENU_CLOSE_DELAY = 100;

export function MenuLevel({ items, onClose, depth = 0 }: { items: MenuItem[]; onClose: () => void; depth?: number }) {
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleMouseEnter = useCallback((key: string, hasChildren: boolean) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (hasChildren) {
      setExpandedKey(key);
    } else {
      setExpandedKey(null);
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = window.setTimeout(() => {
      setExpandedKey(null);
    }, SUBMENU_CLOSE_DELAY);
  }, []);

  return (
    <div className="bg-surface rounded-lg shadow-lg min-w-[150px] py-0.5">
      {items.map((item) => {
        const hasChildren = item.children && item.children.length > 0;

        if (item.renderContent) {
          return (
            <div key={item.key}>
              <div className="px-2 py-1.5">
                {item.renderContent}
              </div>
              {item.dividerAfter && <div className="border-t border-border my-0.5" />}
            </div>
          );
        }

        return (
          <div key={item.key}>
            <div
              className="relative"
              onMouseEnter={() => handleMouseEnter(item.key, !!hasChildren)}
              onMouseLeave={handleMouseLeave}
            >
              <button
                className={`block w-full px-4 py-2.5 border-none bg-transparent text-sm text-left cursor-pointer hover:bg-surface-depth-1 transition-colors flex items-center justify-between
                  ${item.danger ? 'text-danger' : 'text-content'}
                  ${item.disabled ? 'opacity-40 pointer-events-none' : ''}`}
                style={item.color ? { borderLeft: `3px solid ${item.color}` } : undefined}
                onClick={() => {
                  if (!hasChildren && item.onClick) {
                    item.onClick();
                    onClose();
                  }
                }}
                disabled={item.disabled}
              >
                <span className="flex items-center gap-1.5">
                  {item.active && (
                    <Check weight="bold" size={14} className="flex-shrink-0" />
                  )}
                  {item.label}
                </span>
                {hasChildren && (
                  <CaretRight weight="bold" size={14} className="ml-2 flex-shrink-0" />
                )}
              </button>
              {hasChildren && expandedKey === item.key && (
                <div className={`absolute top-0 ${depth < 2 ? 'left-full' : 'right-full'}`}>
                  <MenuLevel items={item.children!} onClose={onClose} depth={depth + 1} />
                </div>
              )}
            </div>
            {item.dividerAfter && <div className="border-t border-border my-0.5" />}
          </div>
        );
      })}
    </div>
  );
}

export default function ContextMenuPrimitive({ x, y, items, onClose }: ContextMenuPrimitiveProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Dismiss on click-outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Dismiss on Escape
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Viewport edge adjustment
  const adjustedPosition = { left: x, top: y };
  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect();
    if (rect.right > window.innerWidth) {
      adjustedPosition.left = window.innerWidth - rect.width - 8;
    }
    if (rect.bottom > window.innerHeight) {
      adjustedPosition.top = window.innerHeight - rect.height - 8;
    }
  }

  return (
    <div
      ref={menuRef}
      className="fixed z-[1000]"
      style={adjustedPosition}
    >
      <MenuLevel items={items} onClose={onClose} />
    </div>
  );
}
