import type { ConstructSchema } from '../../constructs/types';

interface BasicInfoTabProps {
  formData: ConstructSchema;
  errors: Record<string, string>;
  isReadOnly: boolean;
  isNew: boolean;
  updateField: (key: keyof ConstructSchema, value: unknown) => void;
}

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#1e293b'
];

export default function BasicInfoTab({
  formData,
  errors,
  isReadOnly,
  isNew,
  updateField
}: BasicInfoTabProps) {
  return (
    <div className="bg-surface-elevated rounded-lg p-4">
      <h3 className="m-0 mb-3 text-sm font-semibold text-content-muted uppercase tracking-wide">Basic Information</h3>

      <div className="mb-3">
        <label className="block mb-1 text-sm font-medium text-content">
          Type Identifier
          <span className="block text-[11px] font-normal text-content-muted">Unique ID (e.g., "my_construct")</span>
        </label>
        <input
          type="text"
          className={`w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent transition-colors ${errors.type ? '!border-danger' : ''}`}
          value={formData.type}
          onChange={(e) => updateField('type', e.target.value.toLowerCase())}
          placeholder="my_construct"
          disabled={isReadOnly || !isNew}
        />
        {errors.type && <span className="block mt-1 text-xs text-danger">{errors.type}</span>}
      </div>

      <div className="mb-3">
        <label className="block mb-1 text-sm font-medium text-content">Display Name</label>
        <input
          type="text"
          className={`w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent transition-colors ${errors.displayName ? '!border-danger' : ''}`}
          value={formData.displayName}
          onChange={(e) => updateField('displayName', e.target.value)}
          placeholder="My Construct"
          disabled={isReadOnly}
        />
        {errors.displayName && <span className="block mt-1 text-xs text-danger">{errors.displayName}</span>}
      </div>

      <div className="mb-3">
        <label className="block mb-1 text-sm font-medium text-content">Color</label>
        <div className="flex flex-wrap gap-1 items-center">
          {DEFAULT_COLORS.slice(0, 6).map(color => (
            <button
              key={color}
              type="button"
              className={`w-6 h-6 border-2 border-transparent rounded cursor-pointer transition-all hover:scale-110 ${formData.color === color ? 'border-white shadow-[0_0_0_2px_#6366f1]' : ''} ${isReadOnly ? 'cursor-not-allowed opacity-50' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => updateField('color', color)}
              disabled={isReadOnly}
            />
          ))}
          <input
            type="color"
            className="w-6 h-6 p-0 border-none rounded cursor-pointer"
            value={formData.color}
            onChange={(e) => updateField('color', e.target.value)}
            disabled={isReadOnly}
          />
        </div>
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Description</label>
        <textarea
          className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm resize-none focus:outline-none focus:border-accent transition-colors"
          value={formData.description || ''}
          onChange={(e) => updateField('description', e.target.value)}
          placeholder="Describe what this construct represents..."
          rows={4}
          disabled={isReadOnly}
        />
      </div>
    </div>
  );
}
