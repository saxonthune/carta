import Modal from './Modal';
import Button from './Button';

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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      maxWidth="384px"
      showCloseButton={false}
      footer={
        <div className="flex gap-2 justify-end">
          <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="danger" onClick={onDiscard}>{discardLabel}</Button>
          <Button variant="primary" onClick={onSave} disabled={saveDisabled}>{saveLabel}</Button>
        </div>
      }
    >
      <p className="text-content-muted text-sm m-0">{message}</p>
    </Modal>
  );
}
