import { useRef, useEffect, useState } from 'react';

interface CreateDeployablePopoverProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
}

export default function CreateDeployablePopover({
  isOpen,
  onClose,
  onCreate,
}: CreateDeployablePopoverProps) {
  const [newDeployableName, setNewDeployableName] = useState('');
  const [newDeployableDescription, setNewDeployableDescription] = useState('');
  const modalRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus name input when modal opens
  useEffect(() => {
    if (isOpen && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [isOpen]);

  // Handle keyboard shortcuts for modal
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        if (newDeployableName.trim()) {
          onCreate(newDeployableName, newDeployableDescription);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, newDeployableName, newDeployableDescription, onCreate, onClose]);

  // Handle click outside modal
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    // Use setTimeout to avoid closing immediately on the same click that opened it
    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 0);

    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCreate = () => {
    if (newDeployableName.trim()) {
      onCreate(newDeployableName, newDeployableDescription);
      setNewDeployableName('');
      setNewDeployableDescription('');
    }
  };

  const handleCancel = () => {
    onClose();
    setNewDeployableName('');
    setNewDeployableDescription('');
  };

  return (
    <div
      ref={modalRef}
      className="absolute top-full left-0 mt-1 bg-surface-elevated border border-content-muted/20 rounded-lg shadow-lg p-3 z-50 min-w-[280px]"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-2">
        <div className="text-node-sm font-medium text-content">New Deployable</div>
        <button
          className="text-content-muted hover:text-content text-node-lg leading-none"
          onClick={handleCancel}
          title="Cancel"
        >
          ×
        </button>
      </div>
      <div className="flex flex-col gap-2">
        <div>
          <label className="text-node-xs text-content-muted uppercase tracking-wide">Name</label>
          <input
            ref={nameInputRef}
            type="text"
            className="w-full px-2 py-1 bg-surface rounded text-node-sm text-content border border-content-muted/20"
            value={newDeployableName}
            onChange={(e) => setNewDeployableName(e.target.value)}
            placeholder="Deployable name"
          />
        </div>
        <div>
          <label className="text-node-xs text-content-muted uppercase tracking-wide">Description</label>
          <textarea
            className="w-full px-2 py-1 bg-surface rounded text-node-sm text-content border border-content-muted/20 resize-none"
            rows={2}
            value={newDeployableDescription}
            onChange={(e) => setNewDeployableDescription(e.target.value)}
            placeholder="Description (optional)"
          />
        </div>
        <button
          className="w-full px-3 py-2 text-node-sm font-medium bg-accent hover:bg-accent-hover text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
          onClick={handleCreate}
          disabled={!newDeployableName.trim()}
        >
          Create
        </button>
      </div>
    </div>
  );
}
