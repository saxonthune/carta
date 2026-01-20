import type { FieldDefinition } from '../../constructs/types';

interface TextFieldProps {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
}

export default function TextField({ field, value, onChange }: TextFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-content-muted uppercase">{field.label}</label>
      <input
        type="text"
        className="nodrag px-2.5 py-1.5 rounded text-sm text-content bg-surface outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(99,102,241,0.1)] transition-colors"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    </div>
  );
}
