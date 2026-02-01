import { useState, useCallback, useEffect } from 'react';
import { useDocument } from '../hooks/useDocument';
import BasicsStep from './schema-wizard/BasicsStep';
import FieldsStep from './construct-editor/FieldsStep';
import PortsStep from './construct-editor/PortsStep';
import EditorPreview from './construct-editor/EditorPreview';
import Button from './ui/Button';
import { toSnakeCase } from '../utils/stringUtils';
import type { ConstructSchema, DisplayTier } from '@carta/domain';

type EditorTab = 'basics' | 'fields' | 'ports';

const TABS: { id: EditorTab; label: string }[] = [
  { id: 'basics', label: 'Basics' },
  { id: 'fields', label: 'Fields' },
  { id: 'ports', label: 'Ports' },
];

function createEmptySchema(): ConstructSchema {
  return {
    type: '',
    displayName: '',
    color: '#6366f1',
    semanticDescription: '',
    fields: [],
    ports: [
      { id: 'parent', portType: 'parent', position: 'top', offset: 50, label: 'Parent' },
      { id: 'child', portType: 'child', position: 'bottom', offset: 50, label: 'Children' },
      { id: 'flow-in', portType: 'flow-in', position: 'left', offset: 50, label: 'Flow In' },
      { id: 'flow-out', portType: 'flow-out', position: 'right', offset: 50, label: 'Flow Out' },
    ],
    compilation: { format: 'json', sectionHeader: '' },
  };
}

function initFieldAssignments(schema: ConstructSchema): Map<string, { tier: DisplayTier; order: number }> {
  const map = new Map<string, { tier: DisplayTier; order: number }>();
  schema.fields.forEach((field, index) => {
    map.set(field.name, {
      tier: field.displayTier || 'full',
      order: field.displayOrder ?? index,
    });
  });
  return map;
}

interface ConstructEditorProps {
  editSchema?: ConstructSchema;
  onClose: () => void;
}

export default function ConstructEditor({ editSchema, onClose }: ConstructEditorProps) {
  const { addSchema, updateSchema, getSchema, portSchemas, addPortSchema, schemaGroups } = useDocument();
  const isEditMode = !!editSchema;

  const [activeTab, setActiveTab] = useState<EditorTab>('basics');
  const [formData, setFormData] = useState<ConstructSchema>(editSchema || createEmptySchema());
  const [fieldAssignments, setFieldAssignments] = useState<Map<string, { tier: DisplayTier; order: number }>>(
    () => initFieldAssignments(editSchema || createEmptySchema())
  );
  const [portsInitialized, setPortsInitialized] = useState(!!editSchema);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const updateBasicField = useCallback((key: keyof ConstructSchema, value: unknown) => {
    if (key === 'displayName' && typeof value === 'string') {
      setFormData(prev => ({ ...prev, displayName: value, type: toSnakeCase(value) }));
    } else {
      setFormData(prev => ({ ...prev, [key]: value }));
    }
    if (errors[key as string]) {
      setErrors(prev => { const next = { ...prev }; delete next[key as string]; return next; });
    }
  }, [errors]);

  const validateBasics = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.displayName.trim()) {
      newErrors.displayName = 'Display name is required';
    }
    const derivedType = toSnakeCase(formData.displayName);
    if (derivedType && !isEditMode && getSchema(derivedType)) {
      newErrors.displayName = 'A construct with this name already exists';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [formData.displayName, isEditMode, getSchema]);

  const handleSave = useCallback(() => {
    if (!validateBasics()) {
      setActiveTab('basics');
      return;
    }

    // Sync field assignments back to formData fields
    const updatedFields = formData.fields.map((field) => {
      const assignment = fieldAssignments.get(field.name);
      const { displayTier: _, displayOrder: __, ...rest } = field;
      return {
        ...rest,
        displayTier: assignment?.tier ?? ('full' as DisplayTier),
        displayOrder: assignment?.order ?? 0,
      };
    });

    const schema: ConstructSchema = {
      ...formData,
      fields: updatedFields,
      type: toSnakeCase(formData.displayName),
      compilation: formData.compilation || { format: 'json', sectionHeader: '' },
    };

    if (isEditMode) {
      updateSchema(schema.type, schema);
    } else {
      addSchema(schema);
    }
    onClose();
  }, [validateBasics, formData, fieldAssignments, isEditMode, updateSchema, addSchema, onClose]);

  return (
    <div className="fixed top-12 bottom-6 left-0 right-0 z-30 flex flex-col bg-surface">
      {/* Header bar with actions */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0 bg-surface-elevated">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <span className="text-sm font-semibold text-content">
          {isEditMode ? 'Edit Schema' : 'New Schema'}
        </span>
        <Button
          variant="accent"
          onClick={handleSave}
          disabled={!formData.displayName.trim()}
        >
          {isEditMode ? 'Save Changes' : 'Create Schema'}
        </Button>
      </div>

      {/* Content area: left panel + right preview */}
      <div className="flex-1 flex min-h-0">
        {/* Left panel */}
        <div className="flex-[3] flex flex-col min-h-0 border-r border-border">
          {/* Tab bar */}
          <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-surface-depth-1 shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors cursor-pointer border-none ${
                  activeTab === tab.id
                    ? 'bg-accent/15 text-accent'
                    : 'text-content-muted hover:text-content hover:bg-surface-alt'
                }`}
                onClick={() => setActiveTab(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Step content */}
          <div className="flex-1 overflow-y-auto p-5 flex justify-center">
            <div className="w-full max-w-2xl">
              {activeTab === 'basics' && (
                <BasicsStep
                  formData={formData}
                  errors={errors}
                  updateField={updateBasicField}
                  schemaGroups={schemaGroups}
                />
              )}
              {activeTab === 'fields' && (
                <FieldsStep
                  formData={formData}
                  setFormData={setFormData}
                  fieldAssignments={fieldAssignments}
                  setFieldAssignments={setFieldAssignments}
                />
              )}
              {activeTab === 'ports' && (
                <PortsStep
                  formData={formData}
                  setFormData={setFormData}
                  portSchemas={portSchemas}
                  addPortSchema={addPortSchema}
                  portsInitialized={portsInitialized}
                  setPortsInitialized={setPortsInitialized}
                />
              )}
            </div>
          </div>
        </div>

        {/* Right preview panel */}
        <div className="flex-[2] overflow-y-auto p-5 bg-surface-depth-1 flex justify-center">
          <EditorPreview schema={formData} fieldAssignments={fieldAssignments} />
        </div>
      </div>
    </div>
  );
}
