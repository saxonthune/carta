import { useState } from 'react';
import type { FieldSchema, ResourceFieldValue } from '@carta/domain';
import { useResources } from '../../hooks/useResources';

interface ResourceFieldProps {
  field: FieldSchema;
  value: ResourceFieldValue | undefined;
  onChange: (value: ResourceFieldValue | null) => void;
}

export default function ResourceField({ field, value, onChange }: ResourceFieldProps) {
  const { resources, getResource } = useResources();
  const [pathHintValue, setPathHintValue] = useState(value?.pathHint || '');

  const selectedResource = value?.resourceId ? getResource(value.resourceId) : undefined;
  const isOrphaned = value?.resourceId && !selectedResource;
  const isStale = value?.versionHash && selectedResource && value.versionHash !== selectedResource.currentHash;

  const handleResourceChange = (resourceId: string) => {
    if (!resourceId) {
      onChange(null);
      return;
    }
    const resource = getResource(resourceId);
    onChange({
      resourceId,
      pathHint: pathHintValue || undefined,
      versionHash: resource?.currentHash,
    });
  };

  const handlePathHintChange = (pathHint: string) => {
    setPathHintValue(pathHint);
    if (value?.resourceId) {
      onChange({
        ...value,
        pathHint: pathHint || undefined,
      });
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-semibold text-content-muted uppercase">{field.label}</label>

      {/* Resource picker */}
      <select
        className="nodrag px-2.5 py-1.5 rounded text-sm text-content bg-surface outline-none focus:ring-2 focus:ring-accent/60 transition-all border border-transparent cursor-pointer"
        value={value?.resourceId || ''}
        onChange={(e) => handleResourceChange(e.target.value)}
      >
        <option value="">Select resource...</option>
        {resources.map((r) => (
          <option key={r.id} value={r.id}>{r.name} ({r.format})</option>
        ))}
      </select>

      {/* Status indicators */}
      {isOrphaned && (
        <span className="text-[10px] text-danger">Missing resource</span>
      )}
      {isStale && (
        <span className="text-[10px] text-warning">Resource updated since reference was set</span>
      )}

      {/* PathHint input (only show when a resource is selected) */}
      {value?.resourceId && (
        <input
          type="text"
          className="nodrag px-2.5 py-1.5 rounded text-sm text-content bg-surface outline-none focus:ring-2 focus:ring-accent/60 transition-all border border-transparent"
          value={pathHintValue}
          onChange={(e) => handlePathHintChange(e.target.value)}
          placeholder="Path hint (e.g., User.email)"
        />
      )}
    </div>
  );
}
