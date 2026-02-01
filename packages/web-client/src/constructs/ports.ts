import type { PortPosition } from '@carta/domain';

// Domain-level port helpers are now in @carta/domain
// This file only contains React-specific utilities

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
