import type { FieldDefinition } from '../../constructs/types';

interface StringFieldProps {
  field: FieldDefinition;
  value: string;
  onChange: (value: string) => void;
}

export default function StringField({ field, value, onChange }: StringFieldProps) {
  const hint = field.displayHint;

  if (hint === 'multiline' || hint === 'code') {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-content-muted uppercase">{field.label}</label>
        <textarea
          className={`nodrag w-full px-2.5 py-1.5 rounded text-sm text-content bg-surface resize-y leading-relaxed outline-none focus:ring-2 focus:ring-accent/60 focus:shadow-[0_0_0_2px_rgba(99,102,241,0.1)] transition-all border border-transparent ${hint === 'code' ? 'font-mono' : ''}`}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={hint === 'code' ? 8 : 4}
        />
      </div>
    );
  }

  if (hint === 'color') {
    return (
      <div className="flex flex-col gap-1">
        <label className="text-[11px] font-semibold text-content-muted uppercase">{field.label}</label>
        <input
          type="color"
          className="nodrag h-10 w-full rounded cursor-pointer outline-none focus:ring-2 focus:ring-accent/60 focus:shadow-[0_0_0_2px_rgba(99,102,241,0.1)] transition-all border border-transparent"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-content-muted uppercase">{field.label}</label>
      <input
        type={hint === 'password' ? 'password' : hint === 'url' ? 'url' : 'text'}
        className="nodrag px-2.5 py-1.5 rounded text-sm text-content bg-surface outline-none focus:ring-2 focus:ring-accent/60 focus:shadow-[0_0_0_2px_rgba(99,102,241,0.1)] transition-all border border-transparent"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
      />
    </div>
  );
}
