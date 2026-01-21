import FieldDefinitionEditor from '../FieldDefinitionEditor';
import type { ConstructSchema, FieldDefinition } from '../../constructs/types';

interface FieldsTabProps {
  formData: ConstructSchema;
  isReadOnly: boolean;
  expandedFieldIndex: number | null;
  addField: () => void;
  updateFieldDefinition: (index: number, field: FieldDefinition) => void;
  removeField: (index: number) => void;
  moveField: (index: number, direction: 'up' | 'down') => void;
  setExpandedFieldIndex: (index: number | null) => void;
}

export default function FieldsTab({
  formData,
  isReadOnly,
  expandedFieldIndex,
  addField,
  updateFieldDefinition,
  removeField,
  moveField,
  setExpandedFieldIndex
}: FieldsTabProps) {
  return (
    <div className="bg-surface-elevated rounded-lg p-4 flex flex-col h-full">
      <div className="flex justify-between items-center mb-3 shrink-0">
        <h3 className="m-0 text-sm font-semibold text-content-muted uppercase tracking-wide">Fields Definition</h3>
        {!isReadOnly && (
          <button
            className="px-2.5 py-1 bg-surface-alt rounded text-content text-xs cursor-pointer hover:bg-content-muted transition-colors"
            onClick={addField}
          >
            + Add Field
          </button>
        )}
      </div>

      {formData.fields.length === 0 ? (
        <p className="text-content-muted text-sm italic m-0">No fields defined yet</p>
      ) : (
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="flex flex-col gap-2">
            {formData.fields.map((field, index) => (
              <FieldDefinitionEditor
                key={index}
                field={field}
                isExpanded={expandedFieldIndex === index}
                isReadOnly={isReadOnly}
                onToggleExpand={() => setExpandedFieldIndex(
                  expandedFieldIndex === index ? null : index
                )}
                onChange={(updatedField) => updateFieldDefinition(index, updatedField)}
                onRemove={() => removeField(index)}
                onMoveUp={() => moveField(index, 'up')}
                onMoveDown={() => moveField(index, 'down')}
                canMoveUp={index > 0}
                canMoveDown={index < formData.fields.length - 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
