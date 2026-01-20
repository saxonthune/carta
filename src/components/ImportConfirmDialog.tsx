interface ImportConfirmDialogProps {
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ImportConfirmDialog({ fileName, onConfirm, onCancel }: ImportConfirmDialogProps) {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
      onClick={onCancel}
    >
      <div
        className="bg-surface rounded-xl w-[90%] max-w-[450px] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border">
          <h2 className="m-0 text-lg text-content">Import Project</h2>
          <button
            className="w-8 h-8 border-none rounded-md bg-transparent text-content-subtle text-2xl cursor-pointer flex items-center justify-center hover:bg-surface-alt hover:text-content"
            onClick={onCancel}
          >
            ×
          </button>
        </div>
        <div className="p-5">
          <div className="flex items-start gap-3 mb-4">
            <svg 
              className="w-6 h-6 text-amber-500 shrink-0 mt-0.5" 
              viewBox="0 0 24 24" 
              fill="none" 
              stroke="currentColor" 
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <p className="m-0 text-content font-medium mb-2">
                This will replace your current project
              </p>
              <p className="m-0 text-content-muted text-sm leading-relaxed">
                Importing <span className="font-medium text-content">{fileName}</span> will 
                replace all current nodes, edges, deployables, and custom construct schemas. 
                This action cannot be undone.
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 justify-end px-5 py-4 border-t border">
          <button
            className="px-5 py-2.5 rounded-md bg-surface text-content text-sm font-medium cursor-pointer hover:bg-surface-alt transition-colors"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="px-5 py-2.5 border-none rounded-md bg-accent text-white text-sm font-medium cursor-pointer hover:bg-accent-hover transition-colors"
            onClick={onConfirm}
          >
            Import Project
          </button>
        </div>
      </div>
    </div>
  );
}
