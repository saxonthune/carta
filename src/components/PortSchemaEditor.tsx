import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { useDocument } from '../hooks/useDocument';
import PortSchemaDetailsEditor from './PortSchemaDetailsEditor';
import { useDirtyStateGuard } from '../hooks/useDirtyStateGuard';
import ConfirmationModal from './ui/ConfirmationModal';
import type { PortSchema } from '../constructs/types';

interface PortSchemaEditorProps {
  onBack?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const PortSchemaEditor = forwardRef<{ save: () => void }, PortSchemaEditorProps>(
  function PortSchemaEditor({ onBack, onDirtyChange }, ref) {
  const { getPortSchemas, addPortSchema, updatePortSchema, removePortSchema } = useDocument();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [schemas, setSchemas] = useState<PortSchema[]>(() => getPortSchemas());
  const detailsEditorRef = useRef<{ save: () => void } | null>(null);

  const refreshSchemas = useCallback(() => {
    setSchemas(getPortSchemas());
  }, [getPortSchemas]);

  const handleDetailsEditorSave = useCallback(() => {
    detailsEditorRef.current?.save();
  }, []);

  const handleSwitch = useCallback((pending: string) => {
    if (pending === '__new__') {
      setSelectedId(null);
      setIsCreatingNew(true);
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

  const selectedSchema = selectedId ? schemas.find(s => s.id === selectedId) : null;

  const handleSelectSchema = (id: string) => {
    guardedSelect(id);
  };

  const handleAddNew = () => {
    guardedSelect('__new__');
  };

  const handleSaveSchema = useCallback((schema: PortSchema, isNew: boolean) => {
    if (isNew) {
      addPortSchema(schema);
    } else {
      updatePortSchema(schema.id, schema);
    }
    refreshSchemas();
    setSelectedId(schema.id);
    setIsCreatingNew(false);
  }, [refreshSchemas, addPortSchema, updatePortSchema]);

  const handleDeleteSchema = useCallback((id: string) => {
    removePortSchema(id);
    refreshSchemas();
    setSelectedId(null);
  }, [refreshSchemas, removePortSchema]);

  // Subscribe to port schemas changes
  useEffect(() => {
    setSchemas(getPortSchemas());
  }, [getPortSchemas]);

  // Handle Delete key to delete selected schema
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedId && !isCreatingNew && !isDirty) {
        const schema = schemas.find(s => s.id === selectedId);
        if (schema && window.confirm(`Are you sure you want to delete "${schema.displayName}"? This cannot be undone.`)) {
          handleDeleteSchema(selectedId);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedId, isCreatingNew, isDirty, handleDeleteSchema, schemas]);

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
          <h1 className="text-xl font-semibold text-content m-0">Port Schema Editor</h1>
          <div className="flex-1" />
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        <div className={`bg-surface-depth-1 flex flex-col ${isFullScreen ? 'w-[280px]' : 'w-[200px]'}`}>
          <div className={`flex justify-between items-center ${isFullScreen ? 'p-4' : 'px-3 py-2'}`}>
            <h2 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Port Schemas</h2>
            <button
              className={`bg-accent border-none rounded text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors ${isFullScreen ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'}`}
              onClick={handleAddNew}
            >
              + Add
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto flex flex-col gap-2 ${isFullScreen ? 'px-2 pb-2' : 'px-1.5 pb-1.5'}`}>
            {schemas.length === 0 ? (
              <p className={`text-content-muted italic ${isFullScreen ? 'px-2 text-sm' : 'px-2 text-xs'}`}>No port schemas available</p>
            ) : (
              <div className={`bg-surface-depth-2 rounded-xl ${isFullScreen ? 'p-2' : 'p-1.5'}`}>
                {schemas.map(schema => (
                  <button
                    key={schema.id}
                    className={`flex items-center w-full rounded-lg cursor-pointer text-left gap-2 transition-all ${
                      selectedId === schema.id
                        ? 'bg-accent/30 text-accent ring-2 ring-accent/60 shadow-sm shadow-accent/20'
                        : 'text-content bg-transparent hover:bg-surface-depth-3/50'
                    } ${isFullScreen ? 'px-3 py-2.5 text-sm' : 'px-2 py-1.5 text-xs'}`}
                    onClick={() => handleSelectSchema(schema.id)}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
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
            <PortSchemaDetailsEditor
              ref={detailsEditorRef}
              portSchema={null}
              isNew={true}
              onSave={handleSaveSchema}
              onDelete={() => {}}
              onDirtyChange={setIsDirty}
            />
          ) : selectedSchema ? (
            <PortSchemaDetailsEditor
              ref={detailsEditorRef}
              portSchema={selectedSchema}
              isNew={false}
              onSave={handleSaveSchema}
              onDelete={handleDeleteSchema}
              onDirtyChange={setIsDirty}
            />
          ) : (
            <div className={`flex items-center justify-center h-full text-content-muted ${isFullScreen ? 'text-[15px]' : 'text-sm'}`}>
              <p>Select a port schema to view or edit, or click "Add New" to create a custom port schema.</p>
            </div>
          )}
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        message="You have unsaved changes. Do you want to discard them and switch to a different port schema?"
        onCancel={confirmCancel}
        onDiscard={confirmDiscard}
        onSave={confirmSave}
      />
    </div>
  );
  }
);

PortSchemaEditor.displayName = 'PortSchemaEditor';

export default PortSchemaEditor;
