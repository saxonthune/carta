import type { FieldDefinition } from '../../constructs/types';

interface CodeFieldProps {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
}

export default function CodeField({ field, value, onChange }: CodeFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-content-muted uppercase">{field.label}</label>
      <textarea
        className="nodrag w-full px-2.5 py-1.5 rounded text-sm text-content bg-surface font-mono resize-y leading-relaxed outline-none focus:border-accent focus:shadow-[0_0_0_2px_rgba(99,102,241,0.1)] transition-colors"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={8}
      />
    </div>
  );
}
