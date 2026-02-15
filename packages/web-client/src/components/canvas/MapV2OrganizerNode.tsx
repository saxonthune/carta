import { PushPin, DotsThreeVertical } from '@phosphor-icons/react';
import { EyeIcon, EyeOffIcon } from '../ui/icons';

export interface OrganizerChromeProps {
  renamingOrgId: string | null;
  renameValue: string;
  setRenameValue: (v: string) => void;
  setRenamingOrgId: (v: string | null) => void;
  handleOrgRename: (orgId: string) => void;
  commitOrgRename: (orgId: string) => void;
  colorTriggerRefs: React.MutableRefObject<Map<string, HTMLDivElement>>;
  layoutTriggerRefs: React.MutableRefObject<Map<string, HTMLButtonElement>>;
  setColorPickerOrgId: (v: string | null | ((prev: string | null) => string | null)) => void;
  setLayoutMenuOrgId: (v: string | null | ((prev: string | null) => string | null)) => void;
}

export interface MapV2OrganizerNodeProps {
  node: any;
  absX: number;
  absY: number;
  width: number;
  height: number;
  selected: boolean;
  collapsed: boolean;
  label: string;
  color: string;
  dimmed: boolean;
  childCount: number;
  layoutPinned: boolean;
  // Interaction handlers
  onPointerDown: (e: React.PointerEvent) => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDoubleClick: (e: React.MouseEvent) => void;
  onResizePointerDown: (e: React.PointerEvent) => void;
  // Chrome
  chrome: OrganizerChromeProps;
}

