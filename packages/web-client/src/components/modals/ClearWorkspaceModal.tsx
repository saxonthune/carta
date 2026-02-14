import Modal from '../ui/Modal';

interface ClearWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearInstances: () => void;
  onClearEverything: () => void;
}

export default function ClearWorkspaceModal({
  isOpen,
  onClose,
  onClearInstances,
  onClearEverything,
}: ClearWorkspaceModalProps) {
  const handleClearInstances = () => {
    onClearInstances();
    onClose();
  };

  const handleClearEverything = () => {
    onClearEverything();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Clear workspace"
      maxWidth="400px"
    >
      <div className="flex flex-col gap-2">
        <button
          data-testid="clear-instances-button"
          className="w-full text-left px-4 py-3 rounded-lg border border-subtle bg-surface hover:bg-surface-alt transition-colors cursor-pointer"
          onClick={handleClearInstances}
        >
          <div className="text-sm font-medium text-content">Clear Instances</div>
          <div className="text-xs text-content-muted mt-0.5">Delete all instances and connections. Custom schemas and deployables preserved.</div>
        </button>

        <button
          data-testid="clear-everything-button"
          className="w-full text-left px-4 py-3 rounded-lg border border-amber-500/50 bg-surface hover:bg-amber-500/10 transition-colors cursor-pointer"
          onClick={handleClearEverything}
        >
          <div className="text-sm font-medium text-amber-600">Clear Everything</div>
          <div className="text-xs text-content-muted mt-0.5">Delete all instances, schemas, and deployables. This cannot be undone.</div>
        </button>

        <button
          data-testid="clear-cancel-button"
          className="w-full text-left px-4 py-3 rounded-lg border border-subtle bg-surface hover:bg-surface-alt transition-colors cursor-pointer mt-2"
          onClick={onClose}
        >
          <div className="text-sm font-medium text-content-muted">Cancel</div>
        </button>
      </div>
    </Modal>
  );
}
