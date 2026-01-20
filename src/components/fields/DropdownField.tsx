import type { FieldDefinition } from '../../constructs/types';

interface DropdownFieldProps {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
}

export default function DropdownField({ field, value, onChange }: DropdownFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-content-muted uppercase">{field.label}</label>
      <select
        className="nodrag px-2.5 py-1.5 rounded text-sm text-content bg-surface outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(99,102,241,0.1)] transition-colors"
        value={value || (field.default as string) || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {field.options?.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
