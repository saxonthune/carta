import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
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

export interface LayoutOrganizerNodeData extends Record<string, unknown> {
  name: string;
  color: string;
}

type LayoutOrganizerNodeProps = NodeProps & {
  data: LayoutOrganizerNodeData;
};

// Map directions to handle positions and icons
const DIRECTION_HANDLES = [
  { id: 'N', position: Position.Top, style: { left: '50%', top: 0 }, Icon: ArrowUp },
  { id: 'NE', position: Position.Top, style: { left: '100%', top: 0 }, Icon: ArrowUpRight },
  { id: 'E', position: Position.Right, style: { left: '100%', top: '50%' }, Icon: ArrowRight },
  { id: 'SE', position: Position.Right, style: { left: '100%', top: '100%' }, Icon: ArrowDownRight },
  { id: 'S', position: Position.Bottom, style: { left: '50%', top: '100%' }, Icon: ArrowDown },
  { id: 'SW', position: Position.Bottom, style: { left: 0, top: '100%' }, Icon: ArrowDownLeft },
  { id: 'W', position: Position.Left, style: { left: 0, top: '50%' }, Icon: ArrowLeft },
  { id: 'NW', position: Position.Left, style: { left: 0, top: 0 }, Icon: ArrowUpLeft },
];

const LayoutOrganizerNode = memo((props: LayoutOrganizerNodeProps) => {
  const { data } = props;
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
      {/* Body target handle - invisible, covers entire node */}
      <Handle
        type="target"
        position={Position.Top}
        id="body"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          opacity: 0,
          transform: 'none',
          border: 'none',
          background: 'transparent',
        }}
      />

      {/* Drag bar */}
      <div
        className="drag-handle absolute rounded-full cursor-grab active:cursor-grabbing"
        style={{
          top: 8,
          left: '20%',
          width: '60%',
          height: 6,
          backgroundColor: color
            ? `color-mix(in srgb, ${color} 30%, var(--color-canvas))`
            : 'var(--color-border)',
        }}
      />

      {/* Organizer name */}
      <div className="text-sm font-medium text-content px-4 text-center">
        {name}
      </div>

      {/* 8 directional source handles */}
      {DIRECTION_HANDLES.map(({ id, position, style, Icon }) => (
        <Handle
          key={id}
          type="source"
          position={position}
          id={id}
          style={{
            ...style,
            width: 14,
            height: 14,
            backgroundColor: 'var(--color-accent)',
            border: '2px solid var(--color-surface)',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={8} weight="bold" color="var(--color-surface)" style={{ pointerEvents: 'none' }} />
        </Handle>
      ))}
    </div>
  );
});

LayoutOrganizerNode.displayName = 'LayoutOrganizerNode';

export default LayoutOrganizerNode;
