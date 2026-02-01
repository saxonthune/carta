import Modal from '../ui/Modal';
import Button from '../ui/Button';

interface RestoreDefaultSchemasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function RestoreDefaultSchemasModal({
  isOpen,
  onClose,
  onConfirm,
}: RestoreDefaultSchemasModalProps) {
  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Restore default schemas"
      maxWidth="400px"
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleConfirm}>
            Restore
          </Button>
        </div>
      }
    >
      <p className="text-content text-sm mb-2">
        This will add any missing default schemas to your workspace.
      </p>
      <p className="text-content-muted text-xs">
        Existing schemas with matching types will be overwritten. This action cannot be undone.
      </p>
    </Modal>
  );
}
