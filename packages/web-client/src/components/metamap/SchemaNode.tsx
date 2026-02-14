import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { Plus } from '@phosphor-icons/react';
import { portRegistry } from '@carta/domain';
import type { ConstructSchema } from '@carta/domain';
import { useLodBand } from '../canvas/lod/useLodBand';

export interface SchemaNodeData {
  schema: ConstructSchema;
  isExpanded?: boolean;
  isDimmed?: boolean;
  isHighlighted?: boolean;
  isRenaming?: boolean;
  onStartRenaming?: () => void;
  onStopRenaming?: () => void;
  onCommitRename?: (newName: string) => void;
  [key: string]: unknown;
}

interface SchemaNodeProps {
  data: SchemaNodeData;
  selected?: boolean;
}

const SchemaNode = memo(({ data, selected }: SchemaNodeProps) => {
  const { schema, isExpanded, isDimmed, isHighlighted, isRenaming, onStartRenaming, onStopRenaming, onCommitRename } = data;
  const ports = schema.ports || [];
  const lod = useLodBand();

  // Rename state
  const [editValue, setEditValue] = useState(schema.displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  // LOD transition crossfade
  const prevBandRef = useRef(lod.band);
  const [lodTransitioning, setLodTransitioning] = useState(false);

  useEffect(() => {
    if (prevBandRef.current !== lod.band) {
      prevBandRef.current = lod.band;
      setLodTransitioning(true);
      requestAnimationFrame(() => setLodTransitioning(false));
    }
  }, [lod.band]);

  // Focus and select input when renaming starts
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isRenaming]);

  // Sync editValue when schema displayName changes externally
  useEffect(() => {
    if (!isRenaming) setEditValue(schema.displayName);
  }, [schema.displayName, isRenaming]);

  // Commit rename
  const commitRename = useCallback(() => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== schema.displayName && onCommitRename) {
      onCommitRename(trimmed);
    } else {
      onStopRenaming?.();
    }
  }, [editValue, schema.displayName, onCommitRename, onStopRenaming]);

  // Handle keyboard events
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Enter') {
      commitRename();
    } else if (e.key === 'Escape') {
      setEditValue(schema.displayName);
      onStopRenaming?.();
    }
  }, [commitRename, schema.displayName, onStopRenaming]);

  const lodTransitionStyle: React.CSSProperties = {
    opacity: lodTransitioning ? 0 : 1,
    transition: 'opacity 120ms ease',
  };

  // Marker variant for low zoom
  if (lod.band === 'marker') {
    return (
      <div
        className={`rounded-lg font-semibold px-5 py-3 truncate cursor-move select-none whitespace-nowrap text-content flex items-center gap-3 ${
          selected ? 'ring-2 ring-accent/40' : ''
        }`}
        style={{
          ...lodTransitionStyle,
          backgroundColor: `color-mix(in srgb, ${schema.color} 25%, var(--color-surface))`,
          minWidth: 180,
          maxWidth: 400,
          fontSize: '24px',
          boxShadow: isHighlighted
            ? `0 0 0 2px ${schema.color}50, 0 0 12px ${schema.color}30`
            : selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
          opacity: isDimmed ? 0.2 : lodTransitioning ? 0 : 1,
          pointerEvents: isDimmed ? 'none' : 'auto',
        }}
        title={`${schema.displayName} (${schema.type})`}
      >
        <span
          className="inline-block w-3 h-3 rounded-sm flex-shrink-0"
          style={{ backgroundColor: schema.color }}
        />
        <span className="truncate">{schema.displayName}</span>

        {/* Invisible handles for edges */}
        <Handle
          id="meta-connect"
          type="source"
          position={Position.Right}
          className="!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0"
          style={{ right: 0, top: '50%', pointerEvents: 'none' }}
        />
        <Handle
          id="meta-connect"
          type="target"
          position={Position.Left}
          className="!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0"
          style={{ left: 0, top: '50%', pointerEvents: 'none' }}
        />
        {ports.map((port) => (
          <span key={port.id}>
            <Handle
              id={port.id}
              type="source"
              position={Position.Bottom}
              className="!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0"
              style={{ bottom: 0, left: '50%', pointerEvents: 'none' }}
            />
            <Handle
              id={port.id}
              type="target"
              position={Position.Top}
              className="!absolute !opacity-0 !w-0 !h-0 !min-w-0 !min-h-0 !border-none !p-0"
              style={{ top: 0, left: '50%', pointerEvents: 'none' }}
            />
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className={`bg-surface rounded-lg min-w-[240px] text-node-base text-content relative transition-all duration-200 ${
        selected ? 'ring-2 ring-accent/30' : ''
      }`}
      style={{
        ...lodTransitionStyle,
        boxShadow: isHighlighted
          ? `0 0 0 2px ${schema.color}50, 0 0 12px ${schema.color}30`
          : selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        border: `1px solid var(--color-border-subtle)`,
        borderLeft: `3px solid color-mix(in srgb, ${schema.color} 70%, var(--color-surface-alt))`,
        opacity: isDimmed ? 0.2 : lodTransitioning ? 0 : 1,
        pointerEvents: isDimmed ? 'none' : 'auto',
      }}
    >
      {/* New connection handle in top-right corner with plus icon */}
      <div className="absolute top-2 right-2 z-10 group/connect">
        <Handle
          id="meta-connect"
          type="source"
          position={Position.Right}
          className="meta-port-connect"
        />
        <Handle
          id="meta-connect"
          type="target"
          position={Position.Right}
          className="meta-port-connect"
        />
        <div className="meta-port-plus">
          <Plus weight="bold" size={14} />
        </div>
        <div className="meta-port-tooltip">Create connection</div>
      </div>

      {/* Header */}
      <div className="px-3 py-2 bg-surface-alt rounded-t-lg">
        {isRenaming ? (
          <input
            ref={inputRef}
            className="font-semibold text-node-lg text-content bg-transparent border-none outline-none w-full p-0"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <div
            className="font-semibold text-node-lg text-content text-halo cursor-text"
            onClick={(e) => { e.stopPropagation(); onStartRenaming?.(); }}
          >
            {schema.displayName}
          </div>
        )}
        <div className="text-node-xs text-content-muted text-halo">{schema.type}</div>
      </div>

      {/* Compact summary (default) */}
      {!isExpanded && (
        <div className="px-3 py-2">
          <span className="text-node-xs text-content-subtle">
            {schema.fields.length} field{schema.fields.length !== 1 ? 's' : ''}
            {' · '}
            {ports.length} port{ports.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Expanded detail */}
      {isExpanded && (
        <>
          {/* Fields */}
          {schema.fields.length > 0 && (
            <div className="px-3 py-2 border-t border-border-subtle">
              <div className="text-node-xs text-content-subtle uppercase tracking-wide mb-1">Fields</div>
              {schema.fields.map((field) => (
                <div key={field.name} className="flex gap-2 text-node-xs py-0.5">
                  <span className="text-content">{field.name}</span>
                  <span className="text-content-muted">{field.type}</span>
                </div>
              ))}
            </div>
          )}

          {/* Ports */}
          {ports.length > 0 && (
            <div className="px-3 py-2 border-t border-border-subtle">
              <div className="text-node-xs text-content-subtle uppercase tracking-wide mb-1">Ports</div>
              {ports.map((port) => (
                <div key={port.id} className="flex gap-2 items-center text-node-xs py-0.5">
                  <span className="text-content">{port.label}</span>
                  <span className="text-content-subtle">({port.portType})</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Port row at bottom */}
      {ports.length > 0 && (
        <div className="flex gap-1 justify-center py-1.5 border-t border-surface-alt">
          {ports.map((port) => {
            const portSchema = portRegistry.get(port.portType);
            const portColor = portSchema?.color || '#6b7280';
            return (
              <div key={port.id} className="relative">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: portColor }}
                  title={port.label}
                />
                <Handle
                  id={port.id}
                  type="source"
                  position={Position.Bottom}
                  className="!w-3 !h-3 !rounded-full !border-0 !opacity-0 !absolute !top-0 !left-0 !transform-none"
                />
                <Handle
                  id={port.id}
                  type="target"
                  position={Position.Bottom}
                  className="!w-3 !h-3 !rounded-full !border-0 !opacity-0 !absolute !top-0 !left-0 !transform-none"
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
});

SchemaNode.displayName = 'SchemaNode';

export default SchemaNode;
