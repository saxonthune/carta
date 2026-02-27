import type { FieldSchema } from '@carta/schema';
import { PencilSimple, Trash } from '@phosphor-icons/react';

interface FieldsListStepProps {
  fields: FieldSchema[];
  onEdit: (index: number) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}

export default function FieldsListStep({ fields, onEdit, onRemove, onAdd }: FieldsListStepProps) {
  return (
    <div className="flex flex-col gap-2">
      {fields.length === 0 ? (
        <div className="text-center py-8 text-content-muted text-sm">
          <p className="mb-2">No fields defined yet</p>
          <p className="text-xs">Fields let users enter data on construct instances</p>
        </div>
      ) : (
        fields.map((field, index) => (
          <div
            key={index}
            className="flex items-center justify-between px-3 py-2.5 bg-surface rounded-md hover:bg-surface-elevated transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-sm font-medium text-content truncate">{field.label || field.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 bg-surface-alt rounded text-content-muted uppercase">{field.type}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                className="w-8 h-8 flex items-center justify-center text-content-muted hover:text-content transition-colors rounded hover:bg-surface-alt"
                onClick={() => onEdit(index)}
                title="Edit field"
              >
                <PencilSimple weight="regular" size={16} />
              </button>
              <button
                className="w-8 h-8 flex items-center justify-center text-content-muted hover:text-danger transition-colors rounded hover:bg-surface-alt"
                onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                title="Remove field"
              >
                <Trash weight="regular" size={16} />
              </button>
            </div>
          </div>
        ))
      )}
      <button
        className="w-full px-3 py-2.5 text-sm font-medium text-accent bg-accent/10 hover:bg-accent/20 rounded-md transition-colors"
        onClick={onAdd}
      >
        + Add Field
      </button>
    </div>
  );
}
