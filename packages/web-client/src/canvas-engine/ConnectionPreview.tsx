import React from 'react';

export interface ConnectionPreviewProps {
  /** SVG path data string (the `d` attribute) */
  d: string;
  /** Stroke color (default 'var(--color-accent)') */
  stroke?: string;
  /** Stroke width (default 2) */
  strokeWidth?: number;
  /** Dash pattern (default '4 4') — set to 'none' for solid */
  strokeDasharray?: string;
}

export function ConnectionPreview({
  d,
  stroke = 'var(--color-accent)',
  strokeWidth = 2,
  strokeDasharray = '4 4',
}: ConnectionPreviewProps): React.ReactElement {
  return (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeDasharray={strokeDasharray === 'none' ? undefined : strokeDasharray}
      style={{ pointerEvents: 'none' }}
    />
  );
}
