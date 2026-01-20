import { useState, useCallback, useEffect } from 'react';
import { deployableRegistry } from '../constructs/deployables';
import type { Deployable } from '../constructs/types';

interface DeployablesEditorProps {
  onBack?: () => void;
  onDeployablesChange?: () => void;
}

export default function DeployablesEditor({ onBack, onDeployablesChange }: DeployablesEditorProps) {
  const [deployables, setDeployables] = useState<Deployable[]>(() => deployableRegistry.getAll());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // Form state
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const refreshDeployables = useCallback(() => {
    setDeployables(deployableRegistry.getAll());
    onDeployablesChange?.();
  }, [onDeployablesChange]);

  const selectedDeployable = selectedId ? deployableRegistry.get(selectedId) : null;

  // Sync form state when selection changes
  useEffect(() => {
    if (selectedDeployable) {
      setEditName(selectedDeployable.name);
      setEditDescription(selectedDeployable.description);
    } else if (isCreatingNew) {
      setEditName('');
      setEditDescription('');
    }
  }, [selectedDeployable, isCreatingNew]);

  const handleSelectDeployable = (id: string) => {
    setSelectedId(id);
    setIsCreatingNew(false);
  };

  const handleAddNew = () => {
    setSelectedId(null);
    setIsCreatingNew(true);
    setEditName('');
    setEditDescription('');
  };

  const handleSave = useCallback(() => {
    if (!editName.trim()) return;

    if (isCreatingNew) {
      const newDeployable = deployableRegistry.add(editName.trim(), editDescription.trim());
      refreshDeployables();
      setSelectedId(newDeployable.id);
      setIsCreatingNew(false);
    } else if (selectedId) {
      deployableRegistry.update(selectedId, {
        name: editName.trim(),
        description: editDescription.trim(),
      });
      refreshDeployables();
    }
  }, [editName, editDescription, isCreatingNew, selectedId, refreshDeployables]);

  const handleDelete = useCallback(() => {
    if (!selectedId) return;
    
    if (confirm('Are you sure you want to delete this deployable? Constructs assigned to it will become unassigned.')) {
      deployableRegistry.remove(selectedId);
      refreshDeployables();
      setSelectedId(null);
    }
  }, [selectedId, refreshDeployables]);

  const handleCancel = () => {
    setSelectedId(null);
    setIsCreatingNew(false);
  };

  const isFullScreen = !!onBack;

  return (
    <div className={`flex flex-col bg-surface text-content ${isFullScreen ? 'w-screen h-screen' : 'w-full h-full'}`}>
      {/* Header - only show in full screen mode */}
      {isFullScreen && (
        <div className="flex items-center px-5 py-3 bg-surface-elevated border-b gap-4">
          <button
            className="flex items-center gap-2 px-4 py-2 bg-transparent rounded-md text-content cursor-pointer text-sm hover:bg-surface-alt hover:border-subtle transition-all"
            onClick={onBack}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-[18px] h-[18px]">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Map
          </button>
          <h1 className="text-xl font-semibold text-content m-0">Deployables</h1>
          <div className="flex-1" />
        </div>
      )}

      {/* Help text banner - only show in full screen mode */}
      {isFullScreen && <div className="px-6 py-4 bg-surface-elevated/50 border-b border">
        <div className="flex items-start gap-3 max-w-4xl">
          <svg className="w-5 h-5 text-accent mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <p className="text-sm text-content-muted leading-relaxed m-0">
            <span className="text-content font-medium">Deployables</span> help you organize constructs into logical units (e.g., API, Database, UI App, CDK Stack). 
            In compiled output, each construct includes its deployable assignment, helping AI agents group related code together when generating implementations.
          </p>
        </div>
      </div>}

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar - Deployables list */}
        <div className={`bg-surface-elevated border-r flex flex-col ${isFullScreen ? 'w-[280px]' : 'w-[200px]'}`}>
          <div className={`flex justify-between items-center border-b ${isFullScreen ? 'p-4' : 'px-3 py-2'}`}>
            <h2 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Deployables</h2>
            <button
              className={`bg-accent border-none rounded text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors ${isFullScreen ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'}`}
              onClick={handleAddNew}
            >
              + Add
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto ${isFullScreen ? 'p-2' : 'p-1'}`}>
            {deployables.length === 0 ? (
              <p className={`text-content-muted italic text-center ${isFullScreen ? 'px-3 py-4 text-sm' : 'px-2 py-2 text-xs'}`}>
                No deployables yet. Click "Add New" to create one.
              </p>
            ) : (
              deployables.map(deployable => (
                <button
                  key={deployable.id}
                  className={`flex flex-col w-full bg-transparent border-transparent rounded-md text-content cursor-pointer text-left hover:bg-surface-alt transition-all ${
                    selectedId === deployable.id ? 'bg-surface-alt border-accent' : ''
                  } ${isFullScreen ? 'px-3 py-2.5 text-sm gap-1' : 'px-2 py-1.5 text-xs gap-0.5'}`}
                  onClick={() => handleSelectDeployable(deployable.id)}
                >
                  <span className="font-medium truncate">{deployable.name}</span>
                  {deployable.description && (
                    <span className={`text-content-muted line-clamp-2 ${isFullScreen ? 'text-xs' : 'text-[10px]'}`}>{deployable.description}</span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right panel - Edit form */}
        <div className={`flex-1 overflow-y-auto bg-surface ${isFullScreen ? 'p-6' : 'p-3'}`}>
          {isCreatingNew || selectedDeployable ? (
            <div className={isFullScreen ? 'max-w-2xl' : ''}>
              <h2 className={`font-semibold text-content ${isFullScreen ? 'text-lg mb-6' : 'text-base mb-3'}`}>
                {isCreatingNew ? 'Create New Deployable' : 'Edit Deployable'}
              </h2>

              <div className={`flex flex-col ${isFullScreen ? 'gap-5' : 'gap-3'}`}>
                {/* Name field */}
                <div className={`flex flex-col ${isFullScreen ? 'gap-2' : 'gap-1'}`}>
                  <label className={`font-medium text-content-muted ${isFullScreen ? 'text-sm' : 'text-xs'}`}>Name</label>
                  <input
                    type="text"
                    className={`bg-surface-elevated rounded-md text-content outline-none focus:border-accent transition-colors ${isFullScreen ? 'px-3 py-2 text-sm' : 'px-2 py-1.5 text-xs'}`}
                    placeholder="e.g., User API, Database Layer, Admin Dashboard"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>

                {/* Description field */}
                <div className={`flex flex-col ${isFullScreen ? 'gap-2' : 'gap-1'}`}>
                  <label className={`font-medium text-content-muted ${isFullScreen ? 'text-sm' : 'text-xs'}`}>Description</label>
                  <textarea
                    className={`bg-surface-elevated rounded-md text-content outline-none focus:border-accent transition-colors resize-none ${isFullScreen ? 'px-3 py-2 text-sm' : 'px-2 py-1.5 text-xs'}`}
                    placeholder="Describe what this deployable represents..."
                    rows={isFullScreen ? 4 : 2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                  />
                  {isFullScreen && (
                    <p className="text-xs text-content-muted">
                      This description will be included in the compiled output to help AI agents understand the grouping.
                    </p>
                  )}
                </div>

                {/* Action buttons */}
                <div className={`flex gap-2 border-t ${isFullScreen ? 'pt-4 mt-2' : 'pt-2 mt-1'}`}>
                  <button
                    className={`bg-accent border-none rounded-md text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${isFullScreen ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`}
                    onClick={handleSave}
                    disabled={!editName.trim()}
                  >
                    {isCreatingNew ? 'Create' : 'Save'}
                  </button>
                  <button
                    className={`bg-transparent rounded-md text-content font-medium cursor-pointer hover:bg-surface-alt transition-colors ${isFullScreen ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`}
                    onClick={handleCancel}
                  >
                    Cancel
                  </button>
                  {!isCreatingNew && selectedId && (
                    <button
                      className={`bg-transparent border-danger rounded-md text-danger font-medium cursor-pointer hover:bg-danger-muted transition-colors ml-auto ${isFullScreen ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'}`}
                      onClick={handleDelete}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className={`flex items-center justify-center h-full text-content-muted ${isFullScreen ? 'text-[15px]' : 'text-sm'}`}>
              <p>Select a deployable to view or edit, or click "Add New" to create one.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
