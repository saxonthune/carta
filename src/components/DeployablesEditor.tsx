import { useState, useCallback, useEffect, forwardRef, useImperativeHandle } from 'react';
import { useDocument } from '../hooks/useDocument';
import { useDirtyStateGuard } from '../hooks/useDirtyStateGuard';
import ConfirmationModal from './ui/ConfirmationModal';
import CollapsibleSelector from './ui/CollapsibleSelector';
import type { Deployable } from '../constructs/types';

interface DeployablesEditorProps {
  onBack?: () => void;
  onDeployablesChange?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const DeployablesEditor = forwardRef<{ save: () => void }, DeployablesEditorProps>(
  function DeployablesEditor({ onBack, onDeployablesChange, onDirtyChange }, ref) {
  const {
    deployables,
    getDeployable,
    addDeployable,
    updateDeployable,
    removeDeployable,
  } = useDocument();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const refreshDeployables = useCallback(() => {
    onDeployablesChange?.();
  }, [onDeployablesChange]);

  const selectedDeployable = selectedId ? getDeployable(selectedId) : null;

  const handleSave = useCallback(() => {
    if (!editName.trim()) return;

    if (isCreatingNew) {
      const newDeployable = addDeployable({
        name: editName.trim(),
        description: editDescription.trim(),
      });
      refreshDeployables();
      setSelectedId(newDeployable.id);
      setIsCreatingNew(false);
    } else if (selectedId) {
      updateDeployable(selectedId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      refreshDeployables();
    }
  }, [editName, editDescription, isCreatingNew, selectedId, refreshDeployables, addDeployable, updateDeployable]);

  const handleSwitch = useCallback((pending: string) => {
    if (pending === '__new__') {
      setSelectedId(null);
      setIsCreatingNew(true);
      setEditName('');
      setEditDescription('');
    } else {
      setSelectedId(pending);
      setIsCreatingNew(false);
    }
  }, []);

  const {
    isDirty,
    setIsDirty,
    showConfirmModal,
    guardedSelect,
    confirmSave,
    confirmDiscard,
    confirmCancel,
  } = useDirtyStateGuard<string>({
    onSave: handleSave,
    onSwitch: handleSwitch,
  });

  // Check if form has unsaved changes
  useEffect(() => {
    if (isCreatingNew) {
      setIsDirty(editName.trim() !== '' || editDescription.trim() !== '');
    } else if (selectedDeployable) {
      setIsDirty(
        editName !== selectedDeployable.name ||
        editDescription !== selectedDeployable.description
      );
    } else {
      setIsDirty(false);
    }
  }, [editName, editDescription, selectedDeployable, isCreatingNew, setIsDirty]);

  // Notify parent when dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Sync form state when selection changes
  useEffect(() => {
    if (selectedDeployable) {
      setEditName(selectedDeployable.name);
      setEditDescription(selectedDeployable.description);
    } else if (isCreatingNew) {
      setEditName('');
      setEditDescription('');
    }
    setIsDirty(false);
  }, [selectedDeployable, isCreatingNew, setIsDirty]);

  const handleSelectDeployable = (id: string) => {
    guardedSelect(id);
  };

  const handleAddNew = () => {
    guardedSelect('__new__');
  };

  useImperativeHandle(ref, () => ({
    save: handleSave
  }), [handleSave]);

  const handleDelete = useCallback(() => {
    if (!selectedId) return;

    if (confirm('Are you sure you want to delete this deployable? Constructs assigned to it will become unassigned.')) {
      removeDeployable(selectedId);
      refreshDeployables();
      setSelectedId(null);
    }
  }, [selectedId, refreshDeployables, removeDeployable]);

  const handleCancel = () => {
    setSelectedId(null);
    setIsCreatingNew(false);
    setIsDirty(false);
  };

  const isFullScreen = !!onBack;

  // Sidebar layout (drawer mode)
  if (!isFullScreen) {
    return (
      <div className="flex flex-col h-full bg-surface-depth-3 text-content gap-3">
        {/* Collapsible list */}
        <CollapsibleSelector<Deployable>
          title="Deployables"
          items={deployables}
          selectedId={selectedId}
          onSelect={handleSelectDeployable}
          onAdd={handleAddNew}
          emptyMessage="No deployables yet"
          renderItem={(item) => (
            <div className="px-2 py-1.5">
              <div className="text-xs font-medium truncate">{item.name}</div>
              {item.description && (
                <div className="text-[10px] text-content-muted truncate">{item.description}</div>
              )}
            </div>
          )}
          renderSelectedSummary={(item) => (
            <div>
              <div className="text-xs font-medium truncate">{item.name}</div>
              {item.description && (
                <div className="text-[10px] text-content-muted truncate">{item.description}</div>
              )}
            </div>
          )}
        />

        {/* Details editor */}
        <div className="flex-1 overflow-y-auto bg-surface-depth-2 rounded-lg p-3">
          {isCreatingNew || selectedDeployable ? (
            <div className="flex flex-col gap-3">
              <h3 className="text-sm font-semibold text-content m-0">
                {isCreatingNew ? 'New Deployable' : 'Edit Deployable'}
              </h3>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-content-muted">Name</label>
                <input
                  type="text"
                  className="px-2 py-1.5 text-xs bg-surface rounded-md text-content outline-none focus:ring-1 focus:ring-accent transition-colors"
                  placeholder="e.g., User API"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-content-muted">Description</label>
                <textarea
                  className="px-2 py-1.5 text-xs bg-surface rounded-md text-content outline-none focus:ring-1 focus:ring-accent transition-colors resize-none"
                  placeholder="What this deployable represents..."
                  rows={3}
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-2 border-t border-border items-center">
                <button
                  className="px-3 py-1.5 text-xs bg-accent border-none rounded-md text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={handleSave}
                  disabled={!editName.trim()}
                >
                  {isCreatingNew ? 'Create' : 'Save'}
                </button>
                {isDirty && (
                  <span className="text-[10px] text-content-muted">• Unsaved</span>
                )}
                <button
                  className="px-3 py-1.5 text-xs bg-transparent rounded-md text-content font-medium cursor-pointer hover:bg-surface-depth-1 transition-colors"
                  onClick={handleCancel}
                >
                  Cancel
                </button>
                {!isCreatingNew && selectedId && (
                  <button
                    className="px-3 py-1.5 text-xs bg-transparent rounded-md text-danger font-medium cursor-pointer hover:bg-danger-muted transition-colors ml-auto"
                    onClick={handleDelete}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-content-muted text-xs">
              <p>Select a deployable to edit</p>
            </div>
          )}
        </div>

        <ConfirmationModal
          isOpen={showConfirmModal}
          message="You have unsaved changes. Discard?"
          onCancel={confirmCancel}
          onDiscard={confirmDiscard}
          onSave={confirmSave}
          saveDisabled={!editName.trim()}
        />
      </div>
    );
  }

  // Full-screen layout (kept for backwards compatibility)
  return (
    <div className="flex flex-col bg-surface-depth-3 text-content w-screen h-screen">
      <div className="flex items-center px-5 py-3 bg-surface-elevated border-b gap-4">
        <button
          className="flex items-center gap-2 px-4 py-2 bg-transparent rounded-md text-content cursor-pointer text-sm hover:bg-surface-alt transition-all"
          onClick={onBack}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
          Back to Map
        </button>
        <h1 className="text-xl font-semibold text-content m-0">Deployables</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] bg-surface-depth-1 flex flex-col">
          <div className="flex justify-between items-center p-4">
            <h2 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Deployables</h2>
            <button
              className="px-3 py-1.5 text-sm bg-accent border-none rounded text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors"
              onClick={handleAddNew}
            >
              + Add
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2">
            <div className="bg-surface-depth-2 rounded-xl p-2">
              {deployables.length === 0 ? (
                <p className="px-2 py-3 text-sm text-content-muted italic text-center">No deployables yet</p>
              ) : (
                deployables.map(deployable => (
                  <button
                    key={deployable.id}
                    className={`flex flex-col w-full rounded-lg cursor-pointer text-left transition-all px-3 py-2.5 text-sm gap-1 ${
                      selectedId === deployable.id
                        ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20'
                        : 'text-content bg-transparent hover:bg-surface-depth-3/50'
                    }`}
                    onClick={() => handleSelectDeployable(deployable.id)}
                  >
                    <span className="font-medium truncate">{deployable.name}</span>
                    {deployable.description && (
                      <span className={`text-xs line-clamp-2 ${selectedId === deployable.id ? 'text-accent/80' : 'text-content-muted'}`}>
                        {deployable.description}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-surface-depth-3 p-6">
          {isCreatingNew || selectedDeployable ? (
            <div className="max-w-2xl">
              <h2 className="text-lg font-semibold text-content mb-6">
                {isCreatingNew ? 'Create New Deployable' : 'Edit Deployable'}
              </h2>

              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-content-muted">Name</label>
                  <input
                    type="text"
                    className="px-3 py-2 text-sm bg-surface-elevated rounded-md text-content outline-none focus:border-accent transition-colors"
                    placeholder="e.g., User API, Database Layer, Admin Dashboard"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-content-muted">Description</label>
                  <textarea
                    className="px-3 py-2 text-sm bg-surface-elevated rounded-md text-content outline-none focus:border-accent transition-colors resize-none"
                    placeholder="Describe what this deployable represents..."
                    rows={4}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 pt-4 mt-2 border-t items-center">
                  <button
                    className="px-4 py-2 text-sm bg-accent border-none rounded-md text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={handleSave}
                    disabled={!editName.trim()}
                  >
                    {isCreatingNew ? 'Create' : 'Save'}
                  </button>
                  {isDirty && (
                    <span className="text-xs text-content-muted">• Unsaved changes</span>
                  )}
                  <button
                    className="px-4 py-2 text-sm bg-transparent rounded-md text-content font-medium cursor-pointer hover:bg-surface-alt transition-colors"
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                  {!isCreatingNew && selectedId && (
                    <button
                      className="px-4 py-2 text-sm bg-transparent border-danger rounded-md text-danger font-medium cursor-pointer hover:bg-danger-muted transition-colors ml-auto"
                      onClick={handleDelete}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-content-muted text-[15px]">
              <p>Select a deployable to view or edit, or click "Add New" to create one.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        message="You have unsaved changes. Do you want to discard them?"
        onCancel={confirmCancel}
        onDiscard={confirmDiscard}
        onSave={confirmSave}
        saveDisabled={!editName.trim()}
      />
    </div>
  );
  }
);

DeployablesEditor.displayName = 'DeployablesEditor';

export default DeployablesEditor;
