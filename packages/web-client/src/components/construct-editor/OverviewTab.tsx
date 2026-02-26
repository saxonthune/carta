import type { ConstructSchema } from '@carta/schema';
import SchemaGroupSelector from '../ui/SchemaGroupSelector';
import Input from '../ui/Input';
import Textarea from '../ui/Textarea';
import { toSnakeCase } from '../../utils/stringUtils';

interface OverviewTabProps {
  formData: ConstructSchema;
  errors: Record<string, string>;
  updateField: (key: keyof ConstructSchema, value: unknown) => void;
}

const DEFAULT_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#06b6d4', '#3b82f6', '#64748b', '#1e293b'
];

export default function OverviewTab({
  formData,
  errors,
  updateField
}: OverviewTabProps) {
  return (
    <div className="bg-surface-elevated rounded-lg p-4">
      <h3 className="m-0 mb-3 text-sm font-semibold text-content-muted uppercase tracking-wide">Overview</h3>

      <div className="mb-3">
        <label className="block mb-1 text-sm font-medium text-content">Display Name</label>
        <Input
          className={`${errors.displayName ? '!border-danger' : ''}`}
          value={formData.displayName}
          onChange={(e) => updateField('displayName', e.target.value)}
          placeholder="My Construct"
        />
        {formData.displayName && (
          <span className="block mt-1 text-[11px] text-content-muted">Type ID: {toSnakeCase(formData.displayName)}</span>
        )}
        {errors.displayName && <span className="block mt-1 text-xs text-danger">{errors.displayName}</span>}
      </div>

      <div className="mb-3">
        <label className="block mb-1 text-sm font-medium text-content">Color</label>
        <div className="flex flex-wrap gap-1 items-center">
          {DEFAULT_COLORS.slice(0, 6).map(color => (
            <button
              key={color}
              type="button"
              className={`w-6 h-6 border-2 border-transparent rounded cursor-pointer transition-all hover:scale-110 ${formData.color === color ? 'border-white shadow-[0_0_0_2px_#6366f1]' : ''}`}
              style={{ backgroundColor: color }}
              onClick={() => updateField('color', color)}
            />
          ))}
          <input
            type="color"
            className="w-6 h-6 p-0 border-none rounded cursor-pointer"
            value={formData.color}
            onChange={(e) => updateField('color', e.target.value)}
          />
        </div>
      </div>

      <div className="mb-3">
        <label className="block mb-1 text-sm font-medium text-content">Description</label>
        <Textarea
          value={formData.semanticDescription || ''}
          onChange={(e) => updateField('semanticDescription', e.target.value)}
          placeholder="Describe what this construct represents..."
          rows={4}
        />
      </div>

      <SchemaGroupSelector
        value={formData.groupId}
        onChange={(groupId) => updateField('groupId', groupId)}
        label="Group"
      />
    </div>
  );
}
