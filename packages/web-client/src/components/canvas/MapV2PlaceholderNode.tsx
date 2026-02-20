interface MapV2PlaceholderNodeProps {
  node: any;
  absX: number;
  absY: number;
  width: number;
  height: number;
  selected: boolean;
  constructType: string;
  semanticId: string | undefined;
  dimmed: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
}

export default function MapV2PlaceholderNode(props: MapV2PlaceholderNodeProps) {
  const { node, absX, absY, width, height, selected, constructType, semanticId, dimmed, onPointerDown, onContextMenu } = props;
  return (
    <div
      data-node-id={node.id}
      data-no-pan="true"
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      style={{
        position: 'absolute',
        left: absX,
        top: absY,
        width,
        height,
        border: '2px dashed var(--color-border)',
        borderRadius: 8,
        backgroundColor: 'color-mix(in srgb, var(--color-surface-alt) 50%, transparent)',
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'var(--node-shadow)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        cursor: 'grab',
        opacity: dimmed ? 0.2 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
        overflow: 'hidden',
      }}
    >
      <span style={{ fontSize: 16, color: 'var(--color-warning, #d97706)' }}>⚠</span>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-content)', textAlign: 'center', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
        {constructType}
      </span>
      {semanticId && (
        <span style={{ fontSize: 10, color: 'var(--color-content-subtle)', textAlign: 'center', padding: '0 8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
          {semanticId}
        </span>
      )}
    </div>
  );
}
