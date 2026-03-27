import React from 'react';

export interface FileContainerProps {
  /** Filename displayed in the tab (e.g., "employee-types.md", "doc02.03") */
  filename: string;
  /** Whether this container is selected on the canvas */
  selected?: boolean;
  /** Structure editor(s) rendered inside the container body */
  children: React.ReactNode;
  /** Additional CSS class on the outer wrapper */
  className?: string;
  /** Additional inline style for positioning (left, top — set by canvas parent) */
  style?: React.CSSProperties;
  /** Pointer down handler for canvas drag integration */
  onPointerDown?: (e: React.PointerEvent) => void;
  /** Context menu handler */
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function FileContainer({
  filename,
  selected,
  children,
  className,
  style,
  onPointerDown,
  onContextMenu,
}: FileContainerProps): React.ReactElement {
  return (
    <div
      data-no-pan="true"
      className={`absolute${className ? ` ${className}` : ''}`}
      style={style}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
    >
      {/* Filename tab */}
      <div className="inline-block bg-surface-depth-2 rounded-t-md px-3 py-1">
        <span className="text-2xs font-medium text-content-muted">{filename}</span>
      </div>
      {/* Container body */}
      <div
        className={`bg-surface rounded-b-lg rounded-tr-lg divide-y divide-subtle${selected ? ' ring-2 ring-accent/30 shadow-lg' : ' shadow-md'}`}
      >
        {children}
      </div>
    </div>
  );
}
