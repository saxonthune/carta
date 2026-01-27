import { useState, useCallback, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import ConstructDetailsEditor from './ConstructDetailsEditor';
import GroupedSchemaList from './ui/GroupedSchemaList';
import SchemaPreview from './SchemaPreview';
import { useDirtyStateGuard } from '../hooks/useDirtyStateGuard';
import ConfirmationModal from './ui/ConfirmationModal';
import { useDocument } from '../hooks/useDocument';
import type { ConstructSchema } from '../constructs/types';

interface ConstructEditorProps {
  onBack?: () => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

const createEmptySchema = (): ConstructSchema => ({
  type: '',
  displayName: '',
  color: '#6366f1',
  description: '',
  fields: [],
  ports: [
    { id: 'parent', portType: 'parent', position: 'top', offset: 50, label: 'Parent' },
    { id: 'child', portType: 'child', position: 'bottom', offset: 50, label: 'Children' },
    { id: 'flow-in', portType: 'flow-in', position: 'left', offset: 50, label: 'Flow In' },
    { id: 'flow-out', portType: 'flow-out', position: 'right', offset: 50, label: 'Flow Out' },
  ],
  compilation: {
    format: 'json',
    sectionHeader: ''
  }
});

const ConstructEditor = forwardRef<{ save: () => void }, ConstructEditorProps>(
  function ConstructEditor({ onBack, onDirtyChange }, ref) {
  const { schemas, schemaGroups, getSchema, addSchema, removeSchema } = useDocument();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [previewHeight, setPreviewHeight] = useState(200);
  const [isResizingPreview, setIsResizingPreview] = useState(false);
  const [isListExpanded, setIsListExpanded] = useState(true);
  const detailsEditorRef = useRef<{ save: () => void } | null>(null);

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

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useImperativeHandle(ref, () => ({
    save: () => {
      detailsEditorRef.current?.save();
    }
  }), []);

  const selectedSchema = selectedType ? getSchema(selectedType) : null;

  const handleSelectSchema = (type: string) => {
    guardedSelect(type);
    setIsListExpanded(false); // Auto-collapse on selection in sidebar
  };

  const handleAddNew = () => {
    guardedSelect('__new__');
    setIsListExpanded(false);
  };

  const handleSaveSchema = useCallback((schema: ConstructSchema, _isNew: boolean) => {
    addSchema(schema);
    setSelectedType(schema.type);
    setIsCreatingNew(false);
  }, [addSchema]);

  const handleDeleteSchema = useCallback((type: string) => {
    removeSchema(type);
    setSelectedType(null);
  }, [removeSchema]);

  const handlePreviewResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingPreview(true);
  }, []);

  useEffect(() => {
    if (!isResizingPreview) return;

    const handleMove = (e: MouseEvent) => {
      const containerRect = document.querySelector('.construct-editor-container')?.getBoundingClientRect();
      if (!containerRect) return;
      const newHeight = containerRect.bottom - e.clientY;
      setPreviewHeight(Math.max(100, Math.min(newHeight, 400)));
    };

    const handleUp = () => setIsResizingPreview(false);

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizingPreview]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedType && !isCreatingNew && !isDirty) {
        const schema = getSchema(selectedType);
        if (schema && window.confirm(`Are you sure you want to delete "${schema.displayName}"? This cannot be undone.`)) {
          handleDeleteSchema(selectedType);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedType, isCreatingNew, isDirty, handleDeleteSchema, getSchema]);

  const isFullScreen = !!onBack;

  // Auto-expand list when nothing selected
  useEffect(() => {
    if (!selectedType && !isCreatingNew) {
      setIsListExpanded(true);
    }
  }, [selectedType, isCreatingNew]);

  // Sidebar layout (drawer mode)
  if (!isFullScreen) {
    return (
      <div className="flex flex-col h-full bg-surface-depth-3 text-content gap-3">
        {/* Collapsible list */}
        <div className="bg-surface-depth-1 rounded-lg overflow-hidden shrink-0">
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 bg-surface-depth-2">
            <h3 className="text-xs font-semibold text-content-muted uppercase tracking-wide m-0">
              Constructs
            </h3>
            <button
              className="px-2 py-1 text-xs bg-accent border-none rounded text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors"
              onClick={handleAddNew}
            >
              + Add
            </button>
          </div>

          {/* Collapsed: Show selected schema summary */}
          {!isListExpanded && (selectedType || isCreatingNew) && (
            <button
              className="flex items-center gap-2 px-3 py-2 text-left bg-surface-depth-1 hover:bg-surface-depth-2 cursor-pointer transition-colors border-none w-full"
              onClick={() => setIsListExpanded(true)}
            >
              <div className="flex-1 min-w-0">
                {isCreatingNew ? (
                  <span className="text-xs text-content italic">New construct...</span>
                ) : selectedSchema ? (
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded shrink-0"
                      style={{ backgroundColor: selectedSchema.color }}
                    />
                    <span className="text-xs truncate">{selectedSchema.displayName}</span>
                  </div>
                ) : null}
              </div>
              <svg
                className="w-4 h-4 text-content-muted shrink-0"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
          )}

          {/* Expanded: Show full list */}
          {isListExpanded && (
            <div className="overflow-y-auto max-h-[300px] p-1.5">
              <GroupedSchemaList
                schemas={schemas}
                schemaGroups={schemaGroups}
                selectedType={selectedType}
                onSelectSchema={handleSelectSchema}
                isFullScreen={false}
              />
            </div>
          )}
        </div>

        {/* Details editor */}
        <div className="flex-1 overflow-y-auto bg-surface-depth-2 rounded-lg min-h-0">
          {isCreatingNew ? (
            <ConstructDetailsEditor
              ref={detailsEditorRef}
              construct={null}
              isNew={true}
              onSave={handleSaveSchema}
              onDelete={() => {}}
              onDirtyChange={setIsDirty}
              compact
            />
          ) : selectedSchema ? (
            <ConstructDetailsEditor
              ref={detailsEditorRef}
              construct={selectedSchema}
              isNew={false}
              onSave={handleSaveSchema}
              onDelete={handleDeleteSchema}
              onDirtyChange={setIsDirty}
              compact
            />
          ) : (
            <div className="flex items-center justify-center h-full text-content-muted text-xs p-4">
              <p>Select a construct to edit</p>
            </div>
          )}
        </div>

        <ConfirmationModal
          isOpen={showConfirmModal}
          message="You have unsaved changes. Discard?"
          onCancel={confirmCancel}
          onDiscard={confirmDiscard}
          onSave={confirmSave}
        />
      </div>
    );
  }

  // Full-screen layout
  return (
    <div className="flex flex-col bg-surface-depth-3 text-content construct-editor-container w-screen h-screen">
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
        <h1 className="text-xl font-semibold text-content m-0">Construct Editor</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="w-[280px] bg-surface-depth-1 flex flex-col">
          <div className="flex justify-between items-center p-4">
            <h2 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Constructs</h2>
            <button
              className="px-3 py-1.5 text-sm bg-accent border-none rounded text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors"
              onClick={handleAddNew}
            >
              + Add
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 pb-2 flex flex-col gap-2">
            <GroupedSchemaList
              schemas={schemas}
              schemaGroups={schemaGroups}
              selectedType={selectedType}
              onSelectSchema={handleSelectSchema}
              isFullScreen={true}
            />
          </div>
        </div>

        <div className="flex flex-col flex-1 overflow-hidden bg-surface-depth-3 p-6">
          <div className="flex-1 overflow-hidden min-h-0">
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
              <div className="flex items-center justify-center h-full text-content-muted text-[15px]">
                <p>Select a construct to view or edit, or click "Add New" to create one.</p>
              </div>
            )}
          </div>

          {/* Resize handle for preview */}
          <div
            className={`h-3 bg-surface-depth-2 hover:bg-accent cursor-row-resize transition-colors flex items-center justify-center ${isResizingPreview ? 'bg-accent' : ''}`}
            onMouseDown={handlePreviewResizeStart}
          >
            <div className="w-8 h-1 bg-content-muted/30 rounded-full" />
          </div>

          {/* Preview pane */}
          <div
            className="shrink-0 bg-surface-depth-2 overflow-hidden"
            style={{ height: previewHeight }}
          >
            {isCreatingNew ? (
              <SchemaPreview schema={createEmptySchema()} />
            ) : selectedSchema ? (
              <SchemaPreview schema={selectedSchema} />
            ) : null}
          </div>
        </div>
      </div>

      <ConfirmationModal
        isOpen={showConfirmModal}
        message="You have unsaved changes. Discard?"
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
