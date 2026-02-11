import { memo, useCallback, useMemo, useState, useRef, useEffect } from 'react';
import { Handle, Position, NodeResizer, useNodeId, type NodeProps } from '@xyflow/react';
import { EyeIcon, EyeOffIcon } from '../ui/icons';
import { Tooltip } from '../ui';
import type { OrganizerNodeData as BaseOrganizerNodeData } from '@carta/domain';
import type { NodeActions } from './nodeActions';

// Organizer color palette
const ORGANIZER_COLORS = ['#7c3aed', '#0891b2', '#059669', '#d97706', '#dc2626', '#6366f1', '#ec4899'];

/**
 * Extended data interface with callbacks added by Map.tsx.
 * Also used by the metamap with optional canvas-specific fields.
 */
export interface OrganizerNodeData extends BaseOrganizerNodeData {
  childCount: number;
  isDropTarget?: boolean;
  isHovered?: boolean;
  isDimmed?: boolean;
  nodeActions?: NodeActions;

  // Metamap-specific optional fields
  depth?: number;
  parentGroupName?: string;
  groupId?: string;
}

type OrganizerNodeProps = NodeProps & {
  data: OrganizerNodeData;
};

/**
 * Organizer node using React Flow's native parentId system.
 * Organizers are regular nodes with type='organizer'.
 * Members use parentId for relative positioning and group movement.
 */
