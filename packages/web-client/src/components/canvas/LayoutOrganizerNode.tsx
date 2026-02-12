import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface LayoutOrganizerNodeData extends Record<string, unknown> {
  name: string;
  color: string;
}

type LayoutOrganizerNodeProps = NodeProps & {
  data: LayoutOrganizerNodeData;
};

// Map directions to handle positions
const DIRECTION_HANDLES = [
  { id: 'N', position: Position.Top, style: { left: '50%', top: 0 } },
  { id: 'NE', position: Position.Top, style: { left: '100%', top: 0 } },
  { id: 'E', position: Position.Right, style: { left: '100%', top: '50%' } },
  { id: 'SE', position: Position.Right, style: { left: '100%', top: '100%' } },
  { id: 'S', position: Position.Bottom, style: { left: '50%', top: '100%' } },
  { id: 'SW', position: Position.Bottom, style: { left: 0, top: '100%' } },
  { id: 'W', position: Position.Left, style: { left: 0, top: '50%' } },
  { id: 'NW', position: Position.Left, style: { left: 0, top: 0 } },
] as const;

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

      {/* Organizer name */}
      <div className="text-sm font-medium text-content px-4 text-center">
        {name}
      </div>

      {/* 8 directional source handles */}
      {DIRECTION_HANDLES.map(({ id, position, style }) => (
        <Handle
          key={id}
          type="source"
          position={position}
          id={id}
          style={{
            ...style,
            width: 8,
            height: 8,
            backgroundColor: color || 'var(--color-border)',
            border: '1px solid var(--color-surface)',
            borderRadius: '50%',
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  );
});

LayoutOrganizerNode.displayName = 'LayoutOrganizerNode';

export default LayoutOrganizerNode;
