import { useState } from 'react';
import { type Icon, Square, Note, Circle, Diamond, FileText, Parallelogram, Pill, CaretDown } from '@phosphor-icons/react';
import Select from '../ui/Select';
import type { ConstructSchema } from '@carta/schema';

type RenderStyle = NonNullable<ConstructSchema['nodeShape']>;

interface StylePreset {
  id: string;
  label: string;
  icon: Icon;
  properties: {
    nodeShape: RenderStyle;
    instanceColors: boolean;
  };
}

const STYLE_PRESETS: StylePreset[] = [
  { id: 'default',  label: 'Default',     icon: Square,    properties: { nodeShape: 'default',  instanceColors: false } },
  { id: 'sticky',   label: 'Sticky Note', icon: Note,      properties: { nodeShape: 'simple',   instanceColors: true  } },
  { id: 'circle',   label: 'Circle',      icon: Circle,    properties: { nodeShape: 'circle',   instanceColors: false } },
  { id: 'diamond',  label: 'Diamond',     icon: Diamond,   properties: { nodeShape: 'diamond',  instanceColors: false } },
  { id: 'document',      label: 'Document',      icon: FileText,      properties: { nodeShape: 'document',      instanceColors: false } },
  { id: 'parallelogram', label: 'Parallelogram', icon: Parallelogram, properties: { nodeShape: 'parallelogram', instanceColors: false } },
  { id: 'stadium',       label: 'Stadium',       icon: Pill,          properties: { nodeShape: 'stadium',       instanceColors: false } },
];

function findMatchingPreset(formData: ConstructSchema): StylePreset | null {
  const shape = formData.nodeShape || 'default';
  const colors = formData.instanceColors || false;
  return STYLE_PRESETS.find(p =>
    p.properties.nodeShape === shape && p.properties.instanceColors === colors
  ) ?? null;
}

interface StylePresetPickerProps {
  formData: ConstructSchema;
  updateField: (key: keyof ConstructSchema, value: unknown) => void;
}

export default function StylePresetPicker({ formData, updateField }: StylePresetPickerProps) {
  const matchingPreset = findMatchingPreset(formData);
  const [customizeOpen, setCustomizeOpen] = useState(() => matchingPreset === null);

  function applyPreset(preset: StylePreset) {
    updateField('nodeShape', preset.properties.nodeShape);
    updateField('instanceColors', preset.properties.instanceColors || undefined);
  }

  return (
    <div>
      <label className="block mb-1 text-sm font-medium text-content">Appearance</label>

      <div className="flex flex-wrap gap-2 mb-1">
        {STYLE_PRESETS.map(preset => {
          const isSelected = matchingPreset?.id === preset.id;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className={`flex flex-col items-center justify-center gap-1 px-2 py-1.5 rounded cursor-pointer transition-all border ${
                isSelected
                  ? 'ring-2 ring-accent bg-accent/10 border-accent/30 text-accent'
                  : 'bg-surface-depth-1 hover:bg-surface-depth-2 border-content-muted/20 text-content-muted hover:text-content'
              }`}
              style={{ minWidth: '60px' }}
            >
              <preset.icon size={20} weight={isSelected ? 'fill' : 'regular'} />
              <span className="text-[11px] leading-none">{preset.label}</span>
            </button>
          );
        })}
      </div>

      {!matchingPreset && (
        <span className="block mb-1 text-[11px] text-content-muted">Custom</span>
      )}

      <button
        type="button"
        className="flex items-center gap-1 text-[11px] text-content-muted cursor-pointer hover:text-content transition-colors mt-1"
        onClick={() => setCustomizeOpen(open => !open)}
      >
        Customize
        <CaretDown
          size={12}
          weight="bold"
          className={`transition-transform ${customizeOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {customizeOpen && (
        <div className="mt-2 flex flex-col gap-2">
          <div>
            <label className="block mb-1 text-[11px] text-content-muted">Render Style</label>
            <Select
              value={formData.nodeShape || 'default'}
              onChange={(e) => updateField('nodeShape', e.target.value as RenderStyle)}
            >
              <option value="default">Default</option>
              <option value="simple">Simple</option>
              <option value="circle">Circle</option>
              <option value="diamond">Diamond</option>
              <option value="document">Document</option>
              <option value="parallelogram">Parallelogram</option>
              <option value="stadium">Stadium</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm text-content cursor-pointer">
            <input
              type="checkbox"
              checked={formData.instanceColors || false}
              onChange={(e) => updateField('instanceColors', e.target.checked || undefined)}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-[11px] text-content-muted">Allow per-instance colors</span>
          </label>
        </div>
      )}
    </div>
  );
}
