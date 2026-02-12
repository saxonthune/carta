import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { SchemaGroup } from '@carta/domain';

interface DeleteEmptyGroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  emptyGroups: SchemaGroup[];
  onDelete: () => void;
}

export default function DeleteEmptyGroupsModal({
  isOpen,
  onClose,
  emptyGroups,
  onDelete,
}: DeleteEmptyGroupsModalProps) {
  const handleDelete = () => {
    onDelete();
    onClose();
  };

  const isEmpty = emptyGroups.length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Empty Groups"
      maxWidth="400px"
    >
      <div className="flex flex-col gap-3">
        {isEmpty ? (
          <p className="text-sm text-content-muted">All groups contain schemas.</p>
        ) : (
          <>
            <p className="text-sm text-content-muted mb-2">
              The following groups are empty and will be deleted:
            </p>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {emptyGroups.map((group) => (
                <div
                  key={group.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded text-sm text-content"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: group.color || '#888' }}
                  />
                  <span>{group.name}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <div className="flex justify-end gap-2 mt-2">
          <Button variant="secondary" onClick={onClose}>
            {isEmpty ? 'Close' : 'Cancel'}
          </Button>
          {!isEmpty && (
            <Button variant="danger" onClick={handleDelete}>
              Delete {emptyGroups.length} group{emptyGroups.length !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
