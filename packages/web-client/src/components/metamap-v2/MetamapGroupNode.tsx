import { memo } from 'react';
import type { SchemaGroup } from '@carta/schema';

interface MetamapGroupNodeProps {
  group: SchemaGroup;
  width: number;
  height: number;
  schemaCount: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  isDimmed?: boolean;
}

export const MetamapGroupNode = memo(function MetamapGroupNode({
  group,
  width,
  height,
  schemaCount,
  onPointerDown,
  isDimmed
}: MetamapGroupNodeProps) {
  const color = group.color || '#6366f1';
  return (
    <div
      className="rounded-lg"
      style={{
        width,
        height,
        backgroundColor: `color-mix(in srgb, ${color} 5%, transparent)`,
        border: `1px dashed color-mix(in srgb, ${color} 40%, var(--color-border-subtle))`,
        opacity: isDimmed ? 0.3 : 1,
        transition: 'opacity 200ms',
      }}
      data-drop-target="true"
      data-container-id={`group:${group.id}`}
    >
      {/* Header */}
      <div
        data-no-pan="true"
        onPointerDown={onPointerDown}
        className="px-3 py-1.5 flex items-center gap-2 cursor-grab active:cursor-grabbing"
      >
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
