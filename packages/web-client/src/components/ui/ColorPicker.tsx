import { generateTints } from '@carta/domain';

export interface ColorPickerProps {
  policy: 'defaultOnly' | 'tints' | 'any';
  baseColor: string;
  value: string | undefined;
  onChange: (color: string | null) => void;
}

export default function ColorPicker({ policy, baseColor, value, onChange }: ColorPickerProps) {
  if (policy === 'defaultOnly') return null;

  if (policy === 'tints') {
    const tints = generateTints(baseColor, 7);
    return (
      <div className="flex gap-1 items-center">
        {tints.map((tint) => (
          <button
            key={tint}
            type="button"
            className={`w-4 h-4 rounded border-2 cursor-pointer transition-all hover:scale-110 ${value === tint ? 'border-accent shadow-[0_0_0_2px_var(--color-accent)]' : 'border-transparent'}`}
            style={{ backgroundColor: tint }}
            onClick={(e) => { e.stopPropagation(); onChange(tint); }}
          />
        ))}
        {value && (
          <button
            type="button"
            className="w-4 h-4 rounded border border-content-muted/30 cursor-pointer text-content-muted hover:text-content text-node-2xs flex items-center justify-center bg-surface hover:bg-surface-depth-1 transition-colors"
            onClick={(e) => { e.stopPropagation(); onChange(null); }}
            title="Reset to default"
          >
            ×
          </button>
        )}
      </div>
    );
  }

  // policy === 'any'
  return (
    <div className="flex gap-2 items-center">
      <input
        type="color"
        className="w-5 h-5 p-0 border border-content-muted/20 rounded cursor-pointer"
        value={value || baseColor}
        onChange={(e) => { e.stopPropagation(); onChange(e.target.value); }}
      />
      {value && (
        <button
          type="button"
          className="px-2 py-1 text-xs rounded border border-content-muted/30 cursor-pointer text-content-muted hover:text-content bg-surface hover:bg-surface-depth-1 transition-colors"
          onClick={(e) => { e.stopPropagation(); onChange(null); }}
          title="Reset to default"
        >
          Reset
        </button>
      )}
    </div>
  );
}
