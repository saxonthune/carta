interface ConfirmationModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onCancel: () => void;
  onDiscard: () => void;
  onSave: () => void;
  saveDisabled?: boolean;
  cancelLabel?: string;
  discardLabel?: string;
  saveLabel?: string;
}

export default function ConfirmationModal({
  isOpen,
  title = 'Unsaved Changes',
  message,
  onCancel,
  onDiscard,
  onSave,
  saveDisabled = false,
  cancelLabel = 'Cancel',
  discardLabel = 'Discard',
  saveLabel = 'Save Changes',
}: ConfirmationModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-surface-elevated rounded-lg shadow-lg max-w-sm mx-4">
        <div className="p-6">
          <h3 className="text-lg font-semibold text-content mb-2">{title}</h3>
          <p className="text-content-muted text-sm mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              className="px-4 py-2 rounded-md text-content bg-surface-depth-3 hover:bg-surface-depth-2 transition-colors text-sm font-medium cursor-pointer"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
            <button
              className="px-4 py-2 rounded-md text-white bg-danger hover:bg-danger/80 transition-colors text-sm font-medium cursor-pointer"
              onClick={onDiscard}
            >
              {discardLabel}
            </button>
            <button
              className="px-4 py-2 rounded-md text-white bg-accent hover:bg-accent-hover transition-colors text-sm font-medium cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={onSave}
              disabled={saveDisabled}
            >
              {saveLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