export function MapV2OrganizerNode({
  node,
  absX,
  absY,
  width,
  height,
  selected,
  collapsed,
  label,
  color,
  dimmed,
  childCount,
  layoutPinned,
  onPointerDown,
  onContextMenu,
  onDoubleClick,
  onResizePointerDown,
  chrome,
}: MapV2OrganizerNodeProps) {
  const {
    renamingOrgId,
    renameValue,
    setRenameValue,
    setRenamingOrgId,
    handleOrgRename,
    commitOrgRename,
    colorTriggerRefs,
    layoutTriggerRefs,
    setColorPickerOrgId,
    setLayoutMenuOrgId,
  } = chrome;

  // Collapsed organizer chip
  if (collapsed) {
    return (
      <div
        key={node.id}
        data-node-id={node.id}
        data-no-pan="true"
        onPointerDown={onPointerDown}
        onContextMenu={onContextMenu}
        style={{
          position: 'absolute', left: absX, top: absY,
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '6px 12px', minWidth: 140, height: 44,
          backgroundColor: `color-mix(in srgb, ${color} 12%, var(--color-canvas))`,
          border: `1px solid color-mix(in srgb, ${color} 30%, var(--color-canvas))`,
          borderRadius: 8,
          boxShadow: selected ? `0 0 0 2px ${color}30` : '0 1px 3px rgba(0,0,0,0.08)',
          cursor: 'grab',
          outline: selected ? '2px solid var(--color-accent, #3b82f6)' : 'none',
          outlineOffset: '2px',
          opacity: dimmed ? 0.2 : 1,
        }}
      >
        {/* Color dot */}
        <div
          ref={(el) => { if (el) colorTriggerRefs.current.set(node.id, el); }}
          style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, flexShrink: 0, cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            setColorPickerOrgId(prev => prev === node.id ? null : node.id);
          }}
        />
        {/* Name / rename input */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {renamingOrgId === node.id ? (
            <input
              autoFocus
              style={{
                width: '100%', background: 'transparent', border: 'none',
                outline: 'none', padding: 0, fontSize: 11, fontWeight: 500,
                color: 'var(--color-content)',
              }}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => commitOrgRename(node.id)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') commitOrgRename(node.id);
                if (e.key === 'Escape') setRenamingOrgId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-content)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'text' }}
              onClick={(e) => { e.stopPropagation(); handleOrgRename(node.id); }}
            >
              {label}
            </span>
          )}
        </div>
        {/* Count */}
        {childCount > 0 && (
          <span style={{ fontSize: 10, fontWeight: 500, padding: '1px 6px', borderRadius: 10, backgroundColor: `color-mix(in srgb, ${color} 20%, var(--color-canvas))`, color: `color-mix(in srgb, ${color} 80%, var(--color-content))` }}>
            {childCount}
          </span>
        )}
        {/* Pin indicator */}
        {layoutPinned && (
          <PushPin weight="fill" size={12} style={{ color, opacity: 0.5, flexShrink: 0 }} />
        )}
        {/* Expand button */}
        <button
          style={{ width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--color-content-muted)' }}
          onClick={onDoubleClick as any}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <EyeOffIcon size={14} />
        </button>
      </div>
    );
  }

  // Expanded organizer
  return (
    <div
      key={node.id}
      data-node-id={node.id}
      data-no-pan="true"
      data-drop-target="true"
      data-container-id={node.id}
      onPointerDown={onPointerDown}
      onContextMenu={onContextMenu}
      onDoubleClick={onDoubleClick}
      style={{
        position: 'absolute',
        left: absX,
        top: absY,
        width,
        height,
        backgroundColor: `color-mix(in srgb, ${color} 18%, var(--color-canvas))`,
        border: `1px solid color-mix(in srgb, ${color} 35%, var(--color-canvas))`,
        borderLeft: 'none',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        display: 'flex',
        flexDirection: 'column',
        color,
        fontSize: 12,
        fontWeight: 500,
        overflow: 'hidden',
        cursor: 'grab',
        opacity: dimmed ? 0.2 : 1,
        pointerEvents: dimmed ? 'none' : 'auto',
        transition: 'opacity 150ms ease',
      }}
    >
      {/* Organizer header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: '8px 8px 0 0',
          backgroundColor: `${color}15`,
          cursor: 'grab',
        }}
        data-no-pan="true"
      >
        {/* Color dot */}
        <div
          ref={(el) => { if (el) colorTriggerRefs.current.set(node.id, el); }}
          style={{
            width: 10, height: 10, borderRadius: '50%',
            backgroundColor: color, cursor: 'pointer', flexShrink: 0,
          }}
          onClick={(e) => {
            e.stopPropagation();
            setColorPickerOrgId(prev => prev === node.id ? null : node.id);
          }}
        />

        {/* Name / rename input */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {renamingOrgId === node.id ? (
            <input
              autoFocus
              style={{
                width: '100%', background: 'transparent', border: 'none',
                outline: 'none', padding: 0, fontSize: 11, fontWeight: 500,
                color: 'var(--color-content)',
              }}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => commitOrgRename(node.id)}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === 'Enter') commitOrgRename(node.id);
                if (e.key === 'Escape') setRenamingOrgId(null);
              }}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              style={{
                fontSize: 11, fontWeight: 500, cursor: 'text',
                color: 'var(--color-content)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                display: 'block',
              }}
              onClick={(e) => { e.stopPropagation(); handleOrgRename(node.id); }}
            >
              {label}
            </span>
          )}
        </div>

        {/* Child count badge */}
        {childCount > 0 && (
          <span style={{
            fontSize: 10, fontWeight: 500, padding: '1px 6px',
            borderRadius: 10, flexShrink: 0,
            backgroundColor: `color-mix(in srgb, ${color} 20%, var(--color-canvas))`,
            color: `color-mix(in srgb, ${color} 80%, var(--color-content))`,
          }}>
            {childCount}
          </span>
        )}

        {/* Pin indicator */}
        {layoutPinned && (
          <PushPin weight="fill" size={12} style={{ color, opacity: 0.5, flexShrink: 0 }} />
        )}

        {/* Layout menu button */}
        <button
          ref={(el) => { if (el) layoutTriggerRefs.current.set(node.id, el); }}
          style={{
            width: 20, height: 20, display: 'flex', alignItems: 'center',
            justifyContent: 'center', borderRadius: 4, border: 'none',
            background: 'transparent', cursor: 'pointer', flexShrink: 0,
            color: 'var(--color-content-muted)',
          }}
          onClick={(e) => {
            e.stopPropagation();
            setLayoutMenuOrgId(prev => prev === node.id ? null : node.id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <DotsThreeVertical weight="bold" size={14} />
        </button>

        {/* Collapse toggle */}
        <button
          style={{
            width: 20, height: 20, display: 'flex', alignItems: 'center',
            justifyContent: 'center', borderRadius: 4, border: 'none',
            background: 'transparent', cursor: 'pointer', flexShrink: 0,
            color: 'var(--color-content-muted)',
          }}
          onClick={onDoubleClick as any}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <EyeIcon size={14} />
        </button>
      </div>
      {/* Spacer for organizer body content area */}
      <div style={{ flex: 1 }} />

      {/* Resize handle */}
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: 12,
          height: 12,
          cursor: 'se-resize',
          backgroundColor: color,
          opacity: 0.5,
        }}
        onPointerDown={onResizePointerDown}
      />
    </div>
  );
}
