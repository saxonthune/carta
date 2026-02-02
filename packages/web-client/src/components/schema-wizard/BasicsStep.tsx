import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { toSnakeCase } from '../../utils/stringUtils';
import type { ConstructSchema } from '@carta/domain';

type BackgroundColorPolicy = NonNullable<ConstructSchema['backgroundColorPolicy']>;
type PortDisplayPolicy = NonNullable<ConstructSchema['portDisplayPolicy']>;
type RenderStyle = NonNullable<ConstructSchema['renderStyle']>;

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
}

export default function BasicsStep({ formData, errors, updateField, schemaGroups }: BasicsStepProps) {
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
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block mb-1 text-[11px] text-content-muted">Render Style</label>
            <Select
              value={formData.renderStyle || 'default'}
              onChange={(e) => updateField('renderStyle', e.target.value as RenderStyle)}
            >
              <option value="default">Default</option>
              <option value="card">Card</option>
            </Select>
          </div>
          <div className="flex-1">
            <label className="block mb-1 text-[11px] text-content-muted">Background Color Policy</label>
            <Select
              value={formData.backgroundColorPolicy || 'defaultOnly'}
              onChange={(e) => updateField('backgroundColorPolicy', e.target.value as BackgroundColorPolicy)}
            >
              <option value="defaultOnly">Default Only</option>
              <option value="tints">Tints</option>
              <option value="any">Any Color</option>
            </Select>
          </div>
          <div className="flex-1">
            <label className="block mb-1 text-[11px] text-content-muted">Port Display</label>
            <Select
              value={formData.portDisplayPolicy || 'inline'}
              onChange={(e) => updateField('portDisplayPolicy', e.target.value as PortDisplayPolicy)}
            >
              <option value="inline">Inline</option>
              <option value="collapsed">Collapsed</option>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
