import React from 'react';
import type { Transform } from './useViewport.js';

export interface CrossGridProps {
  transform: Transform;
  patternId?: string;
  spacing?: number;
  strokeColor?: string;
  strokeWidth?: number;
  crossSize?: number;
  backgroundColor?: string;
  rotation?: number;
}

export function CrossGrid({
  transform,
  patternId = 'cross-grid',
  spacing = 40,
  strokeColor = 'var(--color-dot-grid)',
  strokeWidth = 1.2,
  crossSize = 18,
  backgroundColor = 'transparent',
  rotation = 0,
}: CrossGridProps): React.ReactElement {
  const half = crossSize / 2;
  const c1 = spacing * 0.25; // center of first cross
  const c2 = spacing * 0.75; // center of second cross (offset)

  const rotateStr = rotation ? ` rotate(${rotation})` : '';

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
          patternTransform={`translate(${transform.x}, ${transform.y}) scale(${transform.k})${rotateStr}`}
        >
          {/* Cross at top-left quadrant */}
          <line x1={c1} y1={c1 - half} x2={c1} y2={c1 + half}
                stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" opacity="0.15" />
          <line x1={c1 - half} y1={c1} x2={c1 + half} y2={c1}
                stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" opacity="0.15" />
          {/* Cross at bottom-right quadrant */}
          <line x1={c2} y1={c2 - half} x2={c2} y2={c2 + half}
                stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" opacity="0.15" />
          <line x1={c2 - half} y1={c2} x2={c2 + half} y2={c2}
                stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" opacity="0.15" />
        </pattern>
      </defs>
      {backgroundColor !== 'transparent' && (
        <rect width="100%" height="100%" fill={backgroundColor} />
      )}
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
}