function OrganizerNode({ data, selected }: OrganizerNodeProps) {
  const nodeId = useNodeId();
  const {
    name,
    color = '#6b7280',
    collapsed,
    childCount,
    isDropTarget,
    isHovered,
    isDimmed,
    nodeActions,
    depth = 0,
    parentGroupName,
  } = data;

  const [showColorPicker, setShowColorPicker] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);
  const layoutMenuRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (nodeId && nodeActions) nodeActions.onToggleCollapse(nodeId);
    },
    [nodeActions, nodeId]
  );

  const handleColorClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowColorPicker(prev => !prev);
  }, []);

  const handleColorSelect = useCallback((newColor: string) => {
    if (nodeId && nodeActions) {
      nodeActions.onUpdateOrganizerColor(nodeId, newColor);
      setShowColorPicker(false);
    }
  }, [nodeId, nodeActions]);

  const handleLayoutMenuClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setShowLayoutMenu(prev => !prev);
  }, []);

  // Close color picker on outside click
  useEffect(() => {
    if (!showColorPicker) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setShowColorPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColorPicker]);

  // Close layout menu on outside click
  useEffect(() => {
    if (!showLayoutMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (layoutMenuRef.current && !layoutMenuRef.current.contains(e.target as Node)) {
        setShowLayoutMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showLayoutMenu]);

  // Layout menu items configuration
  const layoutMenuItems = useMemo(() => {
    if (!nodeActions || childCount <= 1) return null;

    return [
      {
        label: 'Spread apart',
        handler: nodeActions.onSpreadChildren,
        icon: (
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        ),
      },
      {
        label: 'Arrange as flow',
        handler: nodeActions.onFlowLayoutChildren,
        icon: (
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
            <line x1="3" y1="6" x2="15" y2="6" />
            <polyline points="12 3 15 6 12 9" />
            <line x1="3" y1="12" x2="15" y2="12" />
            <polyline points="12 9 15 12 12 15" />
            <line x1="3" y1="18" x2="15" y2="18" />
            <polyline points="12 15 15 18 12 21" />
          </svg>
        ),
      },
      {
        label: 'Arrange as grid',
        handler: nodeActions.onGridLayoutChildren,
        icon: (
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        ),
      },
      {
        label: 'Fit to contents',
        handler: nodeActions.onFitToChildren,
        icon: (
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth={2}>
            <polyline points="4 14 4 20 10 20" />
            <polyline points="20 10 20 4 14 4" />
            <line x1="14" y1="10" x2="20" y2="4" />
            <line x1="4" y1="20" x2="10" y2="14" />
          </svg>
        ),
      },
    ];
  }, [nodeActions, childCount]);

  // Increased base color mix for better visibility; deeper nesting = stronger tint
  const bgMix = isHovered || isDropTarget ? 25 : 18 + depth * 4;
  const borderMix = isHovered || isDropTarget ? 45 : 35 + depth * 8;

  // Collapsed chip rendering (180x44 pill)
  if (collapsed) {
    return (
      <div
        className="transition-all duration-200 cursor-pointer"
        style={{
          opacity: isDimmed ? 0.2 : 1,
          pointerEvents: isDimmed ? 'none' : 'auto',
        }}
      >
        {/* Hidden handles for edge connections to collapsed organizers */}
        <Handle
          id="group-connect"
          type="source"
          position={Position.Right}
          className="!w-0 !h-0 !border-0 !bg-transparent !min-w-0 !min-h-0"
          style={{ right: 0, top: '50%' }}
        />
        <Handle
          id="group-connect"
          type="target"
          position={Position.Left}
          className="!w-0 !h-0 !border-0 !bg-transparent !min-w-0 !min-h-0"
          style={{ left: 0, top: '50%' }}
        />
        <div
          className="node-drag-handle flex items-center gap-2 px-3 py-2 rounded-lg select-none"
          style={{
            backgroundColor: `color-mix(in srgb, ${color} ${isHovered || isDropTarget ? 25 : 12}%, var(--color-canvas))`,
            border: `1px solid color-mix(in srgb, ${color} ${isHovered || isDropTarget ? 50 : 30}%, var(--color-canvas))`,
            boxShadow: isDropTarget
              ? `0 0 0 3px ${color}60, 0 0 20px ${color}35`
              : isHovered
                ? `0 0 0 3px ${color}40, 0 0 16px ${color}25`
                : selected
                  ? `0 0 0 2px ${color}30`
                  : '0 1px 3px rgba(0,0,0,0.08)',
            minWidth: 140,
            height: 44,
          }}
        >
          <div className="relative">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${nodeActions ? 'cursor-pointer' : ''}`}
              style={{ backgroundColor: color }}
              onClick={nodeActions ? handleColorClick : undefined}
            />
            {/* Color picker popover for collapsed */}
            {showColorPicker && nodeActions && (
              <div
                ref={colorPickerRef}
                className="absolute top-full left-0 mt-1 z-50 p-2 rounded-lg shadow-lg flex gap-1.5"
                style={{
                  backgroundColor: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {ORGANIZER_COLORS.map(c => (
                  <button
                    key={c}
                    className="w-5 h-5 rounded-full border-2 border-transparent hover:border-white transition-all"
                    style={{ backgroundColor: c }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleColorSelect(c);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <span className="text-node-xs font-medium text-content truncate text-halo flex-1">
            {name}
          </span>
          {childCount > 0 && (
            <span
              className="text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `color-mix(in srgb, ${color} 20%, var(--color-canvas))`,
                color: `color-mix(in srgb, ${color} 80%, var(--color-content))`,
              }}
            >
              {childCount}
            </span>
          )}
          {/* Eyeball toggle button (canvas only) */}
          {nodeActions && (
            <Tooltip content="Expand organizer">
              <button
                className="w-5 h-5 flex items-center justify-center rounded text-content-muted hover:text-content transition-colors shrink-0"
                onClick={handleToggle}
                title="Expand organizer"
              >
                <EyeOffIcon size={14} />
              </button>
            </Tooltip>
          )}
        </div>
      </div>
    );
  }

  // Expanded rendering - container with rounded border, resizable
  return (
    <div
      style={{
        opacity: isDimmed ? 0.2 : 1,
        pointerEvents: isDimmed ? 'none' : 'auto',
      }}
      className="transition-opacity duration-200 w-full h-full"
    >
      {/* Invisible handles for edge anchoring (wagon attachment edges, etc.) */}
      <Handle
        id="group-connect"
        type="source"
        position={Position.Right}
        className="!w-0 !h-0 !border-0 !bg-transparent !min-w-0 !min-h-0"
        style={{ right: 0, top: '50%' }}
      />
      <Handle
        id="group-connect"
        type="target"
        position={Position.Left}
        className="!w-0 !h-0 !border-0 !bg-transparent !min-w-0 !min-h-0"
        style={{ left: 0, top: '50%' }}
      />
      <NodeResizer
        isVisible={selected}
        minWidth={200}
        minHeight={120}
        lineStyle={{ borderColor: `${color}40` }}
        handleStyle={{
          backgroundColor: color,
          width: 8,
          height: 8,
          borderRadius: 4,
        }}
      />
      <div
        className="relative min-w-[200px] min-h-[120px] h-full rounded-xl transition-all duration-200"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} ${bgMix}%, var(--color-canvas))`,
          border: `1px solid color-mix(in srgb, ${color} ${borderMix}%, var(--color-canvas))`,
          boxShadow: isDropTarget
            ? `0 0 0 3px ${color}60, 0 0 20px ${color}35`
            : isHovered
              ? `0 0 0 3px ${color}40, 0 0 16px ${color}25`
              : '0 1px 3px rgba(0,0,0,0.04)',
        }}
      >
        {/* Header */}
        <div
          className="node-drag-handle flex items-center gap-2 px-3 py-2 rounded-t-xl cursor-grab"
          style={{ backgroundColor: `${color}15` }}
        >
          <div className="relative">
            <div
              className={`w-2.5 h-2.5 rounded-full shrink-0 ${nodeActions ? 'cursor-pointer' : ''}`}
              style={{ backgroundColor: color }}
              onClick={nodeActions ? handleColorClick : undefined}
            />
            {/* Color picker popover for expanded */}
            {showColorPicker && nodeActions && (
              <div
                ref={colorPickerRef}
                className="absolute top-full left-0 mt-1 z-50 p-2 rounded-lg shadow-lg flex gap-1.5"
                style={{
                  backgroundColor: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {ORGANIZER_COLORS.map(c => (
                  <button
                    key={c}
                    className="w-5 h-5 rounded-full border-2 border-transparent hover:border-white transition-all"
                    style={{ backgroundColor: c }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleColorSelect(c);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col flex-1 min-w-0">
            <span className="text-node-xs font-medium text-content text-halo">
              {name}
            </span>
            {parentGroupName && (
              <span className="text-[9px] text-content-subtle leading-tight">{parentGroupName}</span>
            )}
          </div>
          {/* Child count badge */}
          {childCount > 0 && (
            <span
              className="text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: `color-mix(in srgb, ${color} 20%, var(--color-canvas))`,
                color: `color-mix(in srgb, ${color} 80%, var(--color-content))`,
              }}
            >
              {childCount}
            </span>
          )}
          {/* Layout menu (canvas only, 2+ children) */}
          {layoutMenuItems && (
            <div className="relative">
              <Tooltip content="Layout options">
                <button
                  className="w-5 h-5 flex items-center justify-center rounded text-content-muted hover:text-content transition-colors shrink-0"
                  onClick={handleLayoutMenuClick}
                  title="Layout options"
                >
                  <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor">
                    <circle cx="12" cy="6" r="1.5" />
                    <circle cx="12" cy="12" r="1.5" />
                    <circle cx="12" cy="18" r="1.5" />
                  </svg>
                </button>
              </Tooltip>
              {/* Layout menu popover */}
              {showLayoutMenu && (
                <div
                  ref={layoutMenuRef}
                  className="absolute top-full right-0 mt-1 z-50 py-1 rounded-lg shadow-lg min-w-[160px]"
                  style={{
                    backgroundColor: 'var(--color-surface-elevated)',
                    border: '1px solid var(--color-border)',
                  }}
                >
                  {layoutMenuItems.map(({ label, handler, icon }) => (
                    <button
                      key={label}
                      className="w-full px-3 py-2 flex items-center gap-2 text-sm text-content hover:bg-content-muted/10 transition-colors"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (nodeId) handler(nodeId);
                        setShowLayoutMenu(false);
                      }}
                    >
                      <span className="shrink-0">{icon}</span>
                      <span>{label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* Eyeball toggle button (canvas only — metamap uses click to toggle) */}
          {nodeActions && (
            <Tooltip content="Collapse organizer">
              <button
                className="w-5 h-5 flex items-center justify-center rounded text-content-muted hover:text-content transition-colors shrink-0"
                onClick={handleToggle}
                title="Collapse organizer"
              >
                <EyeIcon size={14} />
              </button>
            </Tooltip>
          )}
          {/* Collapse chevron hint (metamap only) */}
          {!nodeActions && (
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-content-subtle opacity-40 shrink-0"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

export default memo(OrganizerNode);
