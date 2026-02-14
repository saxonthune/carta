import type { ConstructSchema, CompilationFormat } from '@carta/domain';

interface CompilationTabProps {
  formData: ConstructSchema;
  updateField: (key: keyof ConstructSchema, value: unknown) => void;
}

const COMPILATION_FORMATS: CompilationFormat[] = ['json', 'custom'];

export default function CompilationTab({
  formData,
  updateField
}: CompilationTabProps) {
  return (
    <div className="bg-surface-elevated rounded-lg p-4">
      <h3 className="m-0 mb-3 text-sm font-semibold text-content-muted uppercase tracking-wide">Compilation Settings</h3>

      <div className="mb-3">
        <label className="block mb-1 text-sm font-medium text-content">Format</label>
        <select
          className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent transition-colors"
          value={formData.compilation.format}
          onChange={(e) => updateField('compilation', {
            ...formData.compilation,
            format: e.target.value as CompilationFormat
          })}
        >
          {COMPILATION_FORMATS.map(format => (
            <option key={format} value={format}>{format.toUpperCase()}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block mb-1 text-sm font-medium text-content">Section Header</label>
        <input
          type="text"
          className="w-full px-2.5 py-2 bg-surface rounded-md text-content text-sm focus:outline-none focus:border-accent transition-colors"
          value={formData.compilation.sectionHeader || ''}
          onChange={(e) => updateField('compilation', {
            ...formData.compilation,
            sectionHeader: e.target.value
          })}
          placeholder="# My Section"
        />
      </div>
    </div>
  );
}
