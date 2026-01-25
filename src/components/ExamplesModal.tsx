import type { Example } from '../utils/examples';

interface ExamplesModalProps {
  examples: Example[];
  onSelect: (example: Example) => void;
  onClose: () => void;
}

export default function ExamplesModal({ examples, onSelect, onClose }: ExamplesModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl w-[90%] max-w-[500px] flex flex-col shadow-2xl max-h-[80vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-subtle shrink-0">
          <div>
            <h2 className="m-0 text-lg text-content font-semibold">Load Example</h2>
            <p className="m-0 text-xs text-content-muted mt-0.5">
              Select an example project to load
            </p>
          </div>
          <button
            className="w-9 h-9 border-none rounded-md bg-transparent text-content-subtle text-2xl cursor-pointer flex items-center justify-center hover:bg-surface-alt hover:text-content"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-2 overflow-y-auto">
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

        {/* Footer */}
        <div className="flex justify-end px-4 py-3 border-t border-subtle shrink-0">
          <button
            className="px-4 py-2 rounded-md bg-surface text-content text-sm font-medium cursor-pointer hover:bg-surface-alt transition-colors border border-subtle"
            onClick={onClose}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
