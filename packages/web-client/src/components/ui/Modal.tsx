import React, { useEffect } from 'react';
import Button from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: string;
  showCloseButton?: boolean;
  /** When true, backdrop click does not close the modal */
  preventBackdropClose?: boolean;
  /** When true, backdrop blurs the content behind it */
  blurBackdrop?: boolean;
}

export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = '560px',
  showCloseButton = true,
  preventBackdropClose = false,
  blurBackdrop = false,
}: ModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (!preventBackdropClose && e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className={`fixed inset-0 bg-black/50 z-[1001] flex items-center justify-center${blurBackdrop ? ' backdrop-blur-sm' : ''}`}
      onClick={handleBackdropClick}
    >
      <div
        className="bg-surface-elevated rounded-xl shadow-xl w-full max-h-[80vh] flex flex-col"
        style={{ maxWidth }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="px-5 py-4 border-b border-border flex justify-between items-center shrink-0">
            <div>
              {title && <h2 className="m-0 text-lg font-semibold text-content">{title}</h2>}
              {subtitle && <p className="m-0 text-xs text-content-muted mt-0.5">{subtitle}</p>}
            </div>
            {showCloseButton && (
              <Button variant="icon" onClick={onClose} aria-label="Close">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M15 5L5 15M5 5L15 15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-5 py-3 border-t border-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
