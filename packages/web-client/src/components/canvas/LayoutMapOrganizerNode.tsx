import { memo } from 'react';
import {
  ArrowUp,
  ArrowUpRight,
  ArrowRight,
  ArrowDownRight,
  ArrowDown,
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpLeft,
} from '@phosphor-icons/react';
import { ConnectionHandle } from '../../canvas-engine/index.js';

export interface LayoutMapOrganizerNodeData {
  name: string;
  color: string;
}

interface LayoutMapOrganizerNodeProps {
  id: string;
  data: LayoutMapOrganizerNodeData;
  onStartConnection: (nodeId: string, handleId: string, event: React.PointerEvent) => void;
}

// Map directions to handle positions and icons
const DIRECTION_HANDLES = [
  { id: 'N', style: { left: '50%', top: 0 }, Icon: ArrowUp },
  { id: 'NE', style: { left: '100%', top: 0 }, Icon: ArrowUpRight },
  { id: 'E', style: { left: '100%', top: '50%' }, Icon: ArrowRight },
  { id: 'SE', style: { left: '100%', top: '100%' }, Icon: ArrowDownRight },
  { id: 'S', style: { left: '50%', top: '100%' }, Icon: ArrowDown },
  { id: 'SW', style: { left: 0, top: '100%' }, Icon: ArrowDownLeft },
  { id: 'W', style: { left: 0, top: '50%' }, Icon: ArrowLeft },
  { id: 'NW', style: { left: 0, top: 0 }, Icon: ArrowUpLeft },
];

const LayoutMapOrganizerNode = memo((props: LayoutMapOrganizerNodeProps) => {
  const { id, data, onStartConnection } = props;
  const { name, color } = data;

  // Use the color with similar mix to real organizers (subtle background)
  const backgroundColor = color
    ? `color-mix(in srgb, ${color} 8%, var(--color-canvas))`
    : 'var(--color-surface)';
  const borderColor = color || 'var(--color-border)';

  return (
    <div
      className="relative rounded-lg border-2 flex items-center justify-center"
      style={{
        width: '100%',
        height: '100%',
        backgroundColor,
        borderColor,
      }}
    >
      {/* Drag bar */}
      <div
        className="drag-handle absolute rounded-full cursor-grab active:cursor-grabbing"
        style={{
          top: 8,
          left: '20%',
          width: '60%',
          height: 6,
          zIndex: 1,
          backgroundColor: color
            ? `color-mix(in srgb, ${color} 30%, var(--color-canvas))`
            : 'var(--color-border)',
        }}
      />

      {/* Organizer name */}
      <div className="text-sm font-medium text-content px-4 text-center">
        {name}
      </div>

      {/* Body target handle - invisible, covers entire node for connection drop.
          z-index 0 so source handles (z-index 1) stack on top and receive
          pointer events first. elementsFromPoint still finds this on drop. */}
      <ConnectionHandle
        type="target"
        id="body"
        nodeId={id}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          zIndex: 0,
        }}
      />

      {/* 8 directional source handles */}
      {DIRECTION_HANDLES.map(({ id: handleId, style, Icon }) => (
        <ConnectionHandle
          key={handleId}
          type="source"
          id={handleId}
          nodeId={id}
          onStartConnection={onStartConnection}
          style={{
            ...style,
            position: 'absolute',
            zIndex: 1,
            width: 14,
            height: 14,
            backgroundColor: 'var(--color-accent)',
            border: '2px solid var(--color-surface)',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'crosshair',
          }}
        >
          <Icon size={8} weight="bold" color="var(--color-surface)" style={{ pointerEvents: 'none' }} />
        </ConnectionHandle>
      ))}
    </div>
  );
});

LayoutMapOrganizerNode.displayName = 'LayoutMapOrganizerNode';

export default LayoutMapOrganizerNode;
