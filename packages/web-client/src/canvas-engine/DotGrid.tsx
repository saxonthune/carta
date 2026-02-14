import React from 'react';
import type { Transform } from './useViewport.js';

export interface DotGridProps {
  transform: Transform;
  /** Unique pattern ID — must be unique per page if multiple grids coexist */
  patternId?: string;
  /** Grid spacing in canvas units (default 16) */
  spacing?: number;
  /** Dot radius in canvas units (default 1) */
  dotRadius?: number;
  /** Dot fill color (default 'var(--color-dot-grid)') */
  dotColor?: string;
  /** Background fill — set to 'transparent' for no bg, or any CSS color */
  backgroundColor?: string;
}

export function DotGrid({
  transform,
  patternId = 'dot-grid',
  spacing = 16,
  dotRadius = 1,
  dotColor = 'var(--color-dot-grid)',
  backgroundColor = 'transparent',
}: DotGridProps): React.ReactElement {
  return (
    <svg
      width="100%"
      height="100%"
      style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
    >
      <defs>
        <pattern
          id={patternId}
          width={spacing}
          height={spacing}
          patternUnits="userSpaceOnUse"
          patternTransform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})`}
        >
          <circle cx={dotRadius} cy={dotRadius} r={dotRadius} fill={dotColor} />
        </pattern>
      </defs>
      {backgroundColor !== 'transparent' && (
        <rect width="100%" height="100%" fill={backgroundColor} />
      )}
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
