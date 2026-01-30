import type { FieldSchema } from '../../constructs/types';

interface FieldPreviewProps {
  field: FieldSchema;
}

export default function FieldPreview({ field }: FieldPreviewProps) {
  if (field.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm text-content">
        <input type="checkbox" disabled className="w-4 h-4" />
        {field.label || 'Field'}
      </label>
    );
  }
  if (field.type === 'enum') {
    return (
      <select className="w-full px-2 py-1.5 bg-surface-alt rounded text-sm text-content" disabled>
        <option>Select...</option>
        {(field.options || []).map((opt, i) => (
          <option key={i}>{opt.value}</option>
        ))}
      </select>
    );
  }
  if (field.type === 'number') {
    return <input type="number" className="w-full px-2 py-1.5 bg-surface-alt rounded text-sm text-content" placeholder={field.placeholder || 'Number'} disabled />;
  }
  if (field.type === 'date') {
    return <input type="date" className="w-full px-2 py-1.5 bg-surface-alt rounded text-sm text-content" disabled />;
  }
  // string
  if (field.displayHint === 'multiline' || field.displayHint === 'code') {
    return <textarea className="w-full px-2 py-1.5 bg-surface-alt rounded text-sm text-content font-mono resize-none" rows={2} placeholder={field.placeholder || 'Text'} disabled />;
  }
  return <input type="text" className="w-full px-2 py-1.5 bg-surface-alt rounded text-sm text-content" placeholder={field.placeholder || 'Text'} disabled />;
}
