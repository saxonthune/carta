import Modal from './ui/Modal';
import Button from './ui/Button';
import type { Example } from '../utils/examples';

interface ExamplesModalProps {
  examples: Example[];
  onSelect: (example: Example) => void;
  onClose: () => void;
}

export default function ExamplesModal({ examples, onSelect, onClose }: ExamplesModalProps) {
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Load Example"
      subtitle="Select an example project to load"
      maxWidth="500px"
      footer={
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-2">
        {examples.length === 0 ? (
          <p className="text-content-muted text-sm text-center py-4">
            No examples available
          </p>
        ) : (
          examples.map((example) => (
            <button
              key={example.filename}
              className="w-full text-left px-4 py-3 rounded-lg border border-subtle bg-surface hover:bg-surface-alt transition-colors cursor-pointer"
              onClick={() => onSelect(example)}
            >
              <div className="text-sm font-medium text-content">
                {example.title}
              </div>
              {example.description && (
                <div className="text-xs text-content-muted mt-0.5">
                  {example.description}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </Modal>
  );
}
