import { useState, useEffect } from 'react';

interface ProjectInfoModalProps {
  title: string;
  description: string;
  onSave: (title: string, description: string) => void;
  onClose: () => void;
}

export default function ProjectInfoModal({
  title,
  description,
  onSave,
  onClose,
}: ProjectInfoModalProps) {
  const [editedTitle, setEditedTitle] = useState(title);
  const [editedDescription, setEditedDescription] = useState(description);

  // Sync with props when modal opens
  useEffect(() => {
    setEditedTitle(title);
    setEditedDescription(description);
  }, [title, description]);

  const handleSave = () => {
    onSave(editedTitle, editedDescription);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && e.metaKey) {
      handleSave();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1001]"
      onClick={onClose}
    >
      <div
        className="bg-surface rounded-xl w-[90%] max-w-[500px] flex flex-col shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-subtle">
          <h2 className="m-0 text-lg text-content font-semibold">Project Info</h2>
          <button
            className="w-9 h-9 border-none rounded-md bg-transparent text-content-subtle text-2xl cursor-pointer flex items-center justify-center hover:bg-surface-alt hover:text-content"
            onClick={onClose}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="p-4 flex flex-col gap-4">
          <div>
            <label className="block text-xs text-content-muted mb-1">
              Project Title
            </label>
            <input
              type="text"
              className="w-full px-3 py-2 rounded-md border border-subtle bg-surface text-content text-sm focus:outline-none focus:border-accent"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              placeholder="Untitled Project"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs text-content-muted mb-1">
              Description
            </label>
            <textarea
              className="w-full px-3 py-2 rounded-md border border-subtle bg-surface text-content text-sm focus:outline-none focus:border-accent resize-none"
              value={editedDescription}
              onChange={(e) => setEditedDescription(e.target.value)}
              placeholder="A brief description of this project..."
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end px-4 py-3 border-t border-subtle">
          <button
            className="px-4 py-2 rounded-md bg-surface text-content text-sm font-medium cursor-pointer hover:bg-surface-alt transition-colors border border-subtle"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="px-4 py-2 border-none rounded-md bg-emerald-500 text-white text-sm font-medium cursor-pointer hover:bg-emerald-600 transition-colors"
            onClick={handleSave}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
