import React from 'react';

export interface EdgeLabelProps {
  /** Center X position in canvas coordinates */
  x: number;
  /** Center Y position in canvas coordinates */
  y: number;
  /** Content to render inside the label pill */
  children: React.ReactNode;
  /** Additional CSS classes on the pill container */
  className?: string;
  /** Additional inline styles on the pill container */
  style?: React.CSSProperties;
  /** Context menu handler — makes the label interactive */
  onContextMenu?: (event: React.MouseEvent) => void;
}

export function EdgeLabel({
  x,
  y,
  children,
  className,
  style,
  onContextMenu,
}: EdgeLabelProps): React.ReactElement {
  // foreignObject needs explicit width/height. Use a large value and let
  // the inner div shrink-wrap via width: fit-content. The overflow is hidden
  // by the foreignObject, so we center the inner div with flexbox.
  const foWidth = 400;
  const foHeight = 60;

  return (
    <foreignObject
      x={x - foWidth / 2}
      y={y - foHeight / 2}
      width={foWidth}
      height={foHeight}
      style={{ overflow: 'visible', pointerEvents: 'none' }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <div
          className={className}
          style={{
            pointerEvents: onContextMenu ? 'auto' : 'none',
            cursor: onContextMenu ? 'context-menu' : undefined,
            borderRadius: 9999,
            paddingLeft: 8,
            paddingRight: 8,
            paddingTop: 2,
            paddingBottom: 2,
            backgroundColor: 'color-mix(in srgb, var(--color-surface) 85%, transparent)',
            backdropFilter: 'blur(4px)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            ...style,
          }}
          onContextMenu={onContextMenu}
        >
          {children}
        </div>
      </div>
    </foreignObject>
  );
}
