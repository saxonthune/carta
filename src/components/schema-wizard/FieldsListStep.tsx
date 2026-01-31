import type { FieldSchema } from '@carta/domain';

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
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
              <button
                className="w-8 h-8 flex items-center justify-center text-content-muted hover:text-danger transition-colors rounded hover:bg-surface-alt"
                onClick={(e) => { e.stopPropagation(); onRemove(index); }}
                title="Remove field"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
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
