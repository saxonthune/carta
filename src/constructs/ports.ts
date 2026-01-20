import type { PortConfig, PortDirection, PortPosition } from './types';

/**
 * Port type definition for the port registry
 */
export interface PortTypeDefinition {
  id: string;
  direction: PortDirection;
  defaultPosition: PortPosition;
  label: string;
  color: string;
}

/**
 * Built-in port types that can be used by any construct
 */
export const BUILT_IN_PORTS: PortTypeDefinition[] = [
  { id: 'flow-in', direction: 'in', defaultPosition: 'left', label: 'Flow In', color: '#3b82f6' },
  { id: 'flow-out', direction: 'out', defaultPosition: 'right', label: 'Flow Out', color: '#22c55e' },
  { id: 'parent', direction: 'parent', defaultPosition: 'top', label: 'Parent', color: '#f59e0b' },
  { id: 'child', direction: 'child', defaultPosition: 'bottom', label: 'Children', color: '#f59e0b' },
  { id: 'link', direction: 'bidi', defaultPosition: 'right', label: 'Link', color: '#8b5cf6' },
];

/**
 * Valid connection pairings between port directions
 * [source direction, target direction]
 */
export const VALID_PAIRINGS: [PortDirection, PortDirection][] = [
  ['out', 'in'],
  ['child', 'parent'],
  ['bidi', 'bidi'],
  ['bidi', 'in'],
  ['out', 'bidi'],
];

/**
 * Check if two port directions can be connected
 */
export function canConnect(sourceDirection: PortDirection, targetDirection: PortDirection): boolean {
  return VALID_PAIRINGS.some(
    ([src, tgt]) =>
      (src === sourceDirection && tgt === targetDirection) ||
      (src === targetDirection && tgt === sourceDirection)
  );
}

/**
 * Get the color for a port direction
 */
export function getPortColor(direction: PortDirection): string {
  switch (direction) {
    case 'in': return '#3b82f6';    // Blue
    case 'out': return '#22c55e';   // Green
    case 'parent': return '#f59e0b'; // Amber
    case 'child': return '#f59e0b';  // Amber
    case 'bidi': return '#8b5cf6';   // Purple
    default: return '#6b7280';       // Gray
  }
}

/**
 * Default ports for constructs that don't define their own
 * Provides backwards compatibility with existing canvas data
 */
export const DEFAULT_PORTS: PortConfig[] = [
  { id: 'flow-in', direction: 'in', position: 'left', offset: 50, label: 'Flow In' },
  { id: 'flow-out', direction: 'out', position: 'right', offset: 50, label: 'Flow Out' },
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
 * Create a port config from a built-in port type
 */
export function createPortFromType(typeId: string, overrides?: Partial<PortConfig>): PortConfig | null {
  const portType = BUILT_IN_PORTS.find(p => p.id === typeId);
  if (!portType) return null;

  return {
    id: portType.id,
    direction: portType.direction,
    position: portType.defaultPosition,
    offset: 50,
    label: portType.label,
    ...overrides,
  };
}

/**
 * Determine React Flow handle type from port direction
 * 'target' handles receive connections, 'source' handles initiate them
 */
export function getHandleType(direction: PortDirection): 'source' | 'target' {
  switch (direction) {
    case 'in':
    case 'parent':
      return 'target';
    case 'out':
    case 'child':
      return 'source';
    case 'bidi':
      // Bidi ports can be both - we'll use source but allow connections to them
      return 'source';
    default:
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
