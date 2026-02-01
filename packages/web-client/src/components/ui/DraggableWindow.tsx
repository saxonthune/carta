import React, { useEffect, useRef, useState } from 'react';
import Button from './Button';
import { PinIcon, CloseIcon } from './icons';

interface DraggableWindowProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  maxWidth?: string;
  defaultPosition?: { x: number; y: number };
}

export default function DraggableWindow({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = '640px',
  defaultPosition,
}: DraggableWindowProps) {
  const [isPinned, setIsPinned] = useState(false);
  const [position, setPosition] = useState(defaultPosition || { x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const windowRef = useRef<HTMLDivElement>(null);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isPinned) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose, isPinned]);

  // Handle drag
  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Handle click outside
  useEffect(() => {
    if (!isOpen || isPinned) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (windowRef.current && !windowRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Small delay to prevent immediate close on open
    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, isPinned, onClose]);

  if (!isOpen) return null;

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!windowRef.current) return;

    const rect = windowRef.current.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    setIsDragging(true);
  };

  return (
    <div className="fixed inset-0 z-[1001] pointer-events-none">
      <div
        ref={windowRef}
        className="absolute bg-surface-depth-1 rounded-xl shadow-2xl flex flex-col pointer-events-auto"
        style={{
          left: position.x,
          top: position.y,
          maxWidth,
          width: maxWidth,
          maxHeight: 'calc(100vh - 100px)',
          cursor: isDragging ? 'grabbing' : 'auto',
        }}
      >
        {/* Header - Island (depth-2) with drag handle */}
        <div
          className="bg-surface-depth-2 px-5 py-4 rounded-t-xl flex justify-between items-center shrink-0 cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleMouseDown}
        >
          <div>
            {title && <h2 className="m-0 text-lg font-semibold text-content">{title}</h2>}
            {subtitle && <p className="m-0 text-xs text-content-muted mt-0.5">{subtitle}</p>}
          </div>
          <div className="flex gap-2 items-center">
            {/* Pin button */}
            <Button
              variant="icon"
              onClick={() => setIsPinned(!isPinned)}
              aria-label={isPinned ? 'Unpin window' : 'Pin window'}
              title={isPinned ? 'Unpin (click outside to close)' : 'Pin (keep open when clicking outside)'}
            >
              <PinIcon
                size={20}
                filled={isPinned}
                className={isPinned ? 'text-accent' : ''}
              />
            </Button>
            {/* Close button */}
            <Button variant="icon" onClick={onClose} aria-label="Close">
              <CloseIcon size={20} />
            </Button>
          </div>
        </div>

        {/* Content - Ground layer (depth-3) */}
        <div className="bg-surface-depth-3 flex-1 overflow-y-auto min-h-0 p-4 rounded-b-xl">
          {children}
        </div>
      </div>
    </div>
  );
}
