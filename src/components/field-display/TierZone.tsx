import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import DraggableField from './DraggableField';
import type { FieldSchema, DisplayTier } from '@carta/domain';

interface TierZoneProps {
  tier: DisplayTier;
  label: string;
  description: string;
  fields: FieldSchema[];
  fieldIds: string[];
  maxItems?: number;
  onEditField?: (fieldName: string) => void;
  onRemoveField?: (fieldName: string) => void;
}

export default function TierZone({ tier, label, description, fields, fieldIds, maxItems, onEditField, onRemoveField }: TierZoneProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier-${tier}` });

  return (
    <div className="mb-4">
      <div className="flex items-baseline gap-2 mb-1.5">
        <span className="text-xs font-semibold text-content uppercase tracking-wide">{label}</span>
        {maxItems && (
          <span className="text-[10px] text-content-muted">
            (max {maxItems})
          </span>
        )}
      </div>
      <p className="text-[11px] text-content-muted mb-2">{description}</p>
      <div
        ref={setNodeRef}
        className={`min-h-[48px] rounded-md border-2 border-dashed p-2 flex flex-col gap-1.5 transition-colors ${
          isOver ? 'border-accent bg-accent/5' : 'border-border'
        }`}
      >
        <SortableContext items={fieldIds} strategy={verticalListSortingStrategy}>
          {fields.length === 0 ? (
            <div className="text-xs text-content-subtle italic text-center py-2">
              Drop fields here
            </div>
          ) : (
            fields.map((field) => (
              <DraggableField
                key={field.name}
                field={field}
                id={field.name}
                onEdit={onEditField ? () => onEditField(field.name) : undefined}
                onRemove={onRemoveField ? () => onRemoveField(field.name) : undefined}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
