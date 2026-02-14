import { useState, useCallback } from 'react';

interface UseDirtyStateGuardOptions<T> {
  onSave: () => void;
  onSwitch: (pending: T) => void;
}

interface UseDirtyStateGuardReturn<T> {
  isDirty: boolean;
  setIsDirty: (dirty: boolean) => void;
  showConfirmModal: boolean;
  pendingSelection: T | null;
  guardedSelect: (selection: T) => void;
  confirmSave: () => void;
  confirmDiscard: () => void;
  confirmCancel: () => void;
}

export function useDirtyStateGuard<T>(
  options: UseDirtyStateGuardOptions<T>
): UseDirtyStateGuardReturn<T> {
  const { onSave, onSwitch } = options;

  const [isDirty, setIsDirty] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingSelection, setPendingSelection] = useState<T | null>(null);

  const guardedSelect = useCallback((selection: T) => {
    if (isDirty) {
      setPendingSelection(selection);
      setShowConfirmModal(true);
      return;
    }
    onSwitch(selection);
  }, [isDirty, onSwitch]);

  const confirmSave = useCallback(() => {
    onSave();
    setShowConfirmModal(false);
    // After save, proceed to pending selection
    setTimeout(() => {
      if (pendingSelection !== null) {
        onSwitch(pendingSelection);
      }
      setPendingSelection(null);
    }, 0);
  }, [onSave, onSwitch, pendingSelection]);

  const confirmDiscard = useCallback(() => {
    setIsDirty(false);
    setShowConfirmModal(false);
    if (pendingSelection !== null) {
      onSwitch(pendingSelection);
    }
    setPendingSelection(null);
  }, [onSwitch, pendingSelection]);

  const confirmCancel = useCallback(() => {
    setShowConfirmModal(false);
    setPendingSelection(null);
  }, []);

  return {
    isDirty,
    setIsDirty,
    showConfirmModal,
    pendingSelection,
    guardedSelect,
    confirmSave,
    confirmDiscard,
    confirmCancel,
  };
}
