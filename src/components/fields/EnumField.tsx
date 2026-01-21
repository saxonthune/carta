import type { FieldDefinition } from '../../constructs/types';

interface EnumFieldProps {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
}

export default function EnumField({ field, value, onChange }: EnumFieldProps) {
  const options = field.options || [];

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-content-muted uppercase">{field.label}</label>
      <select
        className="nodrag px-2.5 py-1.5 rounded text-sm text-content bg-surface outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(99,102,241,0.1)] transition-colors"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">Select...</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}
