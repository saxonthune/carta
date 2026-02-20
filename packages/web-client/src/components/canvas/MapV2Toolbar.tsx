import { useState, useRef, useEffect, useCallback } from 'react';
import {
  ArrowUUpLeft,
  ArrowUUpRight,
  Plus,
  Minus,
  CornersOut,
  TreeStructure,
  AlignLeft,
  ArrowsOutLineHorizontal,
  ArrowRight,
  ArrowLeft,
  ArrowDown,
  ArrowUp,
  AlignCenterHorizontal,
  AlignRight,
  AlignTop,
  AlignCenterVertical,
  AlignBottom,
  ArrowsOutLineVertical,
  Path,
  MapPin,
  X,
  CursorClick,
} from '@phosphor-icons/react';
import CanvasToolbar, { ToolbarButton, ToolbarDivider } from './CanvasToolbar';

interface MapV2ToolbarProps {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitView: () => void;
  onSpreadAll: () => void;
  onCompactAll: () => void;
  onFlowLayout: (direction: 'LR' | 'RL' | 'TB' | 'BT') => void;
  onAlignNodes: (axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  onDistributeNodes: (axis: 'horizontal' | 'vertical') => void;
  onRouteEdges: () => void;
  onClearRoutes: () => void;
  onApplyPinLayout: () => void;
  selectionModeActive: boolean;
  onToggleSelectionMode: () => void;
  selectedCount: number;
  hasPinConstraints: boolean;
}

type FlyoutType = 'layout' | 'align' | 'distribute' | null;

export default function MapV2Toolbar({
  undo,
  redo,
  canUndo,
  canRedo,
  onZoomIn,
  onZoomOut,
  onFitView,
  onSpreadAll,
  onCompactAll,
  onFlowLayout,
  onAlignNodes,
  onDistributeNodes,
  onRouteEdges,
  onClearRoutes,
  onApplyPinLayout,
  selectionModeActive,
  onToggleSelectionMode,
  selectedCount,
  hasPinConstraints,
}: MapV2ToolbarProps) {
  const canAlign = selectedCount >= 2;
  const canDistribute = selectedCount >= 3;
  const [openFlyout, setOpenFlyout] = useState<FlyoutType>(null);
  const [lastDirection, setLastDirection] = useState<'LR' | 'RL' | 'TB' | 'BT'>('LR');
  const layoutRef = useRef<HTMLDivElement>(null);
  const alignRef = useRef<HTMLDivElement>(null);
  const distributeRef = useRef<HTMLDivElement>(null);

  // Close flyout on outside click
  useEffect(() => {
    if (!openFlyout) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const refs = [layoutRef.current, alignRef.current, distributeRef.current];
      const isInside = refs.some(ref => ref?.contains(target));
      if (!isInside) {
        setOpenFlyout(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openFlyout]);

  // Close flyout on Escape
  useEffect(() => {
    if (!openFlyout) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpenFlyout(null);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [openFlyout]);

  const handleFlowLayout = useCallback((direction: 'LR' | 'RL' | 'TB' | 'BT') => {
    setLastDirection(direction);
    onFlowLayout(direction);
    setOpenFlyout(null);
  }, [onFlowLayout]);

  const handleAlign = useCallback((axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    onAlignNodes(axis);
    setOpenFlyout(null);
  }, [onAlignNodes]);

  const handleDistribute = useCallback((axis: 'horizontal' | 'vertical') => {
    onDistributeNodes(axis);
    setOpenFlyout(null);
  }, [onDistributeNodes]);

  const handleSpreadAll = useCallback(() => {
    onSpreadAll();
    setOpenFlyout(null);
  }, [onSpreadAll]);

  const handleCompactAll = useCallback(() => {
    onCompactAll();
    setOpenFlyout(null);
  }, [onCompactAll]);

  const handleRouteEdges = useCallback(() => {
    onRouteEdges();
    setOpenFlyout(null);
  }, [onRouteEdges]);

  const handleClearRoutes = useCallback(() => {
    onClearRoutes();
    setOpenFlyout(null);
  }, [onClearRoutes]);

  const handleApplyPinLayout = useCallback(() => {
    onApplyPinLayout();
    setOpenFlyout(null);
  }, [onApplyPinLayout]);

  return (
    <CanvasToolbar>
      {/* Undo/Redo */}
      <ToolbarButton onClick={undo} tooltip="Undo (Ctrl+Z)" disabled={!canUndo}>
        <ArrowUUpLeft weight="bold" />
      </ToolbarButton>
      <ToolbarButton onClick={redo} tooltip="Redo (Ctrl+Shift+Z)" disabled={!canRedo}>
        <ArrowUUpRight weight="bold" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Zoom controls */}
      <ToolbarButton onClick={onZoomIn} tooltip="Zoom In">
        <Plus weight="bold" />
      </ToolbarButton>
      <ToolbarButton onClick={onZoomOut} tooltip="Zoom Out">
        <Minus weight="bold" />
      </ToolbarButton>
      <ToolbarButton onClick={onFitView} tooltip="Fit to View">
        <CornersOut weight="bold" />
      </ToolbarButton>

      <ToolbarDivider />

      {/* Layout flyout */}
      <div ref={layoutRef} className="relative">
        <ToolbarButton
          onClick={() => setOpenFlyout(openFlyout === 'layout' ? null : 'layout')}
          tooltip="Layout"
        >
          <TreeStructure weight="bold" size={18} />
        </ToolbarButton>
        {openFlyout === 'layout' && (
          <div className="absolute left-full ml-2 top-0 bg-surface border border-border rounded-lg shadow-lg z-50 p-2 min-w-[180px]">
            {/* Direction section */}
            <div className="mb-2">
              <div className="text-2xs text-content-muted mb-1 px-1">Direction</div>
              <div className="grid grid-cols-2 gap-1">
                <button
                  className={`flex items-center justify-center p-2 rounded border border-border hover:bg-surface-alt transition-colors ${
                    lastDirection === 'LR' ? 'bg-accent/10 border-accent' : 'bg-transparent'
                  }`}
                  onClick={() => handleFlowLayout('LR')}
                  aria-label="Left to right"
                >
                  <ArrowRight weight="bold" size={18} />
                </button>
                <button
                  className={`flex items-center justify-center p-2 rounded border border-border hover:bg-surface-alt transition-colors ${
                    lastDirection === 'RL' ? 'bg-accent/10 border-accent' : 'bg-transparent'
                  }`}
                  onClick={() => handleFlowLayout('RL')}
                  aria-label="Right to left"
                >
                  <ArrowLeft weight="bold" size={18} />
                </button>
                <button
                  className={`flex items-center justify-center p-2 rounded border border-border hover:bg-surface-alt transition-colors ${
                    lastDirection === 'TB' ? 'bg-accent/10 border-accent' : 'bg-transparent'
                  }`}
                  onClick={() => handleFlowLayout('TB')}
                  aria-label="Top to bottom"
                >
                  <ArrowDown weight="bold" size={18} />
                </button>
                <button
                  className={`flex items-center justify-center p-2 rounded border border-border hover:bg-surface-alt transition-colors ${
                    lastDirection === 'BT' ? 'bg-accent/10 border-accent' : 'bg-transparent'
                  }`}
                  onClick={() => handleFlowLayout('BT')}
                  aria-label="Bottom to top"
                >
                  <ArrowUp weight="bold" size={18} />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-border my-2" />

            {/* Quick actions section */}
            <div>
              <div className="text-2xs text-content-muted mb-1 px-1">Quick actions</div>
              <div className="flex flex-col gap-1">
                <button
                  className={`flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface-alt transition-colors text-left ${
                    !hasPinConstraints ? 'opacity-40 cursor-not-allowed' : ''
                  }`}
                  onClick={handleApplyPinLayout}
                  disabled={!hasPinConstraints}
                  title={!hasPinConstraints ? 'No pin constraints on this page' : 'Apply pin constraint layout'}
                >
                  <MapPin weight="bold" size={16} />
                  <span>Apply Pins</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface-alt transition-colors text-left"
                  onClick={handleSpreadAll}
                >
                  <ArrowsOutLineHorizontal weight="bold" size={16} />
                  <span>Fix Overlaps</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface-alt transition-colors text-left"
                  onClick={handleCompactAll}
                >
                  <TreeStructure weight="bold" size={16} />
                  <span>Compact</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface-alt transition-colors text-left"
                  onClick={handleRouteEdges}
                >
                  <Path weight="bold" size={16} />
                  <span>Auto-route Edges</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-surface-alt transition-colors text-left"
                  onClick={handleClearRoutes}
                >
                  <X weight="bold" size={16} />
                  <span>Clear Routes</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Align flyout */}
      <div ref={alignRef} className="relative">
        <ToolbarButton
          onClick={() => canAlign && setOpenFlyout(openFlyout === 'align' ? null : 'align')}
          tooltip={canAlign ? "Align" : "Select 2+ nodes to align"}
          disabled={!canAlign}
        >
          <AlignLeft weight="bold" size={18} />
        </ToolbarButton>
        {openFlyout === 'align' && (
          <div className="absolute left-full ml-2 top-0 bg-surface border border-border rounded-lg shadow-lg z-50 p-2 min-w-[160px]">
            {!canAlign ? (
              <div className="text-content-muted text-xs px-2 py-1">
                Select 2+ nodes
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-1">
              <button
                className="flex items-center justify-center p-2 rounded border border-border hover:bg-surface-alt transition-colors"
                onClick={() => handleAlign('left')}
                aria-label="Align left"
              >
                <AlignLeft weight="bold" size={18} />
              </button>
              <button
                className="flex items-center justify-center p-2 rounded border border-border hover:bg-surface-alt transition-colors"
                onClick={() => handleAlign('center')}
                aria-label="Align center horizontal"
              >
                <AlignCenterHorizontal weight="bold" size={18} />
              </button>
              <button
                className="flex items-center justify-center p-2 rounded border border-border hover:bg-surface-alt transition-colors"
                onClick={() => handleAlign('right')}
                aria-label="Align right"
              >
                <AlignRight weight="bold" size={18} />
              </button>
              <button
                className="flex items-center justify-center p-2 rounded border border-border hover:bg-surface-alt transition-colors"
                onClick={() => handleAlign('top')}
                aria-label="Align top"
              >
                <AlignTop weight="bold" size={18} />
              </button>
              <button
                className="flex items-center justify-center p-2 rounded border border-border hover:bg-surface-alt transition-colors"
                onClick={() => handleAlign('middle')}
                aria-label="Align center vertical"
              >
                <AlignCenterVertical weight="bold" size={18} />
              </button>
              <button
                className="flex items-center justify-center p-2 rounded border border-border hover:bg-surface-alt transition-colors"
                onClick={() => handleAlign('bottom')}
                aria-label="Align bottom"
              >
                <AlignBottom weight="bold" size={18} />
              </button>
            </div>
            )}
          </div>
        )}
      </div>

      {/* Distribute flyout */}
      <div ref={distributeRef} className="relative">
        <ToolbarButton
          onClick={() => canDistribute && setOpenFlyout(openFlyout === 'distribute' ? null : 'distribute')}
          tooltip={canDistribute ? "Distribute" : "Select 3+ nodes to distribute"}
          disabled={!canDistribute}
        >
          <ArrowsOutLineHorizontal weight="bold" size={18} />
        </ToolbarButton>
        {openFlyout === 'distribute' && (
          <div className="absolute left-full ml-2 top-0 bg-surface border border-border rounded-lg shadow-lg z-50 p-2 min-w-[160px]">
            {!canDistribute ? (
              <div className="text-content-muted text-xs px-2 py-1">
                Select 3+ nodes
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <button
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded border border-border hover:bg-surface-alt transition-colors text-left"
                  onClick={() => handleDistribute('horizontal')}
                  aria-label="Distribute horizontal"
                >
                  <ArrowsOutLineHorizontal weight="bold" size={18} />
                  <span>Horizontal</span>
                </button>
                <button
                  className="flex items-center gap-2 px-2 py-1.5 text-sm rounded border border-border hover:bg-surface-alt transition-colors text-left"
                  onClick={() => handleDistribute('vertical')}
                  aria-label="Distribute vertical"
                >
                  <ArrowsOutLineVertical weight="bold" size={18} />
                  <span>Vertical</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <ToolbarDivider />

      {/* Selection mode toggle */}
      <ToolbarButton
        onClick={onToggleSelectionMode}
        tooltip={selectionModeActive ? "Exit Selection Mode (V)" : "Selection Mode (V)"}
      >
        <CursorClick weight="bold" />
      </ToolbarButton>
    </CanvasToolbar>
  );
}
