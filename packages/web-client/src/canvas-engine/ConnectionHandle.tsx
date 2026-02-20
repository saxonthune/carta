import React, { useRef } from 'react';

export interface ConnectionHandleProps {
  type: 'source' | 'target';
  id: string;
  nodeId: string;
  style?: React.CSSProperties;
  className?: string;
  children?: React.ReactNode;
  onStartConnection?: (nodeId: string, handleId: string, clientX: number, clientY: number) => void;
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
  const elRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (type === 'source' && onStartConnection) {
      event.stopPropagation();
      // Anchor the connection line at the right-edge midpoint of this element
      if (elRef.current) {
        const rect = elRef.current.getBoundingClientRect();
        onStartConnection(nodeId, id, rect.right, rect.top + rect.height / 2);
      } else {
        onStartConnection(nodeId, id, event.clientX, event.clientY);
      }
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
      ref={elRef}
      style={style}
      className={className}
      onPointerDown={type === 'source' ? handlePointerDown : undefined}
      {...dataAttributes}
    >
      {children}
    </div>
  );
}
