import Input from '../ui/Input';
import Select from '../ui/Select';
import Textarea from '../ui/Textarea';
import { toSnakeCase } from '../../utils/stringUtils';
import type { ConstructSchema } from '@carta/domain';

type BackgroundColorPolicy = NonNullable<ConstructSchema['backgroundColorPolicy']>;
type RenderStyle = NonNullable<ConstructSchema['renderStyle']>;
type ColorMode = NonNullable<ConstructSchema['colorMode']>;

const DEFAULT_COLORS = [
  '#7c7fca', '#8a7cb8', '#9488b8', '#b87c8a',
  '#c49a4c', '#c4a94e', '#5ba88e', '#5a9e9e',
  '#6a8fc0', '#6b7280', '#8a7060', '#4a5568'
];

const COLOR_MODES: { value: ColorMode; label: string }[] = [
  { value: 'default', label: 'Schema Default' },
  { value: 'instance', label: 'Per Instance' },
  { value: 'enum', label: 'By Field' },
];

interface BasicsStepProps {
  formData: ConstructSchema;
  errors: Record<string, string>;
  updateField: (key: keyof ConstructSchema, value: unknown) => void;
  schemaGroups: Array<{ id: string; name: string; color?: string; parentId?: string }>;
}

export default function BasicsStep({ formData, errors, updateField, schemaGroups }: BasicsStepProps) {
  const colorMode: ColorMode = formData.colorMode || 'default';
  const enumFields = formData.fields.filter(f => f.type === 'enum' && f.options && f.options.length > 0);
  const selectedEnumField = enumFields.find(f => f.name === formData.enumColorField);

  const handleColorModeChange = (mode: ColorMode) => {
    updateField('colorMode', mode);
    if (mode !== 'enum') {
      updateField('enumColorField', undefined);
      updateField('enumColorMap', undefined);
    }
  };

  const handleEnumFieldSelect = (fieldName: string) => {
    updateField('enumColorField', fieldName);
    const field = enumFields.find(f => f.name === fieldName);
    if (field?.options) {
      const map: Record<string, string> = {};
      field.options.forEach((opt, i) => {
        map[opt.value] = DEFAULT_COLORS[i % DEFAULT_COLORS.length];
      });
      updateField('enumColorMap', map);
    }
  };

  const handleEnumColorChange = (optionValue: string, color: string) => {
    const current = formData.enumColorMap || {};
    updateField('enumColorMap', { ...current, [optionValue]: color });
  };

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
        <label className="block mb-1 text-sm font-medium text-content">
          {colorMode === 'enum' ? 'Fallback Color' : 'Color'}
        </label>
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
            <label className="block mb-1 text-[11px] text-content-muted">Color Mode</label>
            <div className="flex rounded overflow-hidden border border-content-muted/20">
              {COLOR_MODES.map(mode => (
                <button
                  key={mode.value}
                  type="button"
                  className={`flex-1 px-2 py-1.5 text-[11px] font-medium transition-colors cursor-pointer border-none ${colorMode === mode.value ? 'bg-accent text-white' : 'bg-surface text-content-muted hover:bg-surface-alt'}`}
                  onClick={() => handleColorModeChange(mode.value)}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Per-instance sub-options */}
        {colorMode === 'instance' && (
          <div className="mt-2">
            <label className="block mb-1 text-[11px] text-content-muted">Instance Color Policy</label>
            <Select
              value={formData.backgroundColorPolicy || 'defaultOnly'}
              onChange={(e) => updateField('backgroundColorPolicy', e.target.value as BackgroundColorPolicy)}
            >
              <option value="defaultOnly">Default Only</option>
              <option value="tints">Tints</option>
              <option value="any">Any Color</option>
            </Select>
          </div>
        )}

        {/* Enum color mapper */}
        {colorMode === 'enum' && (
          <div className="mt-2 flex flex-col gap-2">
            <div>
              <label className="block mb-1 text-[11px] text-content-muted">Enum Field</label>
              {enumFields.length === 0 ? (
                <span className="text-[11px] text-content-muted">No enum fields defined. Add an enum field in the Fields step first.</span>
              ) : (
                <Select
                  value={formData.enumColorField || ''}
                  onChange={(e) => handleEnumFieldSelect(e.target.value)}
                >
                  <option value="">Select a field...</option>
                  {enumFields.map(f => (
                    <option key={f.name} value={f.name}>{f.label || f.name}</option>
                  ))}
                </Select>
              )}
            </div>

            {selectedEnumField?.options && formData.enumColorMap && (
              <div>
                <label className="block mb-1 text-[11px] text-content-muted">Colors per Value</label>
                <div className="flex flex-col gap-1">
                  {selectedEnumField.options.map(opt => (
                    <div key={opt.value} className="flex items-center gap-2">
                      <input
                        type="color"
                        className="w-6 h-6 p-0 border border-content-muted/20 rounded cursor-pointer"
                        value={formData.enumColorMap![opt.value] || formData.color}
                        onChange={(e) => handleEnumColorChange(opt.value, e.target.value)}
                      />
                      <span className="text-xs text-content">{opt.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
