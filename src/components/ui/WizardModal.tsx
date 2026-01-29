import React, { useEffect } from 'react';

interface WizardModalProps {
  isOpen: boolean;
  title: string;
  currentStep: number;
  totalSteps: number;
  stepLabels?: string[];
  onClose: () => void;
  onBack?: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastStep: boolean;
  nextLabel?: string;
  backLabel?: string;
  hideStepIndicator?: boolean;
  children: React.ReactNode;
}

export default function WizardModal({
  isOpen,
  title,
  currentStep,
  totalSteps,
  stepLabels,
  onClose,
  onBack,
  onNext,
  canGoBack,
  canGoNext,
  isLastStep,
  nextLabel,
  backLabel,
  hideStepIndicator = false,
  children,
}: WizardModalProps) {
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
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[1001] flex items-center justify-center"
      onClick={handleBackdropClick}
    >
      <div className="bg-surface-elevated rounded-xl shadow-xl max-w-[560px] w-full max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border flex justify-between items-center">
          <h2 className="text-lg font-semibold text-content">{title}</h2>
          <button
            onClick={onClose}
            className="text-content-muted hover:text-content transition-colors"
            aria-label="Close"
          >
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
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-5 py-4">
          {children}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex justify-between items-center">
          {/* Left: Back button */}
          <div>
            {canGoBack && onBack && (
              <button
                onClick={onBack}
                className="px-3 py-1.5 text-sm font-medium text-content-muted hover:text-content hover:bg-surface transition-colors rounded"
              >
                {backLabel || 'Back'}
              </button>
            )}
          </div>

          {/* Center: Step dots */}
          {!hideStepIndicator && (
            <div className="flex items-center gap-2">
              {Array.from({ length: totalSteps }, (_, i) => {
                const isCurrent = i === currentStep;
                const stepLabel = stepLabels?.[i];

                return (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full transition-colors ${
                      isCurrent
                        ? 'bg-accent'
                        : 'border border-border bg-transparent'
                    }`}
                    title={stepLabel}
                    aria-label={stepLabel || `Step ${i + 1}`}
                  />
                );
              })}
            </div>
          )}

          {/* Right: Next/Save button */}
          <div>
            <button
              onClick={onNext}
              disabled={!canGoNext}
              className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {nextLabel || (isLastStep ? 'Save' : 'Next')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
