import { memo, useState, useEffect, useRef, useCallback } from 'react';
import type { ConstructSchema } from '@carta/schema';
import { getPortColor } from '@carta/schema';
import { ConnectionHandle } from '../../canvas-engine/index.js';
import { Plus } from '@phosphor-icons/react';
import { portYOffset } from '../../utils/metamapV2Layout.js';

const DOT_OFFSET = 6; // Offset from right edge for port dots
const DRAWER_WIDTH = 140;

interface MetamapSchemaNodeProps {
  schema: ConstructSchema;
  width: number;
  height: number;
  onPointerDown?: (e: React.PointerEvent) => void;
  onDoubleClick?: () => void;
  onStartConnection?: (nodeId: string, handleId: string, clientX: number, clientY: number) => void;
  isExpanded?: boolean;
  isRenaming?: boolean;
  onStartRenaming?: () => void;
  onStopRenaming?: () => void;
  onCommitRename?: (newName: string) => void;
  isDimmed?: boolean;
  isHighlighted?: boolean;
  isDrawerForced?: boolean; // Force drawer open during connection drag
}

export const MetamapSchemaNode = memo(function MetamapSchemaNode({
  schema,
  width,
  height,
  onPointerDown,
  onDoubleClick,
  onStartConnection,
  isExpanded,
  isRenaming,
  onStartRenaming,
  onStopRenaming,
  onCommitRename,
  isDimmed,
  isHighlighted,
  isDrawerForced = false,
}: MetamapSchemaNodeProps) {
  const ports = schema.ports || [];

  // Rename state
  const [editValue, setEditValue] = useState(schema.displayName);
  const inputRef = useRef<HTMLInputElement>(null);

  // Drawer hover state
  const [isDrawerHovered, setIsDrawerHovered] = useState(false);
  const drawerOpen = isDrawerHovered || isDrawerForced;

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

  return (
    <div
      data-no-pan="true"
      data-connection-target="true"
      data-node-id={schema.type}
      data-handle-id="default"
      onPointerDown={onPointerDown}
      onDoubleClick={onDoubleClick}
      onPointerEnter={() => setIsDrawerHovered(true)}
      onPointerLeave={() => setIsDrawerHovered(false)}
      className="relative"
      style={{
        opacity: isDimmed ? 0.2 : 1,
        pointerEvents: isDimmed ? ('none' as const) : ('auto' as const),
        transition: 'opacity 200ms',
      }}
    >
      {/* Main node body */}
      <div
        className="bg-surface rounded-lg text-node-base text-content cursor-grab active:cursor-grabbing"
        style={{
          width,
          minHeight: height,
          height: isExpanded ? 'auto' : height,
          border: '1px solid var(--color-border-subtle)',
          borderLeft: `3px solid color-mix(in srgb, ${schema.color} 70%, var(--color-surface-alt))`,
          boxShadow: isHighlighted
            ? `0 0 0 2px ${schema.color}50, 0 0 12px ${schema.color}30`
            : 'var(--node-shadow)',
        }}
      >
        {/* Header */}
        <div className="px-3 py-2 bg-surface-alt rounded-t-lg">
          {isRenaming ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onBlur={commitRename}
              className="w-full px-1 py-0.5 text-node-lg font-semibold bg-surface border border-accent rounded"
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <div
              className="font-semibold text-node-lg text-content text-halo truncate cursor-text"
              onClick={(e) => {
                e.stopPropagation();
                onStartRenaming?.();
              }}
            >
              {schema.displayName}
            </div>
          )}
          <div className="text-node-xs text-content-muted text-halo">{schema.type}</div>
        </div>
        {/* Summary (collapsed state) */}
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
            {/* Ports (in expanded view, show inline for reference) */}
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
      </div>

      {/* Port dots on right edge (collapsed state, always visible) */}
      {ports.map((port, index) => {
        const yOffset = portYOffset(index, ports.length, height);
        const portColor = getPortColor(port.portType);
        return (
          <div
            key={port.id}
            className="absolute pointer-events-none"
            style={{
              right: -DOT_OFFSET,
              top: yOffset,
              transform: 'translateY(-50%)',
            }}
          >
            <div
              className="w-3 h-3 rounded-full border-2 border-surface"
              style={{ backgroundColor: portColor }}
            />
          </div>
        );
      })}

      {/* Port drawer (slides out on hover) */}
      {drawerOpen && (
        <div
          className="absolute bg-surface rounded-r-lg border border-border-subtle shadow-md"
          style={{
            left: width,
            top: 0,
            width: DRAWER_WIDTH,
            borderLeft: 'none',
            zIndex: isDrawerForced ? 40 : 30,
            display: 'flex',
            flexDirection: 'column',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* "(+) New Port" row */}
          <ConnectionHandle
            type="source"
            id="new-port"
            nodeId={schema.type}
            onStartConnection={onStartConnection}
            className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle hover:bg-surface-alt cursor-crosshair"
            style={{ minHeight: 32 }}
          >
            <div className="w-4 h-4 rounded-full bg-surface-alt border border-border flex items-center justify-center flex-shrink-0">
              <Plus size={8} weight="bold" className="text-content-subtle" />
            </div>
            <span className="text-node-xs text-content-subtle">New Port</span>
          </ConnectionHandle>

          {/* Port rows */}
          {ports.map((port) => {
            const portColor = getPortColor(port.portType);
            return (
              <ConnectionHandle
                key={port.id}
                type="source"
                id={port.id}
                nodeId={schema.type}
                onStartConnection={onStartConnection}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface-alt cursor-crosshair"
                style={{ minHeight: 28 }}
              >
                <div
                  className="w-3 h-3 rounded-full border-2 border-surface flex-shrink-0"
                  style={{ backgroundColor: portColor }}
                />
                <span className="text-node-xs text-content truncate">{port.label}</span>
              </ConnectionHandle>
            );
          })}
        </div>
      )}
    </div>
  );
});
