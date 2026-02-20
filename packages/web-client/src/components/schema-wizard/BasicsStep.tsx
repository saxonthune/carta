import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { toSnakeCase } from '../../utils/stringUtils';
import type { ConstructSchema } from '@carta/domain';

type RenderStyle = NonNullable<ConstructSchema['nodeShape']>;

const DEFAULT_COLORS = [
  '#7c7fca', '#8a7cb8', '#9488b8', '#b87c8a',
  '#c49a4c', '#c4a94e', '#5ba88e', '#5a9e9e',
  '#6a8fc0', '#6b7280', '#8a7060', '#4a5568'
];

interface BasicsStepProps {
  formData: ConstructSchema;
  errors: Record<string, string>;
  updateField: (key: keyof ConstructSchema, value: unknown) => void;
  schemaGroups: Array<{ id: string; name: string; color?: string; parentId?: string }>;
  isEditMode?: boolean;
  editSchemaType?: string;
}

export default function BasicsStep({ formData, errors, updateField, schemaGroups, isEditMode, editSchemaType }: BasicsStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <label className="block mb-1 text-sm font-medium text-content">Display Name</label>
        <Input
          className={`${errors.displayName ? 'ring-1 ring-danger' : ''}`}
          value={formData.displayName}
          onChange={(e) => updateField('displayName', e.target.value)}
          placeholder="e.g., REST Controller, Database Table"
          autoFocus
        />
        {formData.displayName && (
          <span className="block mt-1 text-[11px] text-content-muted">
            Type ID: <code className="text-content-subtle">{toSnakeCase(formData.displayName)}</code>
          </span>
        )}
        {isEditMode && editSchemaType && toSnakeCase(formData.displayName) !== editSchemaType && (
          <span className="block mt-1 text-[11px] text-warning">
            Saving will rename type from <code>{editSchemaType}</code> to <code>{toSnakeCase(formData.displayName)}</code> across all instances.
          </span>
        )}
        {errors.displayName && <span className="block mt-1 text-xs text-danger">{errors.displayName}</span>}
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Semantic Description</label>
        <Textarea
          value={formData.semanticDescription || ''}
          onChange={(e) => updateField('semanticDescription', e.target.value)}
          placeholder="Describe what this construct represents..."
          rows={3}
        />
        <span className="block mt-1 text-[11px] text-content-muted">
          Add a description that separates this construct schema from the others around it
        </span>
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Group</label>
        <Select
          value={formData.groupId || ''}
          onChange={(e) => updateField('groupId', e.target.value || undefined)}
        >
          <option value="">No group</option>
          {schemaGroups.map(group => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </Select>
        <span className="block mt-1 text-[11px] text-content-muted">
          Organize schemas into logical groups for better menu organization
        </span>
      </div>

      <div>
        <label className="flex items-center gap-2 text-sm text-content cursor-pointer">
          <input
            type="checkbox"
            checked={formData.isFavorite || false}
            onChange={(e) => updateField('isFavorite', e.target.checked || undefined)}
            className="w-4 h-4 accent-accent"
          />
          <span className="font-medium">Favorite</span>
        </label>
        <span className="block mt-1 ml-6 text-[11px] text-content-muted">
          Pin to the top of the right-click menu for quick access
        </span>
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Color</label>
        <div className="flex flex-wrap gap-1.5 items-center">
          {DEFAULT_COLORS.map(color => (
            <button
              key={color}
              type="button"
              className={`w-7 h-7 border-2 rounded cursor-pointer transition-all hover:scale-110 ${formData.color === color ? 'border-white shadow-[0_0_0_2px_var(--color-accent)]' : 'border-transparent'}`}
              style={{ backgroundColor: color }}
              onClick={() => updateField('color', color)}
            />
          ))}
          <input
            type="color"
            className="w-5 h-5 p-0 border border-content-muted/20 rounded cursor-pointer opacity-60 hover:opacity-100 transition-opacity"
            value={formData.color}
            onChange={(e) => updateField('color', e.target.value)}
            title="Custom color"
          />
        </div>
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Appearance</label>
        <div>
          <label className="block mb-1 text-[11px] text-content-muted">Render Style</label>
          <Select
            value={formData.nodeShape || 'default'}
            onChange={(e) => updateField('nodeShape', e.target.value as RenderStyle)}
          >
            <option value="default">Default</option>
            <option value="simple">Simple</option>
            <option value="card">Card</option>
            <option value="circle">Circle</option>
            <option value="diamond">Diamond</option>
            <option value="document">Document</option>
          </Select>
        </div>
        <label className="flex items-center gap-2 text-sm text-content cursor-pointer mt-2">
          <input
            type="checkbox"
            checked={formData.instanceColors || false}
            onChange={(e) => updateField('instanceColors', e.target.checked || undefined)}
            className="w-4 h-4 accent-accent"
          />
          <span className="text-[11px] text-content-muted">Allow per-instance colors</span>
        </label>
      </div>
    </div>
  );
}
