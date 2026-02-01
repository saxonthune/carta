import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { FieldSchema } from '@carta/domain';

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
      <svg className="w-3.5 h-3.5 text-content-muted shrink-0" viewBox="0 0 24 24" fill="currentColor">
        <circle cx="9" cy="6" r="1.5" />
        <circle cx="15" cy="6" r="1.5" />
        <circle cx="9" cy="12" r="1.5" />
        <circle cx="15" cy="12" r="1.5" />
        <circle cx="9" cy="18" r="1.5" />
        <circle cx="15" cy="18" r="1.5" />
      </svg>
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
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
          )}
          {onRemove && (
            <button
              className="w-6 h-6 flex items-center justify-center text-content-muted hover:text-danger transition-colors rounded hover:bg-surface-alt cursor-pointer border-none"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              onPointerDown={(e) => e.stopPropagation()}
              title="Remove field"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
