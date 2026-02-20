import { INSTANCE_COLOR_PALETTE } from '@carta/domain';

export interface ColorPickerProps {
  value: string | undefined;
  onChange: (color: string | null) => void;
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  return (
    <div className="flex gap-1 items-center flex-wrap" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      {INSTANCE_COLOR_PALETTE.map((color) => (
        <button
          key={color}
          type="button"
          className={`w-5 h-5 rounded-full border-2 cursor-pointer transition-all hover:scale-110 ${value === color ? 'border-white shadow-[0_0_0_2px_var(--color-accent)]' : 'border-transparent'}`}
          style={{ backgroundColor: color }}
          onClick={() => onChange(color)}
        />
      ))}
      {/* Custom color slot */}
      <label className="w-5 h-5 rounded-full border border-content-muted/30 cursor-pointer flex items-center justify-center bg-surface hover:bg-surface-depth-1 transition-colors overflow-hidden relative"
        title="Custom color">
        <span className="text-[10px] text-content-muted">✎</span>
        <input
          type="color"
          className="absolute inset-0 opacity-0 cursor-pointer"
          value={value || '#888888'}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      {/* Reset button */}
      {value && (
        <button
          type="button"
          className="w-5 h-5 rounded-full border border-content-muted/30 cursor-pointer text-content-muted hover:text-content text-[10px] flex items-center justify-center bg-surface hover:bg-surface-depth-1 transition-colors"
          onClick={() => onChange(null)}
          title="Reset to default"
        >
          ×
        </button>
      )}
    </div>
  );
}
