import Modal from '../ui/Modal';

interface ExampleConfirmModalProps {
  isOpen: boolean;
  exampleTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ExampleConfirmModal({ isOpen, exampleTitle, onConfirm, onCancel }: ExampleConfirmModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} title="Load example" maxWidth="400px">
      <p className="text-sm text-content-muted mb-4">
        Loading "{exampleTitle}" will replace your current document. This cannot be undone.
      </p>
      <div className="flex flex-col gap-2">
        <button
          className="w-full text-left px-4 py-3 rounded-lg border border-subtle bg-surface hover:bg-surface-alt transition-colors cursor-pointer"
          onClick={onConfirm}
        >
          <div className="text-sm font-medium text-content">Load Example</div>
        </button>
        <button
          className="w-full text-left px-4 py-3 rounded-lg border border-subtle bg-surface hover:bg-surface-alt transition-colors cursor-pointer"
          onClick={onCancel}
        >
          <div className="text-sm font-medium text-content-muted">Cancel</div>
        </button>
      </div>
    </Modal>
  );
}
