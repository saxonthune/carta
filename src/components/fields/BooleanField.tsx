import type { FieldDefinition } from '../../constructs/types';

interface BooleanFieldProps {
  field: FieldDefinition;
  value: boolean;
  onChange: (value: boolean) => void;
}

export default function BooleanField({ field, value, onChange }: BooleanFieldProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          className="nodrag w-4 h-4 rounded cursor-pointer accent-accent"
          checked={value || false}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="text-sm text-content">{field.label}</span>
      </label>
    </div>
  );
}
