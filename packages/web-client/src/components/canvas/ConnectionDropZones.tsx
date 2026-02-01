import { Handle, Position } from '@xyflow/react';
import { canConnect, getHandleType, getPortColor } from '@carta/domain';
import type { PortConfig, PortPosition } from '@carta/domain';

const positionMap: Record<PortPosition, Position> = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

/**
 * Get CSS styles for a drop zone based on its port position.
 * Each zone covers ~40% of the node edge it's on.
 */
function getZoneStyle(position: PortPosition): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'absolute',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  };
  switch (position) {
    case 'top':
      return { ...base, top: 0, left: '30%', right: '30%', height: '35%', borderRadius: '6px 6px 0 0' };
    case 'bottom':
      return { ...base, bottom: 0, left: '30%', right: '30%', height: '35%', borderRadius: '0 0 6px 6px' };
    case 'left':
      return { ...base, left: 0, top: '30%', bottom: '30%', width: '35%', borderRadius: '6px 0 0 6px' };
    case 'right':
      return { ...base, right: 0, top: '30%', bottom: '30%', width: '35%', borderRadius: '0 6px 6px 0' };
  }
}

interface ConnectionDropZonesProps {
  ports: PortConfig[];
  sourcePortType: string | undefined;
}

/**
 * Overlay rendered on a node when it's the hover target during a connection drag.
 * Shows large labeled drop zones for each port, with compatibility filtering.
 */
export default function ConnectionDropZones({ ports, sourcePortType }: ConnectionDropZonesProps) {
  return (
    <div
      className="absolute inset-0 rounded-lg z-[5]"
      style={{ pointerEvents: 'none' }}
    >
      {ports.map((port) => {
        const isValid = sourcePortType ? canConnect(sourcePortType, port.portType) : true;
        const portColor = getPortColor(port.portType);

        return (
          <div
            key={port.id}
            style={{
              ...getZoneStyle(port.position),
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
                type={getHandleType(port.portType)}
                position={positionMap[port.position]}
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
