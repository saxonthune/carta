import { Handle, Position } from '@xyflow/react';
import { canConnect, getPortColor } from '@carta/domain';
import type { PortConfig } from '@carta/domain';

interface IndexBasedDropZonesProps {
  ports: PortConfig[];
  sourcePortType?: string;
}

/**
 * Horizontal strip drop zones stacked top-to-bottom by port array index.
 * Replaces the old position-based ConnectionDropZones.
 * Rendered as an overlay when the node is a connection target during drag.
 */
export default function IndexBasedDropZones({ ports, sourcePortType }: IndexBasedDropZonesProps) {
  if (ports.length === 0) return null;

  // Each strip gets equal height, capped so they don't exceed node bounds
  const stripHeight = Math.max(30, 100 / ports.length);

  return (
    <div
      className="absolute inset-0 rounded-lg z-[5] flex flex-col overflow-hidden"
      style={{ pointerEvents: 'none' }}
    >
      {ports.map((port) => {
        const isValid = sourcePortType ? canConnect(sourcePortType, port.portType) : true;
        const portColor = getPortColor(port.portType);

        return (
          <div
            key={port.id}
            className="relative flex items-center justify-center"
            style={{
              flex: `0 0 ${stripHeight}%`,
              maxHeight: '100%',
              backgroundColor: isValid ? portColor + '40' : 'rgba(128,128,128,0.15)',
              border: isValid ? `2px solid ${portColor}` : '2px dotted rgba(128,128,128,0.4)',
              pointerEvents: isValid ? 'auto' : 'none',
            }}
          >
            {/* Label */}
            <span
              className="text-halo font-semibold pointer-events-none select-none"
              style={{
                fontSize: '11px',
                color: isValid ? portColor : 'rgba(128,128,128,0.6)',
              }}
            >
              {port.label}
            </span>

            {/* Oversized Handle that fills the zone */}
            {isValid && (
              <Handle
                id={port.id}
                type="target"
                position={Position.Left}
                className="!absolute !inset-0 !w-full !h-full !opacity-0 !border-none !rounded-none !transform-none"
                style={{
                  top: 0,
                  left: 0,
                  transform: 'none',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
