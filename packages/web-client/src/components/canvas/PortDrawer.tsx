import { useState } from 'react';
import { Handle, Position } from '@xyflow/react';
import { getPortColor } from '@carta/domain';
import type { PortConfig } from '@carta/domain';

/** Prefix for drawer handles — stripped in onConnect to produce clean edge handle IDs */
export const DRAWER_HANDLE_PREFIX = 'drawer:';

interface PortDrawerProps {
  ports: PortConfig[];
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
export default function PortDrawer({ ports }: PortDrawerProps) {
  const [expanded, setExpanded] = useState(false);

  if (ports.length === 0) return null;

  return (
    <div
      className="relative w-full"
      onMouseLeave={() => setExpanded(false)}
    >
      {/* Hover trigger zone - extends above the collapsed strip for Fitts's law */}
      <div
        className="w-full cursor-pointer"
        style={{ paddingTop: 12 }}
        onMouseEnter={() => setExpanded(true)}
      >
        {/* Collapsed strip */}
        <div
          className="w-full flex items-center justify-center gap-1.5 transition-colors"
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
          className="absolute left-0 right-0 top-full bg-surface-elevated rounded-b-lg shadow-lg border border-t-0 border-border-subtle z-[20] py-2 px-2"
          onMouseEnter={() => setExpanded(true)}
        >
          <div className="flex flex-wrap gap-2 justify-center">
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
        </div>
      )}
    </div>
  );
}
