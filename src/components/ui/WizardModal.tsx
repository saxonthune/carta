import React from 'react';
import Modal from './Modal';
import Button from './Button';

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
  const footer = (
    <div className="flex justify-between items-center">
      {/* Left: Back button */}
      <div>
        {canGoBack && onBack && (
          <Button variant="ghost" size="sm" onClick={onBack}>
            {backLabel || 'Back'}
          </Button>
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
        <Button variant="accent" size="sm" onClick={onNext} disabled={!canGoNext}>
          {nextLabel || (isLastStep ? 'Save' : 'Next')}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="560px"
      footer={footer}
    >
      {children}
    </Modal>
  );
}
