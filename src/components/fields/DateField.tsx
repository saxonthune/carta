import type { FieldSchema } from '../../constructs/types';

interface DateFieldProps {
  field: FieldSchema;
  value: string;
  onChange: (value: string) => void;
}

export default function DateField({ field, value, onChange }: DateFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-content-muted uppercase">{field.label}</label>
      <input
        type="date"
        className="nodrag px-2.5 py-1.5 rounded text-sm text-content bg-surface outline-none focus:ring-2 focus:ring-accent/60 focus:shadow-[0_0_0_2px_rgba(99,102,241,0.1)] transition-all border border-transparent"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
