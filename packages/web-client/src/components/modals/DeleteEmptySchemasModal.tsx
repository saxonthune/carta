import Modal from '../ui/Modal';
import Button from '../ui/Button';
import type { ConstructSchema } from '@carta/schema';

interface DeleteEmptySchemasModalProps {
  isOpen: boolean;
  onClose: () => void;
  emptySchemas: ConstructSchema[];
  onDelete: () => void;
}

export default function DeleteEmptySchemasModal({
  isOpen,
  onClose,
  emptySchemas,
  onDelete,
}: DeleteEmptySchemasModalProps) {
  const handleDelete = () => {
    onDelete();
    onClose();
  };

  const isEmpty = emptySchemas.length === 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delete Empty Schemas"
      maxWidth="400px"
    >
      <div className="flex flex-col gap-3">
        {isEmpty ? (
          <p className="text-sm text-content-muted">All schemas have instances.</p>
        ) : (
          <>
            <p className="text-sm text-content-muted mb-2">
              The following schemas have no instances and will be deleted:
            </p>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {emptySchemas.map((schema) => (
                <div
                  key={schema.type}
                  className="flex items-center gap-2 py-1.5 px-2 rounded text-sm text-content"
                >
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: schema.color }}
                  />
                  <span>{schema.displayName}</span>
                  <span className="text-content-muted text-xs">({schema.type})</span>
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
              Delete {emptySchemas.length} schema{emptySchemas.length !== 1 ? 's' : ''}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
