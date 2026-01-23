import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { registry } from '../constructs/registry';
import { schemaStorage } from '../constructs/storage';
import ConstructDetailsEditor from './ConstructDetailsEditor';
import { useDirtyStateGuard } from '../hooks/useDirtyStateGuard';
import ConfirmationModal from './ui/ConfirmationModal';
import type { ConstructSchema } from '../constructs/types';

interface ConstructEditorProps {
  onBack?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const ConstructEditor = forwardRef<{ save: () => void }, ConstructEditorProps>(
  function ConstructEditor({ onBack, onDirtyChange }, ref) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [schemas, setSchemas] = useState(() => registry.getAllSchemas());
  const detailsEditorRef = useRef<{ save: () => void } | null>(null);

  const refreshSchemas = useCallback(() => {
    setSchemas(registry.getAllSchemas());
  }, []);

  const handleDetailsEditorSave = useCallback(() => {
    detailsEditorRef.current?.save();
  }, []);

  const handleSwitch = useCallback((pending: string) => {
    if (pending === '__new__') {
      setSelectedType(null);
      setIsCreatingNew(true);
    } else {
      setSelectedType(pending);
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
    onSave: handleDetailsEditorSave,
    onSwitch: handleSwitch,
  });

  // Notify parent when dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Expose save method via ref for parent (Dock) to trigger from confirmation modal
  useImperativeHandle(ref, () => ({
    save: () => {
      detailsEditorRef.current?.save();
    }
  }), []);

  const selectedSchema = selectedType ? registry.getSchema(selectedType) : null;

  const handleSelectSchema = (type: string) => {
    guardedSelect(type);
  };

  const handleAddNew = () => {
    guardedSelect('__new__');
  };

  const handleSaveSchema = useCallback((schema: ConstructSchema, isNew: boolean) => {
    if (isNew) {
      registry.registerSchema(schema);
    } else {
      registry.registerSchema(schema);
    }
    schemaStorage.saveToLocalStorage();
    refreshSchemas();
    setSelectedType(schema.type);
    setIsCreatingNew(false);
  }, [refreshSchemas]);

  const handleDeleteSchema = useCallback((type: string) => {
    registry.removeSchema(type);
    schemaStorage.saveToLocalStorage();
    refreshSchemas();
    setSelectedType(null);
  }, [refreshSchemas]);

  // Notify parent when dirty state changes
  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  // Handle Delete key to delete selected schema
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedType && !isCreatingNew && !isDirty) {
        const schema = registry.getSchema(selectedType);
        if (schema && window.confirm(`Are you sure you want to delete "${schema.displayName}"? This cannot be undone.`)) {
          handleDeleteSchema(selectedType);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedType, isCreatingNew, isDirty, handleDeleteSchema]);

  const isFullScreen = !!onBack;

  return (
    <div className={`flex flex-col bg-surface-depth-3 text-content ${isFullScreen ? 'w-screen h-screen' : 'w-full h-full'}`}>
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
          <h1 className="text-xl font-semibold text-content m-0">Construct Editor</h1>
          <div className="flex-1" />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className={`bg-surface-depth-1 flex flex-col ${isFullScreen ? 'w-[280px]' : 'w-[200px]'}`}>
          <div className={`flex justify-between items-center ${isFullScreen ? 'p-4' : 'px-3 py-2'}`}>
            <h2 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Constructs</h2>
            <button
              className={`bg-accent border-none rounded text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors ${isFullScreen ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'}`}
              onClick={handleAddNew}
            >
              + Add
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto flex flex-col gap-2 ${isFullScreen ? 'px-2 pb-2' : 'px-1.5 pb-1.5'}`}>
            {schemas.length === 0 ? (
              <p className={`text-content-muted italic ${isFullScreen ? 'px-2 text-sm' : 'px-2 text-xs'}`}>No constructs available</p>
            ) : (
              <div className={`bg-surface-depth-2 rounded-xl ${isFullScreen ? 'p-2' : 'p-1.5'}`}>
                {schemas.map(schema => (
                  <button
                    key={schema.type}
                    className={`flex items-center w-full rounded-lg cursor-pointer text-left gap-2 transition-all ${
                      selectedType === schema.type 
                        ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20' 
                        : 'text-content bg-transparent hover:bg-surface-depth-3/50'
                    } ${isFullScreen ? 'px-3 py-2.5 text-sm' : 'px-2 py-1.5 text-xs'}`}
                    onClick={() => handleSelectSchema(schema.type)}
                  >
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: schema.color }}
                    />
                    <span className="flex-1 truncate">{schema.displayName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={`flex-1 overflow-hidden bg-surface-depth-3 ${isFullScreen ? 'p-6' : 'p-3'}`}>
          {isCreatingNew ? (
            <ConstructDetailsEditor
              ref={detailsEditorRef}
              construct={null}
              isNew={true}
              onSave={handleSaveSchema}
              onDelete={() => {}}
              onDirtyChange={setIsDirty}
            />
          ) : selectedSchema ? (
            <ConstructDetailsEditor
              ref={detailsEditorRef}
              construct={selectedSchema}
              isNew={false}
              onSave={handleSaveSchema}
              onDelete={handleDeleteSchema}
              onDirtyChange={setIsDirty}
            />
          ) : (
            <div className={`flex items-center justify-center h-full text-content-muted ${isFullScreen ? 'text-[15px]' : 'text-sm'}`}>
              <p>Select a construct to view or edit, or click "Add New" to create a custom construct.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        message="You have unsaved changes. Do you want to discard them and switch to a different construct?"
        onCancel={confirmCancel}
        onDiscard={confirmDiscard}
        onSave={confirmSave}
      />
    </div>
  );
  }
);

ConstructEditor.displayName = 'ConstructEditor';

export default ConstructEditor;
