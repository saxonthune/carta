import type { PortConfig, PortPosition } from './types';
import { portRegistry } from './portRegistry';

/**
 * Check if two port types can be connected
 * Delegates to the port registry
 */
export function canConnect(sourcePortType: string, targetPortType: string): boolean {
  return portRegistry.canConnect(sourcePortType, targetPortType);
}

/**
 * Get the color for a port type
 * Delegates to the port registry
 */
export function getPortColor(portType: string): string {
  return portRegistry.getColor(portType);
}

/**
 * Default ports for constructs that don't define their own
 * Provides backwards compatibility with existing canvas data
 */
export const DEFAULT_PORTS: PortConfig[] = [
  { id: 'flow-in', portType: 'flow-in', position: 'left', offset: 50, label: 'Flow In' },
  { id: 'flow-out', portType: 'flow-out', position: 'right', offset: 50, label: 'Flow Out' },
];

/**
 * Get ports for a schema, falling back to defaults
 */
export function getPortsForSchema(ports?: PortConfig[]): PortConfig[] {
  if (ports && ports.length > 0) {
    return ports;
  }
  return DEFAULT_PORTS;
}

/**
 * Create a port config from a port type
 */
export function createPortFromType(portTypeId: string, overrides?: Partial<PortConfig>): PortConfig | null {
  const portDef = portRegistry.get(portTypeId);
  if (!portDef) return null;

  return {
    id: portTypeId,
    portType: portTypeId,
    position: portDef.defaultPosition,
    offset: 50,
    label: portDef.label,
    ...overrides,
  };
}

/**
 * Determine React Flow handle type from port type
 * 'target' handles receive connections, 'source' handles initiate them
 */
export function getHandleType(portType: string): 'source' | 'target' {
  // Flow-in and parent are receivers (targets)
  // Flow-out, child, and symmetric are initiators (sources)
  switch (portType) {
    case 'flow-in':
    case 'parent':
      return 'target';
    case 'flow-out':
    case 'child':
    case 'symmetric':
      return 'source';
    default:
      // For unknown port types, default to source
      return 'source';
  }
}

/**
 * Convert port position to React Flow Position enum value
 */
export function portPositionToFlowPosition(position: PortPosition): 'left' | 'right' | 'top' | 'bottom' {
  return position;
}

/**
 * Calculate CSS style for handle positioning based on port config
 */
export function getHandleStyle(position: PortPosition, offset: number): React.CSSProperties {
  const baseStyle: React.CSSProperties = {};

  if (position === 'left' || position === 'right') {
    baseStyle.top = `${offset}%`;
    baseStyle.transform = 'translateY(-50%)';
  } else {
    baseStyle.left = `${offset}%`;
    baseStyle.transform = 'translateX(-50%)';
  }

  return baseStyle;
}
