import { useState, useRef, useEffect, useCallback } from 'react';
import { ControlButton } from '@xyflow/react';
import {
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
} from '@phosphor-icons/react';
import { Tooltip } from '../ui';

interface ToolbarLayoutFlyoutsProps {
  spreadAll: () => void;
  compactAll: () => void;
  flowLayout: (direction: 'LR' | 'RL' | 'TB' | 'BT') => void;
  alignNodes: (axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => void;
  distributeNodes: (axis: 'horizontal' | 'vertical') => void;
  selectedCount: number;
}

type FlyoutType = 'layout' | 'align' | 'distribute' | null;

export default function ToolbarLayoutFlyouts({
  spreadAll,
  compactAll,
  flowLayout,
  alignNodes,
  distributeNodes,
  selectedCount,
}: ToolbarLayoutFlyoutsProps) {
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
    flowLayout(direction);
    setOpenFlyout(null);
  }, [flowLayout]);

  const handleAlign = useCallback((axis: 'left' | 'center' | 'right' | 'top' | 'middle' | 'bottom') => {
    alignNodes(axis);
    setOpenFlyout(null);
  }, [alignNodes]);

  const handleDistribute = useCallback((axis: 'horizontal' | 'vertical') => {
    distributeNodes(axis);
    setOpenFlyout(null);
  }, [distributeNodes]);

  const handleSpreadAll = useCallback(() => {
    spreadAll();
    setOpenFlyout(null);
  }, [spreadAll]);

  const handleCompactAll = useCallback(() => {
    compactAll();
    setOpenFlyout(null);
  }, [compactAll]);

  return (
    <>
      {/* Auto-layout button and flyout */}
      <div ref={layoutRef} className="relative">
        <Tooltip content="Layout">
          <ControlButton
            onClick={() => setOpenFlyout(openFlyout === 'layout' ? null : 'layout')}
            aria-label="Layout"
            aria-expanded={openFlyout === 'layout'}
          >
            <TreeStructure weight="bold" size={18} />
          </ControlButton>
        </Tooltip>
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
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Align button and flyout */}
      <div ref={alignRef} className="relative">
        <Tooltip content="Align">
          <ControlButton
            onClick={() => setOpenFlyout(openFlyout === 'align' ? null : 'align')}
            disabled={selectedCount < 2}
            aria-label="Align"
            aria-expanded={openFlyout === 'align'}
            className={selectedCount < 2 ? 'opacity-50 pointer-events-none' : ''}
          >
            <AlignLeft weight="bold" size={18} />
          </ControlButton>
        </Tooltip>
        {openFlyout === 'align' && selectedCount >= 2 && (
          <div className="absolute left-full ml-2 top-0 bg-surface border border-border rounded-lg shadow-lg z-50 p-2 min-w-[160px]">
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
          </div>
        )}
      </div>

      {/* Distribute button and flyout */}
      <div ref={distributeRef} className="relative">
        <Tooltip content="Distribute">
          <ControlButton
            onClick={() => setOpenFlyout(openFlyout === 'distribute' ? null : 'distribute')}
            disabled={selectedCount < 3}
            aria-label="Distribute"
            aria-expanded={openFlyout === 'distribute'}
            className={selectedCount < 3 ? 'opacity-50 pointer-events-none' : ''}
          >
            <ArrowsOutLineHorizontal weight="bold" size={18} />
          </ControlButton>
        </Tooltip>
        {openFlyout === 'distribute' && selectedCount >= 3 && (
          <div className="absolute left-full ml-2 top-0 bg-surface border border-border rounded-lg shadow-lg z-50 p-2 min-w-[160px]">
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
          </div>
        )}
      </div>
    </>
  );
}
