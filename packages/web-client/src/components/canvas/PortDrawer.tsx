import { memo, useRef, useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { getPortColor } from '@carta/domain';
import { PencilSimple } from '@phosphor-icons/react';
import type { PortConfig } from '@carta/domain';

/** Prefix for drawer handles — stripped in onConnect to produce clean edge handle IDs */
export const DRAWER_HANDLE_PREFIX = 'drawer:';

interface PortDrawerProps {
  ports: PortConfig[];
  // Color dropper (simple mode)
  colorPickerPolicy?: 'defaultOnly' | 'tints' | 'any';
  baseColor?: string;
  instanceColor?: string;
  onColorChange?: (color: string | null) => void;
}

/**
 * Port drawer at the bottom of construct nodes.
 * Collapsed: thin strip with colored dots.
 * Expanded: overlays downward showing port circles with labels.
 *
 * Drawer handles use prefixed IDs (`drawer:flow-out`) so they don't collide
 * with the invisible anchor handles on the node body. The prefix is stripped
 * in onConnect so persistent edges reference the clean port ID.
 */
export default memo(function PortDrawer({ ports, colorPickerPolicy, baseColor, instanceColor, onColorChange }: PortDrawerProps) {
  const [expanded, setExpanded] = useState(false);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const showColorDropper = onColorChange && colorPickerPolicy && colorPickerPolicy !== 'defaultOnly';

  if (ports.length === 0) return null;

  return (
    <div
      className="relative w-full"
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Hover trigger zone — sits below node boundary, clear of resize handles */}
      <div
        className="w-full cursor-pointer"
        style={{ paddingTop: 12 }}
        onMouseEnter={() => setExpanded(true)}
      >
        {/* Collapsed strip */}
        <div
          className="w-full flex items-center justify-center gap-1.5 transition-colors rounded-b-md"
          style={{
            height: expanded ? 0 : 12,
            overflow: 'hidden',
            backgroundColor: 'var(--color-surface-alt)',
          }}
        >
          {ports.map((port) => (
            <div
              key={port.id}
              className="w-2 h-2 rounded-full flex-shrink-0"
              style={{ backgroundColor: getPortColor(port.portType) }}
            />
          ))}
        </div>
      </div>

      {/* Expanded drawer - overlays downward */}
      {expanded && (
        <div
          className="port-drawer-expanded absolute left-0 right-0 top-full z-[30] bg-surface-elevated rounded-b-lg border-x border-b border-border-subtle py-2 px-2 shadow-md"
          onMouseEnter={() => setExpanded(true)}
        >
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap gap-2 justify-center flex-1">
              {ports.map((port) => {
                const portColor = getPortColor(port.portType);
                return (
                  <div
                    key={port.id}
                    className="flex flex-col items-center gap-0.5 relative"
                  >
                    {/* Source handle for initiating connections (prefixed ID) */}
                    <div className="relative">
                      <Handle
                        id={`${DRAWER_HANDLE_PREFIX}${port.id}`}
                        type="source"
                        position={Position.Bottom}
                        className="!relative !transform-none !inset-auto !w-4 !h-4 !rounded-full !border-2 !border-white hover:!scale-125 !transition-transform"
                        style={{
                          backgroundColor: portColor,
                        }}
                      />
                    </div>
                    <span
                      className="text-[9px] text-content-muted text-center leading-tight max-w-[60px] truncate"
                      title={port.label}
                    >
                      {port.label}
                    </span>
                  </div>
                );
              })}
            </div>
            {showColorDropper && (
              <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                <button
                  className="w-5 h-5 rounded-full border border-content-muted/30 flex items-center justify-center hover:scale-110 transition-transform"
                  style={{ backgroundColor: instanceColor || baseColor }}
                  title="Change color"
                  onClick={() => colorInputRef.current?.click()}
                >
                  <PencilSimple weight="regular" size={14} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                </button>
                {instanceColor && (
                  <button
                    className="text-[8px] text-content-muted hover:text-content leading-none"
                    title="Reset to default"
                    onClick={() => onColorChange(null)}
                  >
                    reset
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Color input lives outside expanded section so it stays mounted while native picker is open */}
      {showColorDropper && (
        <input
          ref={colorInputRef}
          type="color"
          className="sr-only"
          value={instanceColor || baseColor || '#888888'}
          onChange={(e) => onColorChange!(e.target.value)}
        />
      )}
    </div>
  );
})
