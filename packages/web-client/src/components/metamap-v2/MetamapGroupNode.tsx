import { memo } from 'react';
import type { SchemaGroup } from '@carta/domain';

interface MetamapGroupNodeProps {
  group: SchemaGroup;
  width: number;
  height: number;
  schemaCount: number;
}

export const MetamapGroupNode = memo(function MetamapGroupNode({ group, width, height, schemaCount }: MetamapGroupNodeProps) {
  const color = group.color || '#6366f1';
  return (
    <div
      className="rounded-lg"
      style={{
        width,
        height,
        backgroundColor: `color-mix(in srgb, ${color} 5%, transparent)`,
        border: `1px dashed color-mix(in srgb, ${color} 40%, var(--color-border-subtle))`,
      }}
    >
      {/* Header */}
      <div className="px-3 py-1.5 flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-sm flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <span className="font-medium text-node-base text-content truncate">
          {group.name}
        </span>
        <span className="text-node-xs text-content-muted ml-auto">
          {schemaCount}
        </span>
      </div>
    </div>
  );
});
