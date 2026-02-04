import { useState, useCallback, useEffect } from 'react';
import { useSchemas } from '../hooks/useSchemas';
import { usePortSchemas } from '../hooks/usePortSchemas';
import { useSchemaGroups } from '../hooks/useSchemaGroups';
import BasicsStep from './schema-wizard/BasicsStep';
import FieldsStep from './construct-editor/FieldsStep';
import PortsStep from './construct-editor/PortsStep';
import EditorPreview from './construct-editor/EditorPreview';
import Button from './ui/Button';
import SegmentedControl from './ui/SegmentedControl';
import { toSnakeCase } from '../utils/stringUtils';
import type { ConstructSchema, DisplayTier } from '@carta/domain';

type EditorTab = 'basics' | 'fields' | 'ports';

const TAB_OPTIONS: { id: EditorTab; label: string }[] = [
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
      { id: 'parent', portType: 'parent', label: 'Parent' },
      { id: 'child', portType: 'child', label: 'Children' },
      { id: 'flow-in', portType: 'flow-in', label: 'Flow In' },
      { id: 'flow-out', portType: 'flow-out', label: 'Flow Out' },
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
  const { addSchema, updateSchema, getSchema } = useSchemas();
  const { portSchemas, addPortSchema } = usePortSchemas();
  const { schemaGroups } = useSchemaGroups();
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

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed top-12 bottom-6 left-0 right-0 z-30 bg-black/50 flex items-center justify-center p-6"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-surface-depth-1 rounded-xl shadow-xl w-full h-full max-w-[1400px] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar with actions */}
        <div className="flex items-center justify-between px-5 py-3 shrink-0 bg-surface-depth-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
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

        {/* Content area: left form + right preview */}
        <div className="flex-1 flex gap-4 min-h-0 bg-surface-depth-3 p-4">
          {/* Left: form island */}
          <div className="flex-[3] flex flex-col min-h-0 bg-surface-depth-2 rounded-xl p-4 gap-3">
            {/* Segmented tab control */}
            <div className="flex justify-center shrink-0">
              <SegmentedControl options={TAB_OPTIONS} value={activeTab} onChange={setActiveTab} />
            </div>

            {/* Step content in inset well */}
            <div className="flex-1 overflow-y-auto bg-surface-inset rounded-xl p-6">
              <div className="w-full max-w-2xl mx-auto">
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

          {/* Right: preview island */}
          <div className="flex-[2] flex flex-col min-h-0 bg-surface-depth-2 rounded-xl p-4 gap-3">
            <div className="flex justify-center shrink-0">
              <span className="px-4 py-1.5 text-sm font-semibold text-content-muted">Live Preview</span>
            </div>
            <div className="flex-1 overflow-y-auto bg-surface-inset rounded-xl p-5">
              <EditorPreview schema={formData} fieldAssignments={fieldAssignments} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
