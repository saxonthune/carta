import { memo } from 'react';
import type { ConstructSchema } from '@carta/domain';

interface MetamapSchemaNodeProps {
  schema: ConstructSchema;
  width: number;
  height: number;
}

export const MetamapSchemaNode = memo(function MetamapSchemaNode({ schema, width, height }: MetamapSchemaNodeProps) {
  const ports = schema.ports || [];
  return (
    <div
      className="bg-surface rounded-lg text-node-base text-content"
      style={{
        width,
        height,
        border: '1px solid var(--color-border-subtle)',
        borderLeft: `3px solid color-mix(in srgb, ${schema.color} 70%, var(--color-surface-alt))`,
        boxShadow: 'var(--node-shadow)',
      }}
    >
      {/* Header */}
      <div className="px-3 py-2 bg-surface-alt rounded-t-lg">
        <div className="font-semibold text-node-lg text-content text-halo truncate">
          {schema.displayName}
        </div>
        <div className="text-node-xs text-content-muted text-halo">{schema.type}</div>
      </div>
      {/* Summary */}
      <div className="px-3 py-2">
        <span className="text-node-xs text-content-subtle">
          {schema.fields.length} field{schema.fields.length !== 1 ? 's' : ''}
          {' · '}
          {ports.length} port{ports.length !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
});
