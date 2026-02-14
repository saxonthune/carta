import { memo } from 'react';
import type { SchemaPackage } from '@carta/domain';

interface MetamapPackageNodeProps {
  pkg: SchemaPackage;
  width: number;
  height: number;
  schemaCount: number;
  onPointerDown?: (e: React.PointerEvent) => void;
}

export const MetamapPackageNode = memo(function MetamapPackageNode({
  pkg,
  width,
  height,
  schemaCount,
  onPointerDown
}: MetamapPackageNodeProps) {
  return (
    <div
      className="rounded-xl"
      style={{
        width,
        height,
        backgroundColor: `color-mix(in srgb, ${pkg.color} 8%, var(--color-surface))`,
        border: `2px solid color-mix(in srgb, ${pkg.color} 30%, var(--color-border-subtle))`,
      }}
      data-drop-target="true"
      data-container-id={`package:${pkg.id}`}
    >
      {/* Header */}
      <div
        data-no-pan="true"
        onPointerDown={onPointerDown}
        className="px-4 py-2.5 rounded-t-xl flex items-center gap-2 cursor-grab active:cursor-grabbing"
        style={{
          backgroundColor: `color-mix(in srgb, ${pkg.color} 15%, var(--color-surface-alt))`,
          borderBottom: `1px solid color-mix(in srgb, ${pkg.color} 20%, var(--color-border-subtle))`,
        }}
      >
        <span
          className="w-3 h-3 rounded-sm flex-shrink-0"
          style={{ backgroundColor: pkg.color }}
        />
        <span className="font-semibold text-node-lg text-content truncate">
          {pkg.name}
        </span>
        <span className="text-node-xs text-content-muted ml-auto">
          {schemaCount} schema{schemaCount !== 1 ? 's' : ''}
        </span>
      </div>
    </div>
  );
});
