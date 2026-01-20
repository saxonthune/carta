import { useState, useCallback } from 'react';
import { registry } from '../constructs/registry';
import { schemaStorage } from '../constructs/storage';
import SchemaEditor from './SchemaEditor';
import type { ConstructSchema } from '../constructs/types';

interface ConstructEditorProps {
  onBack?: () => void;
}

export default function ConstructEditor({ onBack }: ConstructEditorProps) {
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [schemas, setSchemas] = useState(() => registry.getAllSchemas());

  const refreshSchemas = useCallback(() => {
    setSchemas(registry.getAllSchemas());
  }, []);

  const builtInSchemas = schemas.filter(s => s.isBuiltIn);
  const userSchemas = schemas.filter(s => !s.isBuiltIn);

  const selectedSchema = selectedType ? registry.getSchema(selectedType) : null;

  const handleSelectSchema = (type: string) => {
    setSelectedType(type);
    setIsCreatingNew(false);
  };

  const handleAddNew = () => {
    setSelectedType(null);
    setIsCreatingNew(true);
  };

  const handleSaveSchema = useCallback((schema: ConstructSchema, isNew: boolean) => {
    if (isNew) {
      registry.registerUserSchema(schema);
    } else {
      if (!schema.isBuiltIn) {
        registry.removeUserSchema(schema.type);
        registry.registerUserSchema(schema);
      }
    }
    schemaStorage.saveToLocalStorage();
    refreshSchemas();
    setSelectedType(schema.type);
    setIsCreatingNew(false);
  }, [refreshSchemas]);

  const handleDeleteSchema = useCallback((type: string) => {
    if (registry.getSchema(type)?.isBuiltIn) {
      return;
    }
    registry.removeUserSchema(type);
    schemaStorage.saveToLocalStorage();
    refreshSchemas();
    setSelectedType(null);
  }, [refreshSchemas]);

  const handleCancel = () => {
    setSelectedType(null);
    setIsCreatingNew(false);
  };

  const isFullScreen = !!onBack;

  return (
    <div className={`flex flex-col bg-surface text-content ${isFullScreen ? 'w-screen h-screen' : 'w-full h-full'}`}>
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
        <div className={`bg-surface-elevated border-r flex flex-col ${isFullScreen ? 'w-[280px]' : 'w-[200px]'}`}>
          <div className={`flex justify-between items-center border-b ${isFullScreen ? 'p-4' : 'px-3 py-2'}`}>
            <h2 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Constructs</h2>
            <button
              className={`bg-accent border-none rounded text-white font-medium cursor-pointer hover:bg-accent-hover transition-colors ${isFullScreen ? 'px-3 py-1.5 text-sm' : 'px-2 py-1 text-xs'}`}
              onClick={handleAddNew}
            >
              + Add
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto ${isFullScreen ? 'p-2' : 'p-1'}`}>
            <div className={isFullScreen ? 'mb-4' : 'mb-2'}>
              <h3 className={`m-0 text-[11px] font-semibold uppercase text-content-muted tracking-wide ${isFullScreen ? 'px-3 py-2' : 'px-2 py-1'}`}>Built-in</h3>
              {builtInSchemas.map(schema => (
                <button
                  key={schema.type}
                  className={`flex items-center w-full bg-transparent border-transparent rounded-md text-content cursor-pointer text-left gap-2 hover:bg-surface-alt transition-all ${selectedType === schema.type ? 'bg-surface-alt border-accent' : ''} ${isFullScreen ? 'px-3 py-2.5 text-sm' : 'px-2 py-1.5 text-xs'}`}
                  onClick={() => handleSelectSchema(schema.type)}
                >
                  <span
                    className="w-3 h-3 rounded-sm shrink-0"
                    style={{ backgroundColor: schema.color }}
                  />
                  <span className="flex-1 truncate">{schema.displayName}</span>
                  <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted shrink-0">Built-in</span>
                </button>
              ))}
            </div>

            <div className={isFullScreen ? 'mb-4' : 'mb-2'}>
              <h3 className={`m-0 text-[11px] font-semibold uppercase text-content-muted tracking-wide ${isFullScreen ? 'px-3 py-2' : 'px-2 py-1'}`}>Custom</h3>
              {userSchemas.length === 0 ? (
                <p className={`text-content-muted italic ${isFullScreen ? 'px-3 text-sm' : 'px-2 text-xs'}`}>No custom constructs yet</p>
              ) : (
                userSchemas.map(schema => (
                  <button
                    key={schema.type}
                    className={`flex items-center w-full bg-transparent border-transparent rounded-md text-content cursor-pointer text-left gap-2 hover:bg-surface-alt transition-all ${selectedType === schema.type ? 'bg-surface-alt border-accent' : ''} ${isFullScreen ? 'px-3 py-2.5 text-sm' : 'px-2 py-1.5 text-xs'}`}
                    onClick={() => handleSelectSchema(schema.type)}
                  >
                    <span
                      className="w-3 h-3 rounded-sm shrink-0"
                      style={{ backgroundColor: schema.color }}
                    />
                    <span className="flex-1 truncate">{schema.displayName}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className={`flex-1 overflow-hidden bg-surface ${isFullScreen ? 'p-6' : 'p-3'}`}>
          {isCreatingNew ? (
            <SchemaEditor
              schema={null}
              isNew={true}
              onSave={handleSaveSchema}
              onCancel={handleCancel}
              onDelete={() => {}}
            />
          ) : selectedSchema ? (
            <SchemaEditor
              schema={selectedSchema}
              isNew={false}
              onSave={handleSaveSchema}
              onCancel={handleCancel}
              onDelete={handleDeleteSchema}
            />
          ) : (
            <div className={`flex items-center justify-center h-full text-content-muted ${isFullScreen ? 'text-[15px]' : 'text-sm'}`}>
              <p>Select a construct to view or edit, or click "Add New" to create a custom construct.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
