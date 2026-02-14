import React from 'react';

export interface ConnectionHandleProps {
  type: 'source' | 'target';
  id: string;
  nodeId: string;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  onStartConnection?: (nodeId: string, handleId: string, event: React.PointerEvent) => void;
}

export function ConnectionHandle({
  type,
  id,
  nodeId,
  style,
  className,
  children,
  onStartConnection,
}: ConnectionHandleProps): React.ReactElement {
  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (type === 'source' && onStartConnection) {
      event.stopPropagation();
      onStartConnection(nodeId, id, event);
    }
  };

  const dataAttributes =
    type === 'target'
      ? {
          'data-connection-target': 'true',
          'data-node-id': nodeId,
          'data-handle-id': id,
        }
      : {
          'data-no-pan': 'true',
        };

  return (
    <div
      style={style}
      className={className}
      onPointerDown={type === 'source' ? handlePointerDown : undefined}
      {...dataAttributes}
    >
      {children}
    </div>
  );
}
