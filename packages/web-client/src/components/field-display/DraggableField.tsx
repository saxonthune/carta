import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FieldSchema } from '@carta/domain';
import { DotsSixVertical, PencilSimple, Trash } from '@phosphor-icons/react';

interface DraggableFieldProps {
  field: FieldSchema;
  id: string;
  onEdit?: () => void;
  onRemove?: () => void;
}

const TYPE_COLORS: Record<string, string> = {
  string: 'bg-blue-100 text-blue-700',
  number: 'bg-green-100 text-green-700',
  boolean: 'bg-amber-100 text-amber-700',
  date: 'bg-purple-100 text-purple-700',
  enum: 'bg-pink-100 text-pink-700',
};

export default function DraggableField({ field, id, onEdit, onRemove }: DraggableFieldProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id,
    data: { field } // Add data to enable proper drag detection
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 px-3 py-2 bg-surface-depth-2 rounded-md border-2 cursor-grab active:cursor-grabbing select-none ${isDragging ? 'shadow-lg ring-2 ring-accent z-50 border-accent' : 'border-border hover:border-accent/40 hover:bg-surface-depth-1'}`}
      {...attributes}
      {...listeners}
    >
      <DotsSixVertical weight="bold" size={16} className="text-content-muted shrink-0" />
      <span className="text-sm font-medium text-content truncate flex-1">{field.label || field.name}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded ${TYPE_COLORS[field.type] || 'bg-gray-100 text-gray-600'}`}>
        {field.type}
      </span>
      {(onEdit || onRemove) && (
        <div className="flex items-center gap-0.5 ml-1">
          {onEdit && (
            <button
              className="w-6 h-6 flex items-center justify-center text-content-muted hover:text-content transition-colors rounded hover:bg-surface-alt cursor-pointer border-none"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Edit field"
            >
              <PencilSimple weight="regular" size={16} />
            </button>
          )}
          {onRemove && (
            <button
              className="w-6 h-6 flex items-center justify-center text-content-muted hover:text-danger transition-colors rounded hover:bg-surface-alt cursor-pointer border-none"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Remove field"
            >
              <Trash weight="regular" size={16} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
